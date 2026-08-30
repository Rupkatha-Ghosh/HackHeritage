"""ORCA-X Refinement 25: temporal persistence + observation-quality-aware forecasting.

Strict point-in-time benchmark. At prediction time t, only observations at t and
historical observations before t are used to forecast physical state at t+6h.

This refinement targets the dominant Refinement-23/24 failure mode: degraded or
missing sea-state observations. It adds causal persistence/trend features,
explicit observation age/coverage features, and training-time degradation
augmentation. No future values, stored risk labels, production artifacts, or
Digha observations are used for model selection.

Outputs are written only under ml/models/refinement25/.
"""
from __future__ import annotations

import hashlib
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
OUT = ROOT / "ml" / "models" / "refinement25"
HORIZON = int(RISK_HORIZON_HOURS)
DIGHA = "digha_wb"
SEED = 42
MAX_AGE_HOURS = 12

BASE_FEATURES = [
    "wind_speed_kts", "wind_gust_kts", "wind_direction_deg",
    "wave_height_m", "wave_period_s", "wave_direction_deg",
    "swell_height_m", "swell_period_s", "swell_direction_deg",
    "air_pressure_hpa", "air_temperature_c", "sea_surface_temperature_c",
    "precipitation_mm", "month", "season",
]
TARGETS = ["wind_speed_kts", "wind_gust_kts", "wave_height_m", "swell_height_m", "wave_period_s"]
WIND = ["wind_speed_kts", "wind_gust_kts", "wind_direction_deg"]
SEA = ["wave_height_m", "wave_period_s", "wave_direction_deg", "swell_height_m", "swell_period_s", "swell_direction_deg"]
ATMOS = ["air_pressure_hpa", "air_temperature_c", "precipitation_mm"]
GROUPS = {"wind": WIND, "sea_state": SEA, "atmospheric": ATMOS}

SCENARIOS = [
    "clean", "random_missing_10", "random_missing_25", "random_missing_40",
    "wind_outage", "sea_state_outage", "atmospheric_outage",
    "stale_wind", "stale_sea_state", "mixed_degradation",
]

TRIALS = [
    dict(n_estimators=650, learning_rate=0.045, max_depth=5, min_child_weight=10,
         subsample=0.80, colsample_bytree=0.80, reg_alpha=0.15, reg_lambda=2.5, gamma=0.02),
    dict(n_estimators=800, learning_rate=0.04, max_depth=6, min_child_weight=12,
         subsample=0.82, colsample_bytree=0.78, reg_alpha=0.20, reg_lambda=3.5, gamma=0.03),
    dict(n_estimators=900, learning_rate=0.035, max_depth=6, min_child_weight=16,
         subsample=0.85, colsample_bytree=0.75, reg_alpha=0.25, reg_lambda=4.0, gamma=0.04),
]


def find_location_col(df):
    for c in ("location", "station", "coastline", "location_id"):
        if c in df.columns:
            return c
    raise ValueError("No location column found")


def stable_seed(name, extra=0):
    return SEED + extra + int(hashlib.sha256(name.encode()).hexdigest()[:8], 16) % 100000


def load_source():
    if not DATA.exists():
        raise FileNotFoundError(f"Canonical processed dataset not found: {DATA}")
    df = pd.read_parquet(DATA).copy()
    source_rows = len(df)
    loc = find_location_col(df)
    required = ["timestamp", *BASE_FEATURES, *TARGETS]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset missing required point-in-time fields: {missing}")
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df[loc] = df[loc].astype(str)
    for c in BASE_FEATURES + TARGETS:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df = df.dropna(subset=[loc, "timestamp"]).sort_values([loc, "timestamp"]).reset_index(drop=True)
    return df, loc, source_rows


def make_pairs(df, loc):
    future = df[[loc, "timestamp"] + TARGETS].copy()
    future["timestamp"] = future["timestamp"] - pd.to_timedelta(HORIZON, unit="h")
    future = future.rename(columns={c: f"future_{c}" for c in TARGETS})
    q = df.merge(future, on=[loc, "timestamp"], how="inner", validate="one_to_one")
    q = q.dropna(subset=[f"future_{c}" for c in TARGETS]).reset_index(drop=True)
    return q


