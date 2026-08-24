"""Refinement 4.5: constrained safety threshold selection.

Thresholds are selected ONLY on the temporal calibration block. Digha is never
used for threshold selection. The search requires a useful safety operating point:
- HIGH+EXTREME recall >= 0.90 when feasible
- HIGH+EXTREME precision >= 0.70
- escalation rate <= 0.60
- among feasible points, maximize macro-F1, then HIGH+EXTREME F1
"""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, balanced_accuracy_score
from sklearn.frozen import FrozenEstimator
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier
from config import PROCESSED_DIR, MODELS_DIR, FEATURE_COLUMNS, RISK_HORIZON_HOURS

HOLDOUT_LOCATION = "digha_wb"
RANDOM_STATE = 42
GRID = np.arange(0.30, 0.951, 0.025)
MIN_RECALL = 0.90
MIN_PRECISION = 0.70
MAX_ESCALATION = 0.60


def severity(row):
    vals = lambda names: [float(row[n]) for n in names if pd.notna(row.get(n))]
    w = max(vals(["wind_speed_kts", "wind_gust_kts"]) or [0.0])
    s = max(vals(["wave_height_m", "swell_height_m"]) or [0.0])
    return (3 if w >= 48 else 2 if w >= 34 else 1 if w >= 25 else 0,
            3 if s >= 4 else 2 if s >= 2.5 else 1 if s >= 1.25 else 0)


def policy(row):
    w, s = severity(row)
    if w >= 3 or s >= 3: return 3
    if (w >= 2 and s >= 1) or (s >= 2 and w >= 1): return 3
    if w >= 2 or s >= 2: return 2
    return max(w, s)


def build_features(df):
    cols = list(FEATURE_COLUMNS)
    for c in FEATURE_COLUMNS:
        df[c] = pd.to_numeric(df[c], errors="coerce")
        n = f"{c}_missing"; df[n] = df[c].isna().astype(np.int8); cols.append(n)
    for c, p in [("wind_direction_deg", "wind"), ("wave_direction_deg", "wave"), ("swell_direction_deg", "swell")]:
        r = np.deg2rad(df[c]); df[f"{p}_direction_sin"] = np.sin(r); df[f"{p}_direction_cos"] = np.cos(r)
        cols += [f"{p}_direction_sin", f"{p}_direction_cos"]
    for c in ["wind_speed_kts", "wind_gust_kts", "wave_height_m", "swell_height_m", "air_pressure_hpa"]:
        for h in (3, 6):
            n = f"{c}_delta_{h}h"; df[n] = df.groupby("location_id")[c].diff(h); cols.append(n)
    return cols


def build_target(df):
    future = df[["location_id", "timestamp", "wind_speed_kts", "wind_gust_kts", "wave_height_m", "swell_height_m"]].copy()
    future["risk"] = future.apply(policy, axis=1)
    future["timestamp"] = future["timestamp"] - pd.to_timedelta(int(RISK_HORIZON_HOURS), unit="h")
    return df.merge(future[["location_id", "timestamp", "risk"]], on=["location_id", "timestamp"], how="left").dropna(subset=["risk"])


def decide(proba, high_threshold, extreme_threshold):
    pred = np.argmax(proba, axis=1)
    extreme = proba[:, 3] >= extreme_threshold
    elevated = (proba[:, 2] + proba[:, 3]) >= high_threshold
    pred[elevated] = np.maximum(pred[elevated], 2)
    pred[extreme] = 3
    return pred


def metrics(y, p):
    y = np.asarray(y); p = np.asarray(p)
    actual = (y >= 2).astype(int); predicted = (p >= 2).astype(int)
    return {
        "balanced_accuracy": float(balanced_accuracy_score(y, p)),
        "macro_f1": float(f1_score(y, p, average="macro", zero_division=0)),
        "high_extreme_recall": float(recall_score(actual, predicted, zero_division=0)),
        "high_extreme_precision": float(precision_score(actual, predicted, zero_division=0)),
        "high_extreme_f1": float(f1_score(actual, predicted, zero_division=0)),
        "escalation_rate": float(predicted.mean()),
    }


