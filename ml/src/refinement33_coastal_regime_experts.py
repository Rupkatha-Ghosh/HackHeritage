"""Refinement 33 — Coastal Regime / Expert Model Optimization.

Read-only benchmark for ORCA-X's six operational coastal regimes.

Strategies compared:
  A. global: one global multi-output regression ensemble.
  B. expert: one independently trained model per known coast.
  C. global_residual: global model plus a per-coast residual correction learned
     only from a temporally earlier calibration split.

The benchmark is deliberately production-safe: it never changes the production
model, label policy, thresholds, or inference code.

Validation design
-----------------
* +6h forward targets only.
* Temporal evaluation: train/calibration use 2024; final test is 2025.
* The 2024 data is split chronologically into 80% model-training and 20%
  calibration. Residual corrections are therefore never fitted on 2025.
* All six known coasts receive an expert model, matching the current operational
  geography. A separate leave-one-coast-out benchmark is retained for the global
  strategy to expose geographic generalization risk.
* Ten degradation scenarios are evaluated on the same 2025 test rows.
* Risk classes are derived from the predicted continuous future sea state using
  the same proxy policy as the existing regression refinements.

This file is intended to be run from the repository root or from ml/src.
Google Colab T4/L4 is recommended; CPU remains supported.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, mean_absolute_error, r2_score

HERE = Path(__file__).resolve()
ML_ROOT = HERE.parents[1]
PROJECT_ROOT = HERE.parents[2]
if str(HERE.parent) not in sys.path:
    sys.path.insert(0, str(HERE.parent))

from config import FEATURE_COLUMNS, PROCESSED_DIR, RISK_HORIZON_HOURS

RANDOM_STATE = 42
TARGET_COLUMNS = [
    "wind_speed_kts",
    "wind_gust_kts",
    "wave_height_m",
    "swell_height_m",
    "wave_period_s",
]
LOCATION_COLUMN = "location_id"
TIMESTAMP_COLUMN = "timestamp"
OUTPUT_DIR = ML_ROOT / "models" / "refinement33"

SCENARIOS = [
    "clean",
    "random_missing_10",
    "random_missing_25",
    "random_missing_40",
    "wind_outage",
    "sea_state_outage",
    "atmospheric_outage",
    "stale_wind",
    "stale_sea_state",
    "mixed_degradation",
]

# These are point-in-time inputs and are also the features used by the current
# regression refinements. Latitude/longitude are already part of FEATURE_COLUMNS
# in the current ORCA-X dataset.
BASE_FEATURES = [c for c in FEATURE_COLUMNS if c not in {"month", "season"}]
FEATURES = [c for c in FEATURE_COLUMNS if c in BASE_FEATURES or c in {"month", "season"}]


def device_name() -> str:
    value = os.getenv("ORCA_X_DEVICE", "cpu").strip().lower()
    if value in {"gpu", "cuda", "cuda:0"}:
        return "cuda"
    if value == "cpu":
        return "cpu"
    raise ValueError("ORCA_X_DEVICE must be one of: cpu, cuda, gpu, cuda:0")


def n_jobs() -> int:
    return int(os.getenv("ORCA_X_N_JOBS", "2"))


def model_params(seed: int = RANDOM_STATE) -> dict:
    params = dict(
        objective="reg:squarederror",
        n_estimators=int(os.getenv("ORCA_X_R33_ESTIMATORS", "450")),
        max_depth=int(os.getenv("ORCA_X_R33_MAX_DEPTH", "5")),
        learning_rate=float(os.getenv("ORCA_X_R33_LEARNING_RATE", "0.04")),
        min_child_weight=int(os.getenv("ORCA_X_R33_MIN_CHILD_WEIGHT", "6")),
        subsample=0.9,
        colsample_bytree=0.9,
        reg_alpha=0.1,
        reg_lambda=2.5,
        gamma=0.03,
        tree_method="hist",
        random_state=seed,
        n_jobs=n_jobs(),
    )
    if device_name() == "cuda":
        params["device"] = "cuda"
    return params


def make_model(seed: int = RANDOM_STATE) -> xgb.XGBRegressor:
    return xgb.XGBRegressor(**model_params(seed))


def risk_class(values: np.ndarray) -> np.ndarray:
    """Apply the existing ORCA-X continuous-risk proxy to predictions."""
    y = np.asarray(values, dtype=float)
    w, g, wh, sh, _ = y.T
    score = np.maximum.reduce([w / 25.0, g / 35.0, wh / 3.0, sh / 2.0])
    return np.select([score >= 1.0, score >= 0.72, score >= 0.45], [3, 2, 1], default=0).astype(int)


def load_pairs() -> pd.DataFrame:
    path = PROCESSED_DIR / "orca_historical_marine_risk.parquet"
    if not path.exists():
        raise FileNotFoundError(f"Missing processed dataset: {path}")
    df = pd.read_parquet(path).copy()
    required = [LOCATION_COLUMN, TIMESTAMP_COLUMN, *FEATURES, *TARGET_COLUMNS]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")
    df[TIMESTAMP_COLUMN] = pd.to_datetime(df[TIMESTAMP_COLUMN], utc=True, errors="coerce")
    for c in FEATURES + TARGET_COLUMNS:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=[LOCATION_COLUMN, TIMESTAMP_COLUMN, *TARGET_COLUMNS]).copy()
    df = df.sort_values([LOCATION_COLUMN, TIMESTAMP_COLUMN]).reset_index(drop=True)
    if df.duplicated([LOCATION_COLUMN, TIMESTAMP_COLUMN]).any():
        raise ValueError("Duplicate location/timestamp rows detected.")

    # Build the exact +6h target from future observations, not from the stored
    # contemporaneous risk label. This mirrors the forward-target discipline used
    # elsewhere in the refinement suite.
    future = df[[LOCATION_COLUMN, TIMESTAMP_COLUMN, *TARGET_COLUMNS]].copy()
    future_ts = future[TIMESTAMP_COLUMN] - pd.Timedelta(hours=int(RISK_HORIZON_HOURS))
    future = future.assign(prediction_timestamp=future_ts)
    target = future[[LOCATION_COLUMN, "prediction_timestamp", *TARGET_COLUMNS]].rename(
        columns={"prediction_timestamp": TIMESTAMP_COLUMN,
                 **{c: f"target_{c}" for c in TARGET_COLUMNS}}
    )
    out = df.merge(target, on=[LOCATION_COLUMN, TIMESTAMP_COLUMN], how="left")
    out = out.dropna(subset=[f"target_{c}" for c in TARGET_COLUMNS]).copy()
    if out.empty:
        raise ValueError("No complete +6h pairs remain.")
    return out


def chronological_splits(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Return 2024 train, late-2024 calibration, and 2025 test."""
    work = df.sort_values(TIMESTAMP_COLUMN).copy()
    train2024 = work[work[TIMESTAMP_COLUMN].dt.year == 2024].copy()
    test2025 = work[work[TIMESTAMP_COLUMN].dt.year == 2025].copy()
    if train2024.empty or test2025.empty:
        raise ValueError("Temporal benchmark requires both 2024 and 2025 data.")
    cutoff = train2024[TIMESTAMP_COLUMN].sort_values().iloc[int(len(train2024) * 0.80)]
    fit = train2024[train2024[TIMESTAMP_COLUMN] < cutoff].copy()
    calibration = train2024[train2024[TIMESTAMP_COLUMN] >= cutoff].copy()
    return fit, calibration, test2025


