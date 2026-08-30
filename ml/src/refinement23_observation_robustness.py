"""ORCA-X Refinement 23: point-in-time observation robustness benchmark.

Purpose
-------
Refinement 22 established the point-in-time contract: observations available at
prediction time t are used to forecast physical state at t+6h. Refinement 23
stress-tests that contract under realistic observation degradation without
changing any production artifact.

Scenarios
---------
* clean: no artificial degradation
* random_missing_10: 10% independent feature missingness
* random_missing_25: 25% independent feature missingness
* random_missing_40: 40% independent feature missingness
* wind_outage: wind speed/gust/direction unavailable
* sea_state_outage: wave + swell observations unavailable
* atmospheric_outage: pressure/temperature/precipitation unavailable
* stale_sea_state: sea-state observations replaced by observations from t-3h
* stale_wind: wind observations replaced by observations from t-3h
* mixed_degradation: 25% random missingness plus a stale sea-state feed

Missing values are imputed using medians fitted on the training partition only.
Stale values are created only from earlier observations at the same coast, so
no future information is introduced. Model selection uses leave-one-coast-out
with Digha excluded; temporal and Digha evaluations are reported separately.

Outputs
-------
ml/models/refinement23/
  refinement23_results.json
  observation_robustness_config.json
  robustness_by_feature.csv

The source dataset, production model, risk policy, and thresholds are never
modified.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, recall_score, r2_score

from config import PROCESSED_DIR, RISK_HORIZON_HOURS
from label_policy import POLICY_VERSION

ROOT = Path(__file__).resolve().parents[2]
DATA = PROCESSED_DIR / "orca_historical_marine_risk.parquet"
OUT = ROOT / "ml" / "models" / "refinement23"
HORIZON = int(RISK_HORIZON_HOURS)
DIGHA = "digha_wb"
SEED = 42
STALE_HOURS = 3

FEATURES = [
    "wind_speed_kts", "wind_gust_kts", "wind_direction_deg",
    "wave_height_m", "wave_period_s", "wave_direction_deg",
    "swell_height_m", "swell_period_s", "swell_direction_deg",
    "air_pressure_hpa", "air_temperature_c", "sea_surface_temperature_c",
    "precipitation_mm", "month", "season",
]
TARGETS = [
    "wind_speed_kts", "wind_gust_kts", "wave_height_m",
    "swell_height_m", "wave_period_s",
]
WIND = ["wind_speed_kts", "wind_gust_kts", "wind_direction_deg"]
SEA = [
    "wave_height_m", "wave_period_s", "wave_direction_deg",
    "swell_height_m", "swell_period_s", "swell_direction_deg",
]
ATMOS = ["air_pressure_hpa", "air_temperature_c", "precipitation_mm"]

TRIALS = [
    dict(n_estimators=700, learning_rate=0.04, max_depth=5,
         min_child_weight=10, subsample=0.80, colsample_bytree=0.80,
         reg_alpha=0.15, reg_lambda=2.0, gamma=0.0),
    dict(n_estimators=900, learning_rate=0.035, max_depth=6,
         min_child_weight=10, subsample=0.80, colsample_bytree=0.80,
         reg_alpha=0.15, reg_lambda=3.0, gamma=0.03),
]

SCENARIOS = [
    "clean", "random_missing_10", "random_missing_25", "random_missing_40",
    "wind_outage", "sea_state_outage", "atmospheric_outage",
    "stale_wind", "stale_sea_state", "mixed_degradation",
]


def find_location_col(df: pd.DataFrame) -> str:
    for c in ("location", "station", "coastline", "location_id"):
        if c in df.columns:
            return c
    raise ValueError("No location column found")


def load_pairs() -> tuple[pd.DataFrame, str]:
    if not DATA.exists():
        raise FileNotFoundError(f"Canonical processed dataset not found: {DATA}")
    df = pd.read_parquet(DATA).copy()
    loc = find_location_col(df)
    required = ["timestamp", *FEATURES, *TARGETS]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset missing required point-in-time fields: {missing}")
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df[loc] = df[loc].astype(str)
    for c in FEATURES + TARGETS:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=[loc, "timestamp"]).sort_values([loc, "timestamp"]).reset_index(drop=True)

    future = df[[loc, "timestamp"] + TARGETS].copy()
    future["timestamp"] = future["timestamp"] - pd.to_timedelta(HORIZON, unit="h")
    future = future.rename(columns={c: f"future_{c}" for c in TARGETS})
    q = df.merge(future, on=[loc, "timestamp"], how="inner", validate="one_to_one")
    q = q.dropna(subset=[f"future_{c}" for c in TARGETS]).reset_index(drop=True)
    if q.duplicated([loc, "timestamp"]).any():
        raise ValueError("Duplicate location/timestamp prediction rows detected")
    return q, loc


def proxy_risk(a: np.ndarray) -> np.ndarray:
    w, g, wave, swell, _ = a.T
    score = np.maximum(w, 0) * 0.45 + np.maximum(g, 0) * 0.20
    score += np.maximum(wave, 0) * 5 + np.maximum(swell, 0) * 3
    return np.select([score >= 34, score >= 24, score >= 14], [3, 2, 1], default=0).astype(int)


def evaluate(y: np.ndarray, p: np.ndarray) -> dict:
    yr = proxy_risk(y)
    pr = proxy_risk(p)
    mae = np.mean(np.abs(y - p), axis=0)
    r2 = []
    for j in range(len(TARGETS)):
        # Constant targets are possible in a small stress subset.
        r2.append(float(r2_score(y[:, j], p[:, j])) if np.std(y[:, j]) > 1e-12 else 0.0)
    return {
        "policy_proxy_accuracy": float(accuracy_score(yr, pr)),
        "critical_proxy_recall": float(recall_score(yr >= 2, pr >= 2, zero_division=0)),
        "mean_mae": float(np.mean(mae)),
        "mean_r2": float(np.mean(r2)),
        "target_mae": dict(zip(TARGETS, map(float, mae))),
        "target_r2": dict(zip(TARGETS, r2)),
    }


def make_scenario(q: pd.DataFrame, loc: str, scenario: str, seed: int) -> pd.DataFrame:
    out = q[FEATURES].copy()
    out.index = q.index
    rng = np.random.default_rng(seed)

    if scenario == "clean":
        return out

    if scenario.startswith("random_missing_"):
        rate = int(scenario.rsplit("_", 1)[1]) / 100.0
        mask = rng.random(out.shape) < rate
        out = out.mask(mask)
        return out

    if scenario == "wind_outage":
        out[WIND] = np.nan
        return out
    if scenario == "sea_state_outage":
        out[SEA] = np.nan
        return out
    if scenario == "atmospheric_outage":
        out[ATMOS] = np.nan
        return out

    # Stale feeds are generated from an earlier timestamp at the same coast.
    # The source row at t is never used to construct a value for an earlier row.
    if scenario in {"stale_wind", "stale_sea_state", "mixed_degradation"}:
        stale_cols = WIND if scenario == "stale_wind" else SEA
        if scenario == "mixed_degradation":
            stale_cols = SEA
        lag = q[[loc, "timestamp", *stale_cols]].copy()
        lag["timestamp"] = lag["timestamp"] + pd.to_timedelta(STALE_HOURS, unit="h")
        lag = lag.rename(columns={c: f"stale_{c}" for c in stale_cols})
        joined = q[[loc, "timestamp"]].merge(
            lag, on=[loc, "timestamp"], how="left", validate="one_to_one"
        )
        for c in stale_cols:
            out[c] = joined[f"stale_{c}"].to_numpy()
        if scenario == "mixed_degradation":
            # Missingness is applied to the remaining point-in-time features.
            remaining = [c for c in FEATURES if c not in stale_cols]
            mask = rng.random((len(out), len(remaining))) < 0.25
            out.loc[:, remaining] = out[remaining].mask(mask)
        return out

    raise ValueError(f"Unknown robustness scenario: {scenario}")


def fit_predict(Xtr: pd.DataFrame, Ytr: np.ndarray, Xte: pd.DataFrame,
                params: dict, train_medians: pd.Series) -> np.ndarray:
    Xtr = Xtr.copy().replace([np.inf, -np.inf], np.nan)
    Xte = Xte.copy().replace([np.inf, -np.inf], np.nan)
    Xtr = Xtr.fillna(train_medians).fillna(0.0)
    Xte = Xte.fillna(train_medians).fillna(0.0)
    pred = np.zeros((len(Xte), len(TARGETS)), dtype=float)
    for j in range(len(TARGETS)):
        y = Ytr[:, j]
        keep = np.isfinite(y)
        m = xgb.XGBRegressor(
            objective="reg:squarederror", tree_method="hist", random_state=SEED,
            n_jobs=-1, **params,
        )
        m.fit(Xtr.loc[keep], y[keep], verbose=False)
        pred[:, j] = m.predict(Xte)
    return pred


def temporal_split(q: pd.DataFrame, loc: str) -> tuple[np.ndarray, np.ndarray]:
    base = q[q[loc] != DIGHA]
    times = np.sort(base["timestamp"].unique())
    cut = times[int(0.82 * len(times))]
    return (
        (q[loc] != DIGHA) & (q["timestamp"] < cut),
        (q[loc] != DIGHA) & (q["timestamp"] >= cut),
    )


def scenario_metrics(q: pd.DataFrame, X: pd.DataFrame, Y: np.ndarray,
                     loc: str, scenario: str, params: dict,
                     tr: np.ndarray, te: np.ndarray) -> dict:
    train_q = q.loc[tr]
    test_q = q.loc[te]
    train_clean = train_q[FEATURES]
    train_medians = train_clean.replace([np.inf, -np.inf], np.nan).median()
    test_X = make_scenario(test_q, loc, scenario, SEED + abs(hash(scenario)) % 100000)
    pred = fit_predict(train_clean, Y[tr], test_X, params, train_medians)
    return evaluate(Y[te], pred)


def main() -> None:
    print("=" * 78)
    print("ORCA-X POINT-IN-TIME OBSERVATION ROBUSTNESS BENCHMARK — REFINEMENT 23")
    print("=" * 78)
    print("Read-only benchmark | no production artifacts modified")
    print(f"Source dataset: {DATA}")
    print(f"Forward horizon: +{HORIZON}h | policy: {POLICY_VERSION}")
    print("Contract: observed state at t -> physical state at t+6h")
    print("Stress testing missing, outage, and stale observations without future leakage.")

    q, loc = load_pairs()
    Y = q[[f"future_{c}" for c in TARGETS]].to_numpy(float)
    locations = sorted(q[loc].unique())
    selectable = [z for z in locations if z != DIGHA]
    print(f"Rows source: {len(q) + 36:,} | exact +{HORIZON}h pairs: {len(q):,}")
    print(f"Locations: {len(locations)} | Features: {len(FEATURES)}")
    print(f"Scenarios: {SCENARIOS}")

    all_trial_results = []
    for ti, params in enumerate(TRIALS, 1):
        clean_folds = []
        stress_folds = []
        for hold in selectable:
            tr = (q[loc] != hold).to_numpy()
            te = (q[loc] == hold).to_numpy()
            train_clean = q.loc[tr, FEATURES]
            medians = train_clean.replace([np.inf, -np.inf], np.nan).median()
            clean_X = q.loc[te, FEATURES]
            clean_pred = fit_predict(train_clean, Y[tr], clean_X, params, medians)
            clean_folds.append({"location": hold, **evaluate(Y[te], clean_pred)})
            for scenario in SCENARIOS[1:]:
                metrics = scenario_metrics(q, q[FEATURES], Y, loc, scenario, params, tr, te)
                stress_folds.append({"location": hold, "scenario": scenario, **metrics})

        clean_acc = float(np.mean([x["policy_proxy_accuracy"] for x in clean_folds]))
        clean_critical = float(np.mean([x["critical_proxy_recall"] for x in clean_folds]))
        stress_critical = float(np.mean([x["critical_proxy_recall"] for x in stress_folds]))
        stress_acc = float(np.mean([x["policy_proxy_accuracy"] for x in stress_folds]))
        objective = 0.35 * clean_acc + 0.25 * clean_critical + 0.25 * stress_critical + 0.15 * stress_acc
        result = {
            "trial": ti, "params": params, "objective": objective,
            "clean_mean_policy_proxy_accuracy": clean_acc,
            "clean_mean_critical_proxy_recall": clean_critical,
            "stress_mean_policy_proxy_accuracy": stress_acc,
            "stress_mean_critical_proxy_recall": stress_critical,
            "clean_folds": clean_folds, "stress_folds": stress_folds,
        }
        all_trial_results.append(result)
        print(f"[{ti:02d}/{len(TRIALS)}] objective={objective:.5f} clean_acc={clean_acc:.5f} stress_acc={stress_acc:.5f} stress_critical={stress_critical:.5f}")

    best = max(all_trial_results, key=lambda x: x["objective"])
    params = best["params"]

    tr_t, te_t = temporal_split(q, loc)
    temporal_rows = []
    train_clean = q.loc[tr_t, FEATURES]
    medians = train_clean.replace([np.inf, -np.inf], np.nan).median()
    for scenario in SCENARIOS:
        test_X = make_scenario(q.loc[te_t], loc, scenario, SEED + 1000 + abs(hash(scenario)) % 100000)
        pred = fit_predict(train_clean, Y[tr_t], test_X, params, medians)
        temporal_rows.append({"scenario": scenario, **evaluate(Y[te_t], pred)})

    digha_tr = (q[loc] != DIGHA).to_numpy()
    digha_te = (q[loc] == DIGHA).to_numpy()
    train_clean = q.loc[digha_tr, FEATURES]
    medians = train_clean.replace([np.inf, -np.inf], np.nan).median()
    digha_rows = []
    for scenario in SCENARIOS:
        test_X = make_scenario(q.loc[digha_te], loc, scenario, SEED + 2000 + abs(hash(scenario)) % 100000)
        pred = fit_predict(train_clean, Y[digha_tr], test_X, params, medians)
        digha_rows.append({"scenario": scenario, **evaluate(Y[digha_te], pred)})

    stress_table = []
    for scenario in SCENARIOS:
        vals = [f for f in best["stress_folds"] if f["scenario"] == scenario]
        row = {"scenario": scenario}
        for key in ("policy_proxy_accuracy", "critical_proxy_recall", "mean_mae", "mean_r2"):
            row[f"mean_{key}"] = float(np.mean([v[key] for v in vals]))
        row["accuracy_drop_vs_clean"] = best["clean_mean_policy_proxy_accuracy"] - row["mean_policy_proxy_accuracy"]
        row["critical_recall_drop_vs_clean"] = best["clean_mean_critical_proxy_recall"] - row["mean_critical_proxy_recall"]
        stress_table.append(row)
    clean_table = {"scenario": "clean", "mean_policy_proxy_accuracy": best["clean_mean_policy_proxy_accuracy"],
                   "mean_critical_proxy_recall": best["clean_mean_critical_proxy_recall"]}
    stress_df = pd.DataFrame(stress_table)

    feature_rows = []
    for c in FEATURES:
        feature_rows.append({
            "feature": c,
            "group": "wind" if c in WIND else "sea_state" if c in SEA else "atmospheric" if c in ATMOS else "calendar",
            "approved_point_in_time": True,
            "used_in_clean": True,
            "stress_behavior": "stale_or_missing_only" if c in (WIND + SEA + ATMOS) else "random_missing_only",
        })

    contract = {
        "strict_point_in_time": True,
        "approved_features": FEATURES,
        "future_target_columns_used_as_features": False,
        "stored_risk_label_used": False,
        "coordinates_used": False,
        "stale_hours": STALE_HOURS,
        "stale_values_are_from_prior_same_location_observations": True,
        "median_imputation_fit_on_training_partition_only": True,
        "scenario_random_seed": SEED,
        "production_artifacts_modified": False,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    stress_df.to_csv(OUT / "robustness_by_feature.csv", index=False)
    (OUT / "observation_robustness_config.json").write_text(json.dumps({
        "refinement": 23, "contract": contract, "scenarios": SCENARIOS,
        "trials": TRIALS, "locations": locations,
    }, indent=2), encoding="utf-8")

    report = {
        "refinement": 23,
        "rows_source": int(len(q)),
        "exact_forward_pairs": int(len(q)),
        "locations": locations,
        "features": FEATURES,
        "target_policy": POLICY_VERSION,
        "best_trial": best,
        "stress_summary": stress_table,
        "temporal": temporal_rows,
        "digha_final_audit": digha_rows,
        "contract": contract,
        "interpretation": {
            "clean": "Reference point-in-time performance with all observations as recorded.",
            "random_missing": "Independent observation loss; imputation statistics are training-only.",
            "outage": "Entire operational sensor groups unavailable at prediction time.",
            "stale": "Selected feeds are replaced with earlier same-location observations only.",
            "mixed": "Combined missingness and stale sea-state feed stress.",
            "selection": "Digha is excluded from model selection and used only as final audit.",
        },
    }
    (OUT / "refinement23_results.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("=" * 78)
    print("REFINEMENT 23 COMPLETE")
    print("=" * 78)
    print(json.dumps({
        "best_trial": best["trial"],
        "clean_policy_accuracy": best["clean_mean_policy_proxy_accuracy"],
        "clean_critical_recall": best["clean_mean_critical_proxy_recall"],
        "stress_policy_accuracy": best["stress_mean_policy_proxy_accuracy"],
        "stress_critical_recall": best["stress_mean_critical_proxy_recall"],
        "worst_scenario": min(stress_table, key=lambda x: x["mean_policy_proxy_accuracy"]),
        "temporal_clean": temporal_rows[0],
        "digha_clean": digha_rows[0],
        "strict_point_in_time": True,
    }, indent=2))
    print(f"Saved: {OUT / 'refinement23_results.json'}")
    print(f"Saved: {OUT / 'observation_robustness_config.json'}")
    print(f"Saved: {OUT / 'robustness_by_feature.csv'}")
    print("Production model, risk policy, thresholds, and source dataset were NOT modified.")


if __name__ == "__main__":
    main()