def main():
    df = pd.read_parquet(PROCESSED_DIR / "orca_historical_marine_risk.parquet")
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values(["location_id", "timestamp"]).copy()
    feature_columns = build_features(df)
    data = build_target(df); data["risk"] = data["risk"].astype(int)
    pool = data[data.location_id != HOLDOUT_LOCATION].sort_values("timestamp")
    digha = data[data.location_id == HOLDOUT_LOCATION]
    n = len(pool); train_end = int(n * .70); val_end = int(n * .85)
    train = pool.iloc[:train_end]; val = pool.iloc[train_end:val_end]
    cal_end = len(val) // 2; cal = val.iloc[:cal_end]; test = val.iloc[cal_end:]
    counts = train.risk.value_counts().sort_index()
    weights = {int(k): float(len(train) / (4 * v)) for k, v in counts.items()}
    model = XGBClassifier(objective="multi:softprob", num_class=4, n_estimators=900, learning_rate=.035, max_depth=6,
                          min_child_weight=8, subsample=.85, colsample_bytree=.85, reg_alpha=.15, reg_lambda=2,
                          gamma=.05, tree_method="hist", eval_metric="mlogloss", random_state=RANDOM_STATE, n_jobs=-1)
    model.fit(train[feature_columns], train.risk, sample_weight=train.risk.map(weights).to_numpy(dtype=np.float32), verbose=False)
    calibrated = CalibratedClassifierCV(FrozenEstimator(model), method="sigmoid")
    calibrated.fit(cal[feature_columns], cal.risk)
    p_cal = calibrated.predict_proba(cal[feature_columns]); p_test = calibrated.predict_proba(test[feature_columns]); p_digha = calibrated.predict_proba(digha[feature_columns])

    candidates = []
    for ht in GRID:
        for et in GRID:
            if et < ht: continue
            m = metrics(cal.risk.to_numpy(), decide(p_cal, ht, et))
            feasible = (m["high_extreme_recall"] >= MIN_RECALL and m["high_extreme_precision"] >= MIN_PRECISION and m["escalation_rate"] <= MAX_ESCALATION)
            distance = (max(0, MIN_RECALL - m["high_extreme_recall"]) + max(0, MIN_PRECISION - m["high_extreme_precision"]) + max(0, m["escalation_rate"] - MAX_ESCALATION))
            candidates.append({"high_threshold": float(ht), "extreme_threshold": float(et), "feasible": feasible, "constraint_distance": float(distance), **m})

    feasible = [x for x in candidates if x["feasible"]]
    if feasible:
        best = max(feasible, key=lambda x: (x["macro_f1"], x["high_extreme_f1"], -x["escalation_rate"], x["high_extreme_recall"]))
        selection_mode = "constrained_feasible"
    else:
        best = min(candidates, key=lambda x: (x["constraint_distance"], -x["macro_f1"], -x["high_extreme_f1"], x["escalation_rate"]))
        selection_mode = "closest_to_constraints_no_fully_feasible_point"

    ht, et = best["high_threshold"], best["extreme_threshold"]
    result = {
        "risk_policy": "small_craft_conservative",
        "prediction_horizon_hours": int(RISK_HORIZON_HOURS),
        "constraints": {"minimum_high_extreme_recall": MIN_RECALL, "minimum_high_extreme_precision": MIN_PRECISION, "maximum_escalation_rate": MAX_ESCALATION},
        "selection_mode": selection_mode,
        "selected_thresholds": {"high_plus_extreme_probability": ht, "extreme_probability": et},
        "calibration_block_metrics": best,
        "temporal_test_metrics": metrics(test.risk.to_numpy(), decide(p_test, ht, et)),
        "digha_holdout_metrics": metrics(digha.risk.to_numpy(), decide(p_digha, ht, et)),
        "feasible_candidate_count": len(feasible),
        "note": "Thresholds were selected only on the temporal calibration block. Digha was reserved for final spatial evaluation and did not influence selection."
    }
    out = MODELS_DIR / "safety_threshold_optimization.json"; out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print("Selection mode:", selection_mode)
    print("Constraints:", result["constraints"])
    print("Selected thresholds:", result["selected_thresholds"])
    print("Calibration block:", result["calibration_block_metrics"])
    print("Temporal test:", result["temporal_test_metrics"])
    print("Digha:", result["digha_holdout_metrics"])
    print("Feasible candidates:", len(feasible))
    print(f"Saved threshold optimization: {out}")

if __name__ == "__main__": main()