def fit_multioutput(frame: pd.DataFrame, seed_offset: int = 0) -> list[xgb.XGBRegressor]:
    models: list[xgb.XGBRegressor] = []
    X = frame[FEATURES]
    for idx, target in enumerate(TARGET_COLUMNS):
        model = make_model(RANDOM_STATE + seed_offset + idx)
        model.fit(X, frame[f"target_{target}"], verbose=False)
        models.append(model)
    return models


def predict_multioutput(models: list[xgb.XGBRegressor], frame: pd.DataFrame) -> np.ndarray:
    X = frame[FEATURES]
    return np.column_stack([m.predict(X) for m in models])


def make_degraded(frame: pd.DataFrame, scenario: str) -> pd.DataFrame:
    out = frame.copy()
    if scenario == "clean":
        return out
    rng = np.random.default_rng(2026 + SCENARIOS.index(scenario))
    groups = {
        "wind": ["wind_speed_kts", "wind_gust_kts", "wind_direction_deg"],
        "sea": ["wave_height_m", "wave_period_s", "wave_direction_deg", "swell_height_m", "swell_period_s", "swell_direction_deg"],
        "atmospheric": ["air_pressure_hpa", "air_temperature_c", "precipitation_mm"],
    }
    if scenario.startswith("random_missing_"):
        pct = int(scenario.rsplit("_", 1)[-1]) / 100.0
        for col in FEATURES:
            mask = rng.random(len(out)) < pct
            out.loc[mask, col] = np.nan
    elif scenario == "wind_outage":
        out[groups["wind"]] = np.nan
    elif scenario == "sea_state_outage":
        out[groups["sea"]] = np.nan
    elif scenario == "atmospheric_outage":
        out[groups["atmospheric"]] = np.nan
    elif scenario == "stale_wind":
        # Approximate stale live data using the immediately preceding row within
        # each coast. No future information is introduced.
        out[groups["wind"]] = out.groupby(LOCATION_COLUMN)[groups["wind"]].shift(1).to_numpy()
    elif scenario == "stale_sea_state":
        out[groups["sea"]] = out.groupby(LOCATION_COLUMN)[groups["sea"]].shift(1).to_numpy()
    elif scenario == "mixed_degradation":
        for col in groups["wind"]:
            out.loc[rng.random(len(out)) < 0.25, col] = np.nan
        for col in groups["sea"]:
            out.loc[rng.random(len(out)) < 0.25, col] = np.nan
        for col in groups["atmospheric"]:
            out.loc[rng.random(len(out)) < 0.15, col] = np.nan
    else:
        raise ValueError(f"Unknown scenario: {scenario}")
    return out