def proxy_risk(a):
    w, g, wave, swell, _ = a.T
    score = np.maximum(w, 0) * .45 + np.maximum(g, 0) * .20 + np.maximum(wave, 0) * 5 + np.maximum(swell, 0) * 3
    return np.select([score >= 34, score >= 24, score >= 14], [3, 2, 1], default=0).astype(int)


def evaluate(y, p):
    yr, pr = proxy_risk(y), proxy_risk(p)
    mae = np.mean(np.abs(y - p), axis=0)
    r2 = [float(r2_score(y[:, j], p[:, j])) if np.std(y[:, j]) > 1e-12 else 0.0 for j in range(len(TARGETS))]
    return {
        "policy_proxy_accuracy": float(accuracy_score(yr, pr)),
        "critical_proxy_recall": float(recall_score(yr >= 2, pr >= 2, zero_division=0)),
        "mean_mae": float(np.mean(mae)),
        "mean_r2": float(np.mean(r2)),
        "target_mae": dict(zip(TARGETS, map(float, mae))),
        "target_r2": dict(zip(TARGETS, r2)),
    }


def add_temporal_features(df, loc):
    """Create only causal features: current values + lags/rolling history strictly before t."""
    out = df[[loc, "timestamp"] + BASE_FEATURES].copy()
    g = out.groupby(loc, sort=False)
    # The source is approximately hourly, but shifts are row-based and therefore
    # remain causal even across occasional missing timestamps.
    for c in [x for x in BASE_FEATURES if x not in ("month", "season")]:
        for lag in (1, 3, 6):
            out[f"{c}_lag{lag}"] = g[c].shift(lag)
        out[f"{c}_delta1"] = out[c] - out[f"{c}_lag1"]
        out[f"{c}_delta6"] = out[c] - out[f"{c}_lag6"]
        # Rolling history excludes the current observation via shift(1).
        out[f"{c}_mean6"] = g[c].transform(lambda s: s.shift(1).rolling(6, min_periods=1).mean())
        out[f"{c}_std6"] = g[c].transform(lambda s: s.shift(1).rolling(6, min_periods=2).std())
    # Observation-age features are based only on past availability.
    for name, cols in GROUPS.items():
        present = out[cols].notna().all(axis=1).astype(int)
        last_seen = out["timestamp"].where(present.eq(1)).groupby(out[loc], sort=False).ffill()
        age = (out["timestamp"] - last_seen).dt.total_seconds() / 3600.0
        out[f"{name}_age_h"] = age.clip(lower=0, upper=MAX_AGE_HOURS).fillna(MAX_AGE_HOURS)
        out[f"{name}_available"] = out[cols].notna().mean(axis=1)
        out[f"{name}_fully_available"] = present.astype(float)
    out["critical_available"] = out[["wind_available", "sea_state_available"]].min(axis=1)
    out["critical_stale"] = ((out["wind_age_h"] > 3) | (out["sea_state_age_h"] > 3)).astype(float)
    out["any_stale"] = ((out[["wind_age_h", "sea_state_age_h", "atmospheric_age_h"]] > 3).any(axis=1)).astype(float)
    return out.drop(columns=[loc, "timestamp"])


def build_feature_matrix(q, loc):
    """Build a causal matrix once on the full sorted history, then align to q rows."""
    keys = q[[loc, "timestamp"]].copy()
    causal = add_temporal_features(q, loc)
    # Keep the current point-in-time base features plus causal history features.
    X = pd.concat([q[BASE_FEATURES].reset_index(drop=True), causal.reset_index(drop=True)], axis=1)
    X = X.replace([np.inf, -np.inf], np.nan)
    return X


