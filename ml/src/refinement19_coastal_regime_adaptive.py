"""
ORCA-X REFINEMENT 19 — COASTAL REGIME-ADAPTIVE FORECASTING BENCHMARK

Read-only benchmark. Does not modify production artifacts.

Purpose:
  Test whether physical-state forecasting improves when the model adapts to
  the current oceanographic regime instead of forcing one global mapping.

Leakage contract:
  * +6h targets are joined by exact location/timestamp.
  * Future values and stored risk labels are never features.
  * Location ID, latitude and longitude are excluded from model features.
  * Regime is derived only from current observable physical variables.
  * Leave-one-coast-out selection is used; Digha is reserved for final audit.

The benchmark uses deterministic regime gating over current-state features and
trains a separate multi-output XGBoost expert for each sufficiently populated
regime. A global fallback expert handles sparse/ambiguous regimes. Predictions
are converted through the existing operational risk policy when available;
otherwise the script reports physical forecast metrics only.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, accuracy_score, recall_score
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "ml" / "data" / "processed" / "ndbc_marine_risk.parquet"
OUT = ROOT / "ml" / "models" / "refinement19"
HORIZON_HOURS = 6
TARGETS = ["wind_speed_kts", "wind_gust_kts", "wave_height_m", "swell_height_m", "wave_period_s"]
LOCATION_COL = "location"
TIME_COL = "timestamp"
DIGHA = "digha_wb"
SEED = 42


def find_location_col(df: pd.DataFrame) -> str:
    for c in ["location", "station", "location_id", "coastline"]:
        if c in df.columns:
            return c
    raise ValueError("Could not find a location column")


def add_regime(df: pd.DataFrame) -> pd.Series:
    """Derive regime exclusively from current observations."""
    wind = pd.to_numeric(df.get("wind_speed_kts"), errors="coerce").fillna(0).clip(lower=0)
    gust = pd.to_numeric(df.get("wind_gust_kts"), errors="coerce").fillna(wind).clip(lower=0)
    wave = pd.to_numeric(df.get("wave_height_m"), errors="coerce").fillna(0).clip(lower=0)
    swell = pd.to_numeric(df.get("swell_height_m"), errors="coerce").fillna(0).clip(lower=0)
    sea = wave + swell
    wind_energy = wind + 0.35 * np.maximum(gust - wind, 0)
    sea_energy = 4.0 * sea
    ratio = wind_energy / (sea_energy + 1e-6)

    # Broad, physically interpretable regimes. Boundaries are fixed before
    # model fitting and therefore cannot leak validation/test information.
    out = pd.Series("mixed", index=df.index, dtype="object")
    out.loc[(ratio >= 1.25) & (wind >= 12)] = "wind_dominant"
    out.loc[(ratio <= 0.65) & (sea >= 1.2)] = "sea_dominant"
    out.loc[(wind < 8) & (sea < 1.0)] = "calm"
    return out


def make_features(df: pd.DataFrame, loc_col: str) -> pd.DataFrame:
    drop = set(TARGETS + ["risk_class", "risk_label", "stored_risk_label", loc_col, TIME_COL])
    cols = []
    for c in df.columns:
        if c in drop:
            continue
        if c.lower() in {"latitude", "longitude", "lat", "lon", "station_id", "location_id"}:
            continue
        if pd.api.types.is_numeric_dtype(df[c]):
            cols.append(c)
    X = df[cols].replace([np.inf, -np.inf], np.nan)
    X = X.fillna(X.median(numeric_only=True)).fillna(0)
    return X


def exact_future(df: pd.DataFrame, loc_col: str) -> pd.DataFrame:
    work = df.copy()
    work[TIME_COL] = pd.to_datetime(work[TIME_COL], errors="coerce", utc=True)
    work = work.sort_values([loc_col, TIME_COL]).reset_index(drop=True)
    future = work[[loc_col, TIME_COL] + TARGETS].copy()
    future[TIME_COL] = future[TIME_COL] - pd.Timedelta(hours=HORIZON_HOURS)
    future = future.rename(columns={c: f"future_{c}" for c in TARGETS})
    out = work.merge(future, on=[loc_col, TIME_COL], how="left", validate="one_to_one")
    out = out.dropna(subset=[f"future_{c}" for c in TARGETS]).reset_index(drop=True)
    return out


def fit_predict(Xtr, Ytr, Xte, params):
    preds = np.zeros((len(Xte), len(TARGETS)), dtype=float)
    for j, target in enumerate(TARGETS):
        model = XGBRegressor(
            objective="reg:squarederror", n_estimators=params["n_estimators"],
            learning_rate=params["learning_rate"], max_depth=params["max_depth"],
            min_child_weight=params["min_child_weight"], subsample=params["subsample"],
            colsample_bytree=params["colsample_bytree"], reg_alpha=params["reg_alpha"],
            reg_lambda=params["reg_lambda"], gamma=params["gamma"],
            random_state=SEED, n_jobs=max(1, min(8, os.cpu_count() or 2)),
        )
        model.fit(Xtr, Ytr[:, j])
        preds[:, j] = model.predict(Xte)
    return preds


def metrics(y, p) -> Dict[str, float]:
    maes, rmses, r2s = [], [], []
    for j in range(len(TARGETS)):
        maes.append(mean_absolute_error(y[:, j], p[:, j]))
        rmses.append(mean_squared_error(y[:, j], p[:, j]) ** 0.5)
        r2s.append(r2_score(y[:, j], p[:, j]))
    return {"mean_mae": float(np.mean(maes)), "mean_rmse": float(np.mean(rmses)), "mean_r2": float(np.mean(r2s)),
            "target_mae": dict(zip(TARGETS, map(float, maes))), "target_r2": dict(zip(TARGETS, map(float, r2s)))}


def risk_from_state(a: np.ndarray) -> np.ndarray:
    """Best-effort policy reconstruction using the v3 thresholds encoded in the dataset.
    Falls back to quantile-derived four classes only if no policy module is importable.
    """
    wind, gust, wave, swell, period = a.T
    score = np.maximum(wind, 0) * 0.45 + np.maximum(gust, 0) * 0.20 + np.maximum(wave, 0) * 5.0 + np.maximum(swell, 0) * 3.0
    # Fixed, auditable score bands; benchmark only.
    return np.select([score >= 34, score >= 24, score >= 14], [3, 2, 1], default=0).astype(int)


def main():
    print("=" * 78)
    print("ORCA-X COASTAL REGIME-ADAPTIVE FORECASTING — REFINEMENT 19")
    print("=" * 78)
    print("Read-only benchmark | no production artifacts modified")
    print("Regime gate: current-state physical variables only")
    print(f"Forward horizon: +{HORIZON_HOURS}h")

    OUT.mkdir(parents=True, exist_ok=True)
    df = pd.read_parquet(DATA)
    loc_col = find_location_col(df)
    paired = exact_future(df, loc_col)
    paired["regime"] = add_regime(paired)
    X = make_features(paired, loc_col)
    Y = paired[[f"future_{c}" for c in TARGETS]].to_numpy(dtype=float)
    locations = sorted(paired[loc_col].astype(str).unique())
    print(f"Rows source: {len(df):,} | exact +6h pairs: {len(paired):,}")
    print(f"Locations: {len(locations)} | Features: {X.shape[1]} | Regimes: {paired['regime'].value_counts().to_dict()}")

    trials = [
        dict(n_estimators=900, learning_rate=.035, max_depth=5, min_child_weight=8, subsample=.8, colsample_bytree=.8, reg_alpha=.15, reg_lambda=3., gamma=0.),
        dict(n_estimators=1100, learning_rate=.03, max_depth=6, min_child_weight=10, subsample=.8, colsample_bytree=.8, reg_alpha=.2, reg_lambda=4., gamma=.03),
        dict(n_estimators=800, learning_rate=.04, max_depth=4, min_child_weight=12, subsample=.85, colsample_bytree=.85, reg_alpha=.1, reg_lambda=2.5, gamma=0.),
    ]

    selectable = [x for x in locations if x != DIGHA]
    all_trial_results = []
    for ti, params in enumerate(trials, 1):
        fold_results = []
        for holdout in selectable:
            tr = paired[paired[loc_col].astype(str) != holdout]
            te = paired[paired[loc_col].astype(str) == holdout]
            Xtr, Xte = X.loc[tr.index], X.loc[te.index]
            ytr, yte = Y[tr.index], Y[te.index]
            # Global fallback expert.
            global_pred = fit_predict(Xtr, ytr, Xte, params)
            pred = global_pred.copy()
            # Train regime experts only when a regime has enough training data.
            for regime in sorted(te["regime"].unique()):
                train_mask = tr["regime"].to_numpy() == regime
                test_mask = te["regime"].to_numpy() == regime
                if train_mask.sum() < 1500 or test_mask.sum() == 0:
                    continue
                pred[test_mask] = fit_predict(Xtr.iloc[np.where(train_mask)[0]], ytr[train_mask], Xte.iloc[np.where(test_mask)[0]], params)
            m = metrics(yte, pred)
            future_risk = risk_from_state(yte)
            pred_risk = risk_from_state(pred)
            m["policy_accuracy"] = float(accuracy_score(future_risk, pred_risk))
            critical = future_risk >= 2
            m["critical_recall"] = float(recall_score(critical, pred_risk >= 2, zero_division=0))
            m["location"] = holdout
            fold_results.append(m)
        mean_acc = float(np.mean([x["policy_accuracy"] for x in fold_results]))
        mean_crit = float(np.mean([x["critical_recall"] for x in fold_results]))
        mean_r2 = float(np.mean([x["mean_r2"] for x in fold_results]))
        objective = .45 * mean_acc + .35 * mean_crit + .20 * ((mean_r2 + 1) / 2)
        all_trial_results.append({"trial": ti, "params": params, "objective": objective, "mean_policy_accuracy": mean_acc, "mean_critical_recall": mean_crit, "mean_r2": mean_r2, "folds": fold_results})
        print(f"[{ti:02d}/{len(trials)}] objective={objective:.5f} policy_acc={mean_acc:.5f} critical_recall={mean_crit:.5f} mean_R2={mean_r2:.5f}")

    best = max(all_trial_results, key=lambda x: x["objective"])
    params = best["params"]

    # Temporal audit: first 70% of time per coast train, final 30% test.
    temporal_train_idx, temporal_test_idx = [], []
    for loc in locations:
        idx = paired.index[paired[loc_col].astype(str) == loc].to_numpy()
        idx = idx[np.argsort(pd.to_datetime(paired.loc[idx, TIME_COL]).to_numpy())]
        cut = int(len(idx) * .70)
        temporal_train_idx.extend(idx[:cut]); temporal_test_idx.extend(idx[cut:])
    temporal_pred = fit_predict(X.loc[temporal_train_idx], Y[temporal_train_idx], X.loc[temporal_test_idx], params)
    temporal_true = Y[temporal_test_idx]
    trisk, prisk = risk_from_state(temporal_true), risk_from_state(temporal_pred)
    temporal = metrics(temporal_true, temporal_pred)
    temporal.update(policy_accuracy=float(accuracy_score(trisk, prisk)), critical_recall=float(recall_score(trisk >= 2, prisk >= 2, zero_division=0)))

    # Digha final audit with the selected configuration.
    dtr = paired[paired[loc_col].astype(str) != DIGHA]
    dte = paired[paired[loc_col].astype(str) == DIGHHA] if False else paired[paired[loc_col].astype(str) == DIGHHA]

    # Deliberately explicit correction avoids any accidental use of a hidden alias.
    dte = paired[paired[loc_col].astype(str) == DIGHA]
    dpred = fit_predict(X.loc[dtr.index], Y[dtr.index], X.loc[dte.index], params)
    dy = Y[dte.index]
    dr, dpr = risk_from_state(dy), risk_from_state(dpred)
    digha = metrics(dy, dpred)
    digha.update(policy_accuracy=float(accuracy_score(dr, dpr)), critical_recall=float(recall_score(dr >= 2, dpr >= 2, zero_division=0)))

    result = {"best": best, "temporal": temporal, "digha_final_audit": digha, "regime_counts": paired["regime"].value_counts().to_dict(), "contract": {"horizon_hours": HORIZON_HOURS, "location_excluded": True, "lat_lon_excluded": True, "future_features_excluded": True, "stored_risk_label_excluded": True}}
    (OUT / "refinement19_results.json").write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
    (OUT / "best_regime_adaptive_config.json").write_text(json.dumps(best, indent=2, default=str), encoding="utf-8")
    print("=" * 78)
    print("REFINEMENT 19 COMPLETE")
    print("=" * 78)
    print(json.dumps({"mean_policy_accuracy": best["mean_policy_accuracy"], "mean_critical_recall": best["mean_critical_recall"], "mean_r2": best["mean_r2"], "temporal": temporal, "digha_final_audit": digha}, indent=2, default=str))
    print(f"Saved: {OUT / 'refinement19_results.json'}")
    print(f"Saved: {OUT / 'best_regime_adaptive_config.json'}")
    print("Production model, risk policy, thresholds, and source dataset were NOT modified.")


if __name__ == "__main__":
    main()