def critical_recall(y_true: np.ndarray, pred: np.ndarray) -> float:
    mask = y_true >= 2
    return float(np.mean(pred[mask] >= 2)) if mask.any() else 0.0


def false_escalation(y_true: np.ndarray, pred: np.ndarray) -> float:
    # Safety-oriented over-escalation: predicted severity is above the true class.
    return float(np.mean(pred > y_true))


def risk_metrics(y_true: np.ndarray, predicted_continuous: np.ndarray) -> dict:
    pred = risk_class(predicted_continuous)
    return {
        "accuracy": float(accuracy_score(y_true, pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, pred)),
        "macro_f1": float(f1_score(y_true, pred, average="macro", zero_division=0)),
        "critical_recall": critical_recall(y_true, pred),
        "miss_rate": float(np.mean((y_true >= 2) & (pred < 2))),
        "false_escalation_rate": false_escalation(y_true, pred),
        "mean_mae": float(mean_absolute_error(y_true, pred)),
        "rows": int(len(y_true)),
    }


def regression_metrics(y_true: np.ndarray, pred: np.ndarray) -> dict:
    result = {
        "mean_mae": float(mean_absolute_error(y_true, pred)),
        "mean_r2": float(np.mean([r2_score(y_true[:, i], pred[:, i]) for i in range(y_true.shape[1])])),
    }
    for i, target in enumerate(TARGET_COLUMNS):
        result[f"{target}_mae"] = float(mean_absolute_error(y_true[:, i], pred[:, i]))
        result[f"{target}_r2"] = float(r2_score(y_true[:, i], pred[:, i]))
    return result


def target_array(frame: pd.DataFrame) -> np.ndarray:
    return frame[[f"target_{c}" for c in TARGET_COLUMNS]].to_numpy(dtype=float)


def fit_location_experts(fit: pd.DataFrame) -> dict[str, list[xgb.XGBRegressor]]:
    experts: dict[str, list[xgb.XGBRegressor]] = {}
    for idx, location in enumerate(sorted(fit[LOCATION_COLUMN].unique())):
        local = fit[fit[LOCATION_COLUMN] == location]
        if len(local) < 500:
            raise ValueError(f"Not enough training rows for expert {location}: {len(local)}")
        print(f"      expert {location}: rows={len(local):,}")
        experts[location] = fit_multioutput(local, seed_offset=100 * (idx + 1))
    return experts