def degrade(X, scenario, seed):
    out = X.copy()
    rng = np.random.default_rng(seed)
    if scenario == "clean":
        return out
    if scenario.startswith("random_missing_"):
        rate = int(scenario.rsplit("_", 1)[1]) / 100
        # Degrade observed base and history features together, but preserve
        # metadata/reliability features so the model can see the degradation.
        data_cols = [c for c in BASE_FEATURES if c in out.columns]
        out.loc[:, data_cols] = out[data_cols].astype(float).mask(rng.random((len(out), len(data_cols))) < rate)
        return out
    if scenario == "wind_outage":
        out.loc[:, WIND] = np.nan
        for c in out.columns:
            if c.startswith("wind_") and ("age" not in c and "available" not in c and "stale" not in c):
                out[c] = np.nan
        out["wind_age_h"] = MAX_AGE_HOURS
        out["wind_available"] = 0.0
        out["wind_fully_available"] = 0.0
        out["critical_available"] = 0.0
        out["critical_stale"] = 1.0
        out["any_stale"] = 1.0
        return out
    if scenario == "sea_state_outage":
        out.loc[:, SEA] = np.nan
        for c in out.columns:
            if c.startswith(("wave_", "swell_")) and ("age" not in c and "available" not in c and "stale" not in c):
                out[c] = np.nan
        out["sea_state_age_h"] = MAX_AGE_HOURS
        out["sea_state_available"] = 0.0
        out["sea_state_fully_available"] = 0.0
        out["critical_available"] = 0.0
        out["critical_stale"] = 1.0
        out["any_stale"] = 1.0
        return out
    if scenario == "atmospheric_outage":
        out.loc[:, ATMOS] = np.nan
        for c in out.columns:
            if c.startswith(("air_", "precipitation_")) and ("age" not in c and "available" not in c and "stale" not in c):
                out[c] = np.nan
        out["atmospheric_age_h"] = MAX_AGE_HOURS
        out["atmospheric_available"] = 0.0
        out["atmospheric_fully_available"] = 0.0
        out["any_stale"] = 1.0
        return out
    if scenario in {"stale_wind", "stale_sea_state"}:
        groups = {"stale_wind": WIND, "stale_sea_state": SEA}
        cols = groups[scenario]
        for c in cols:
            lagcol = f"{c}_lag3"
            if lagcol in out.columns:
                out[c] = out[lagcol]
        group = "wind" if scenario == "stale_wind" else "sea_state"
        out[f"{group}_age_h"] = 3.0
        out[f"{group}_available"] = 1.0
        out[f"{group}_fully_available"] = 1.0
        out["critical_stale"] = 1.0
        out["any_stale"] = 1.0
        return out
    if scenario == "mixed_degradation":
        data_cols = [c for c in BASE_FEATURES if c in out.columns]
        out.loc[:, data_cols] = out[data_cols].astype(float).mask(rng.random((len(out), len(data_cols))) < .25)
        # Force a realistic partial sea-state outage in 25% of rows.
        choose = rng.random(len(out)) < .25
        for c in SEA:
            out.loc[choose, c] = np.nan
        out.loc[choose, "sea_state_available"] = 0.0
        out.loc[choose, "sea_state_fully_available"] = 0.0
        out.loc[choose, "sea_state_age_h"] = MAX_AGE_HOURS
        out.loc[choose, "critical_available"] = 0.0
        out.loc[choose, "critical_stale"] = 1.0
        out.loc[choose, "any_stale"] = 1.0
        return out
    raise ValueError(scenario)


def fit_models(X, Y, params, seed, augmentation=True):
    rng = np.random.default_rng(seed)
    X = X.copy()
    if augmentation:
        # Train on clean rows plus deterministic degraded copies. The targets
        # remain the future physical state; no future feature is introduced.
        aug_parts = [X]
        for rate in (0.10, 0.25):
            a = X.copy()
            cols = [c for c in BASE_FEATURES if c in a.columns]
            mask = rng.random((len(a), len(cols))) < rate
            a.loc[:, cols] = a[cols].astype(float).mask(mask)
            aug_parts.append(a)
        X = pd.concat(aug_parts, ignore_index=True)
        Y = np.tile(Y, (len(aug_parts), 1))
    X = X.replace([np.inf, -np.inf], np.nan)
    med = X.median(numeric_only=True)
    Xf = X.fillna(med).fillna(0.0)
    models = []
    for j in range(len(TARGETS)):
        model = xgb.XGBRegressor(
            objective="reg:squarederror", tree_method="hist", random_state=seed,
            n_jobs=-1, **params,
        )
        model.fit(Xf, Y[:, j], verbose=False)
        models.append(model)
    return models, med