def predict_experts(experts: dict[str, list[xgb.XGBRegressor]], frame: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    pred = np.full((len(frame), len(TARGET_COLUMNS)), np.nan, dtype=float)
    known = np.zeros(len(frame), dtype=bool)
    for location, group in frame.groupby(LOCATION_COLUMN, sort=True):
        if location not in experts:
            continue
        idx = group.index.to_numpy()
        pred[idx] = predict_multioutput(experts[location], group)
        known[idx] = True
    return pred, known


def fit_residual_corrector(global_models: list[xgb.XGBRegressor], calibration: pd.DataFrame) -> dict[str, np.ndarray]:
    base = predict_multioutput(global_models, calibration)
    actual = target_array(calibration)
    residuals = actual - base
    corrections: dict[str, np.ndarray] = {}
    for location, idx in calibration.groupby(LOCATION_COLUMN).groups.items():
        # Robust median residual is intentionally simple and stable. It is learned
        # from earlier data only, then frozen for the entire 2025 test period.
        corrections[location] = np.nanmedian(residuals[np.asarray(list(idx))], axis=0)
    return corrections


def apply_residual(base_pred: np.ndarray, locations: pd.Series, corrections: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    out = base_pred.copy()
    known = np.zeros(len(locations), dtype=bool)
    for i, location in enumerate(locations.to_numpy()):
        if location in corrections:
            out[i] += corrections[location]
            known[i] = True
    return out, known


def evaluate_predictions(name: str, strategy: str, frame: pd.DataFrame, pred: np.ndarray, known: np.ndarray, scenario: str) -> dict:
    valid = known & np.isfinite(pred).all(axis=1)
    if not valid.any():
        return {"strategy": strategy, "scope": name, "scenario": scenario, "coverage": 0.0, "rows": 0}
    actual = target_array(frame)[valid]
    pred_valid = pred[valid]
    y_true_risk = risk_class(actual)
    row = {"strategy": strategy, "scope": name, "scenario": scenario, "coverage": float(valid.mean()), "rows": int(valid.sum())}
    row.update({f"risk_{k}": v for k, v in risk_metrics(y_true_risk, pred_valid).items() if k != "rows"})
    row.update({f"reg_{k}": v for k, v in regression_metrics(actual, pred_valid).items()})
    return row


def spatial_global_holdout(df: pd.DataFrame) -> list[dict]:
    """Evaluate global generalization by holding each coast out entirely."""
    rows: list[dict] = []
    locations = sorted(df[LOCATION_COLUMN].unique())
    for idx, location in enumerate(locations):
        train = df[df[LOCATION_COLUMN] != location]
        test = df[df[LOCATION_COLUMN] == location]
        print(f"  spatial holdout {location}: train={len(train):,} test={len(test):,}")
        models = fit_multioutput(train, seed_offset=5000 + idx * 10)
        pred = predict_multioutput(models, test)
        known = np.ones(len(test), dtype=bool)
        rows.append(evaluate_predictions(location, "global_spatial_holdout", test, pred, known, "clean"))
    return rows


def benchmark() -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    df = load_pairs()
    fit, calibration, test = chronological_splits(df)
    print(f"Source rows={len(df):,} | complete +6h pairs={len(df):,} | locations={df[LOCATION_COLUMN].nunique()}")
    print(f"2024 model-fit={len(fit):,} | 2024 calibration={len(calibration):,} | 2025 test={len(test):,}")
    print(f"Locations={sorted(df[LOCATION_COLUMN].unique().tolist())}")
    print(f"Features={len(FEATURES)} | targets={len(TARGET_COLUMNS)} | scenarios={len(SCENARIOS)}")
    print(f"XGBoost device={device_name()} n_jobs={n_jobs()} version={xgb.__version__}")

    print("\n[1/4] Training global model...")
    global_models = fit_multioutput(fit)
    global_clean = predict_multioutput(global_models, test)

    print("[2/4] Training one coastal expert per known location...")
    experts = fit_location_experts(fit)
    expert_clean, expert_known = predict_experts(experts, test)

    print("[3/4] Learning frozen per-coast residual corrections from late 2024...")
    corrections = fit_residual_corrector(global_models, calibration)
    residual_clean, residual_known = apply_residual(global_clean, test[LOCATION_COLUMN], corrections)
    print("      corrections:")
    for location in sorted(corrections):
        print(f"        {location}: " + ", ".join(f"{t}={v:.4f}" for t, v in zip(TARGET_COLUMNS, corrections[location])))

    print("[4/4] Evaluating ten degradation scenarios on 2025...")
    rows: list[dict] = []
    for scenario in SCENARIOS:
        scenario_frame = make_degraded(test, scenario)
        if scenario == "clean":
            pred_global = global_clean
            pred_expert = expert_clean
            pred_residual = residual_clean
        else:
            pred_global = predict_multioutput(global_models, scenario_frame)
            pred_expert, _ = predict_experts(experts, scenario_frame)
            base = pred_global
            pred_residual, _ = apply_residual(base, scenario_frame[LOCATION_COLUMN], corrections)
        rows.append(evaluate_predictions("temporal_2025", "global", scenario_frame, pred_global, np.ones(len(test), dtype=bool), scenario))
        rows.append(evaluate_predictions("temporal_2025", "expert", scenario_frame, pred_expert, expert_known, scenario))
        rows.append(evaluate_predictions("temporal_2025", "global_residual", scenario_frame, pred_residual, residual_known, scenario))

    print("\nSpatial holdout benchmark for global strategy (clean only)...")
    spatial_rows = spatial_global_holdout(df)

    result_df = pd.DataFrame(rows)
    spatial_df = pd.DataFrame(spatial_rows)
    return result_df, spatial_df, {
        "fit_rows_2024": len(fit),
        "calibration_rows_2024": len(calibration),
        "test_rows_2025": len(test),
        "locations": sorted(df[LOCATION_COLUMN].unique().tolist()),
        "features": FEATURES,
        "targets": TARGET_COLUMNS,
        "scenarios": SCENARIOS,
        "device": device_name(),
        "n_jobs": n_jobs(),
    }


def summarize(results: pd.DataFrame) -> pd.DataFrame:
    clean = results[results.scenario == "clean"].copy()
    stress = results[results.scenario != "clean"].copy()
    rows = []
    for strategy in sorted(results.strategy.unique()):
        c = clean[clean.strategy == strategy]
        s = stress[stress.strategy == strategy]
        if c.empty or s.empty:
            continue
        # Score is deliberately conservative: safety recall matters most, but
        # high false escalation and poor regression error are penalized.
        score = (
            0.40 * float(s.risk_critical_recall.mean())
            + 0.25 * float(c.risk_accuracy.mean())
            + 0.15 * float(c.risk_balanced_accuracy.mean())
            + 0.10 * float(s.reg_mean_r2.mean())
            - 0.10 * float(s.risk_false_escalation_rate.mean())
        )
        rows.append({
            "strategy": strategy,
            "clean_accuracy": float(c.risk_accuracy.mean()),
            "clean_critical_recall": float(c.risk_critical_recall.mean()),
            "clean_mean_mae": float(c.reg_mean_mae.mean()),
            "stress_accuracy": float(s.risk_accuracy.mean()),
            "stress_balanced_accuracy": float(s.risk_balanced_accuracy.mean()),
            "stress_macro_f1": float(s.risk_macro_f1.mean()),
            "stress_critical_recall": float(s.risk_critical_recall.mean()),
            "stress_miss_rate": float(s.risk_miss_rate.mean()),
            "stress_false_escalation_rate": float(s.risk_false_escalation_rate.mean()),
            "stress_mean_mae": float(s.reg_mean_mae.mean()),
            "stress_mean_r2": float(s.reg_mean_r2.mean()),
            "stress_wind_mae": float(s.reg_wind_speed_kts_mae.mean()),
            "stress_gust_mae": float(s.reg_wind_gust_kts_mae.mean()),
            "benchmark_score": score,
        })
    return pd.DataFrame(rows).sort_values("benchmark_score", ascending=False).reset_index(drop=True)


def main() -> None:
    print("=" * 94)
    print("ORCA-X REFINEMENT 33 — COASTAL REGIME / EXPERT MODEL OPTIMIZATION")
    print("=" * 94)
    print("Read-only benchmark: production artifacts, risk policy and thresholds untouched")
    print("Strategies: global | expert-per-coast | global + frozen per-coast residual correction")
    print("Temporal design: early-2024 fit -> late-2024 calibration -> 2025 test")

    results, spatial, meta = benchmark()
    summary = summarize(results)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    results.to_csv(OUTPUT_DIR / "temporal_scenario_results.csv", index=False)
    spatial.to_csv(OUTPUT_DIR / "spatial_global_holdout_results.csv", index=False)
    summary.to_csv(OUTPUT_DIR / "strategy_summary.csv", index=False)
    (OUTPUT_DIR / "benchmark_metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print("\n" + "=" * 94)
    print("REFINEMENT 33 COMPLETE")
    print("=" * 94)
    print(summary.to_string(index=False))
    print("\nSpatial global holdout summary:")
    print(spatial[["scope", "strategy", "risk_accuracy", "risk_critical_recall", "reg_mean_mae", "reg_wind_speed_kts_mae", "reg_wind_gust_kts_mae"]].to_string(index=False))
    winner = summary.iloc[0]["strategy"] if not summary.empty else "none"
    print(f"\nBenchmark winner: {winner}")
    print("Winner is a benchmark candidate only; production model/risk policy was NOT changed.")
    print(f"Artifacts: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