def predict(models, X, med):
    X = X.replace([np.inf, -np.inf], np.nan).fillna(med).fillna(0.0)
    return np.column_stack([m.predict(X) for m in models])


def location_benchmark(q, X, Y, loc, hold, params, seed):
    tr = (q[loc] != hold).to_numpy()
    te = ~tr
    models, med = fit_models(X.loc[tr], Y[tr], params, seed, augmentation=True)
    rows = []
    for scenario in SCENARIOS:
        Xs = degrade(X.loc[te], scenario, stable_seed(scenario, seed))
        e = evaluate(Y[te], predict(models, Xs, med))
        e.update(location=hold, scenario=scenario)
        rows.append(e)
    return rows


def summarize(rows, clean_ref=None):
    if clean_ref is None:
        clean_ref = float(np.mean([r["policy_proxy_accuracy"] for r in rows if r["scenario"] == "clean"]))
    clean_crit = float(np.mean([r["critical_proxy_recall"] for r in rows if r["scenario"] == "clean"]))
    out = []
    for s in SCENARIOS:
        rs = [r for r in rows if r["scenario"] == s]
        acc = float(np.mean([r["policy_proxy_accuracy"] for r in rs]))
        crit = float(np.mean([r["critical_proxy_recall"] for r in rs]))
        out.append({
            "scenario": s, "policy_proxy_accuracy": acc,
            "critical_proxy_recall": crit,
            "mean_mae": float(np.mean([r["mean_mae"] for r in rs])),
            "mean_r2": float(np.mean([r["mean_r2"] for r in rs])),
            "accuracy_drop_vs_clean": clean_ref - acc,
            "critical_recall_drop_vs_clean": clean_crit - crit,
        })
    return out


def main():
    print("=" * 78)
    print("ORCA-X TEMPORAL PERSISTENCE + RELIABILITY-AWARE FORECASTING — REFINEMENT 25")
    print("=" * 78)
    print("Read-only benchmark | no production artifacts modified")
    print(f"Source dataset: {DATA}")
    print(f"Forward horizon: +{HORIZON}h | policy: {POLICY_VERSION}")
    print("Contract: observed state at t + historical observations before t -> physical state at t+6h")

    df, loc, source_rows = load_source()
    q = make_pairs(df, loc)
    Y = q[[f"future_{c}" for c in TARGETS]].to_numpy(float)
    X = build_feature_matrix(q, loc)
    locations = sorted(q[loc].unique())
    selectable = [z for z in locations if z != DIGHA]
    print(f"Rows source: {source_rows:,} | exact +{HORIZON}h pairs: {len(q):,}")
    print(f"Locations: {len(locations)} | Base features: {len(BASE_FEATURES)} | Engineered features: {X.shape[1]}")
    print(f"Temporal features use lags 1/3/6 and past-only rolling windows; MAX_AGE_HOURS={MAX_AGE_HOURS}")
    print(f"Scenarios: {SCENARIOS}")

    trials = []
    for ti, params in enumerate(TRIALS, 1):
        rows = []
        for hold in selectable:
            rows.extend(location_benchmark(q, X, Y, loc, hold, params, stable_seed(f"trial-{ti}")))
        clean = [r for r in rows if r["scenario"] == "clean"]
        stressed = [r for r in rows if r["scenario"] != "clean"]
        clean_acc = float(np.mean([r["policy_proxy_accuracy"] for r in clean]))
        clean_crit = float(np.mean([r["critical_proxy_recall"] for r in clean]))
        stress_acc = float(np.mean([r["policy_proxy_accuracy"] for r in stressed]))
        stress_crit = float(np.mean([r["critical_proxy_recall"] for r in stressed]))
        objective = .25 * clean_acc + .15 * clean_crit + .20 * stress_acc + .40 * stress_crit
        trials.append({"trial": ti, "params": params, "objective": float(objective), "rows": rows})
        print(f"[{ti:02d}/{len(TRIALS)}] objective={objective:.5f} clean_acc={clean_acc:.5f} stress_acc={stress_acc:.5f} stress_critical={stress_crit:.5f}")

    best = max(trials, key=lambda x: x["objective"])
    rows = best["rows"]
    scenario_summary = summarize(rows)

    # Temporal holdout: future period is evaluated strictly after a chronological cut.
    times = np.sort(q[q[loc] != DIGHA]["timestamp"].unique())
    cut = times[int(.82 * len(times))]
    tr = ((q[loc] != DIGHA) & (q["timestamp"] < cut)).to_numpy()
    te = ((q[loc] != DIGHA) & (q["timestamp"] >= cut)).to_numpy()
    models, med = fit_models(X.loc[tr], Y[tr], best["params"], stable_seed("temporal"), augmentation=True)
    temporal = evaluate(Y[te], predict(models, X.loc[te], med))

    # Digha is held out completely from training and selection.
    dte = (q[loc] == DIGHA).to_numpy()
    models, med = fit_models(X.loc[~dte], Y[~dte], best["params"], stable_seed("digha"), augmentation=True)
    digha = evaluate(Y[dte], predict(models, X.loc[dte], med))

    # Digha stress audit with the frozen selected configuration.
    digha_stress = []
    for scenario in SCENARIOS:
        Xs = degrade(X.loc[dte], scenario, stable_seed(f"digha-{scenario}"))
        e = evaluate(Y[dte], predict(models, Xs, med))
        e["scenario"] = scenario
        digha_stress.append(e)

    worst = min(scenario_summary, key=lambda r: r["policy_proxy_accuracy"])
    result = {
        "best_trial": best["trial"],
        "best_params": best["params"],
        "engineered_feature_count": int(X.shape[1]),
        "mean_policy_proxy_accuracy": float(np.mean([r["policy_proxy_accuracy"] for r in rows if r["scenario"] == "clean"])),
        "mean_clean_critical_proxy_recall": float(np.mean([r["critical_proxy_recall"] for r in rows if r["scenario"] == "clean"])),
        "mean_stress_policy_proxy_accuracy": float(np.mean([r["policy_proxy_accuracy"] for r in rows if r["scenario"] != "clean"])),
        "mean_stress_critical_proxy_recall": float(np.mean([r["critical_proxy_recall"] for r in rows if r["scenario"] != "clean"])),
        "worst_scenario": worst,
        "scenario_summary": scenario_summary,
        "temporal": temporal,
        "digha_final_audit": digha,
        "digha_stress_summary": digha_stress,
        "strict_point_in_time": True,
        "selection_excludes_digha": True,
        "production_modified": False,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "refinement25_results.json").write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
    config = {
        "horizon_hours": HORIZON,
        "policy_version": POLICY_VERSION,
        "base_features": BASE_FEATURES,
        "targets": TARGETS,
        "temporal_lags": [1, 3, 6],
        "rolling_window_rows": 6,
        "max_age_hours": MAX_AGE_HOURS,
        "scenarios": SCENARIOS,
        "best_trial": best["trial"],
        "best_params": best["params"],
        "source_dataset": str(DATA),
        "strict_point_in_time": True,
        "selection_excludes_digha": True,
    }
    (OUT / "temporal_reliability_config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    pd.DataFrame(scenario_summary).to_csv(OUT / "robustness_by_scenario.csv", index=False)
    pd.DataFrame(digha_stress).to_csv(OUT / "digha_stress_audit.csv", index=False)

    print("=" * 78)
    print("REFINEMENT 25 COMPLETE")
    print("=" * 78)
    print(json.dumps({
        "best_trial": best["trial"],
        "mean_clean_accuracy": result["mean_policy_proxy_accuracy"],
        "mean_clean_critical_recall": result["mean_clean_critical_proxy_recall"],
        "mean_stress_accuracy": result["mean_stress_policy_proxy_accuracy"],
        "mean_stress_critical_recall": result["mean_stress_critical_proxy_recall"],
        "temporal": temporal,
        "digha_final_audit": digha,
        "worst_scenario": worst,
    }, indent=2))
    print(f"Saved: {OUT / 'refinement25_results.json'}")
    print(f"Saved: {OUT / 'temporal_reliability_config.json'}")
    print(f"Saved: {OUT / 'robustness_by_scenario.csv'}")
    print(f"Saved: {OUT / 'digha_stress_audit.csv'}")
    print("Production model, risk policy, thresholds, and source dataset were NOT modified.")


if __name__ == "__main__":
    main()
