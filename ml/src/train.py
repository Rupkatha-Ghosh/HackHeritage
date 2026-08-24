"""Train ORCA-X with a leakage-audited forward marine-risk target and dynamic features."""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, confusion_matrix, f1_score
from config import DATASET_NAME, DATASET_VERSION, FEATURE_COLUMNS, MODELS_DIR, PROCESSED_DIR, RISK_CLASS_NAMES, TARGET_COLUMN, RISK_HORIZON_HOURS
from label_policy import assign_operational_risk

RANDOM_STATE = 42
HOLDOUT_LOCATION = "digha_wb"
RISK_ORDER = [RISK_CLASS_NAMES[i] for i in range(4)]


def load_dataset() -> pd.DataFrame:
    path = PROCESSED_DIR / "orca_historical_marine_risk.parquet"
    if not path.exists():
        raise FileNotFoundError("Run download_historical_marine.py and prepare_dataset.py first.")
    df = pd.read_parquet(path)
    required = ["location_id", "timestamp", *FEATURE_COLUMNS, TARGET_COLUMN]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")
    for c in FEATURE_COLUMNS:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df = df.dropna(subset=["location_id", "timestamp"]).sort_values(["location_id", "timestamp"]).copy()
    duplicates = int(df.duplicated(["location_id", "timestamp"]).sum())
    if duplicates:
        raise ValueError(f"Duplicate location/timestamp rows detected: {duplicates}")

    # The stored contemporaneous risk_class is deliberately ignored. Build the target
    # from environmental conditions exactly one horizon ahead.
    future = df[["location_id", "timestamp", "wind_speed_kts", "wind_gust_kts", "wave_height_m", "swell_height_m"]].copy()
    future["future_risk"] = future.apply(assign_operational_risk, axis=1)
    horizon = pd.Timedelta(hours=int(RISK_HORIZON_HOURS))
    future["prediction_timestamp"] = future["timestamp"] - horizon
    target = future[["location_id", "prediction_timestamp", "future_risk"]].rename(columns={"prediction_timestamp": "timestamp"})
    df = df.merge(target, on=["location_id", "timestamp"], how="left", suffixes=("", "_future"))
    # assign_operational_risk returns the integer class directly (0..3).
    df[TARGET_COLUMN] = pd.to_numeric(df["future_risk"], errors="coerce")
    df = df.drop(columns=["future_risk"], errors="ignore").dropna(subset=[TARGET_COLUMN]).copy()
    df[TARGET_COLUMN] = df[TARGET_COLUMN].astype(int)
    if df.empty:
        raise ValueError("No rows remain after constructing the forward risk target. Check historical timestamp spacing and the prediction horizon.")
    return df


def add_dynamic_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    out = df.copy().sort_values(["location_id", "timestamp"])
    base = list(FEATURE_COLUMNS)
    for col in base:
        out[f"{col}_missing"] = out[col].isna().astype(np.int8)
    for col, prefix in [("wind_direction_deg", "wind"), ("wave_direction_deg", "wave"), ("swell_direction_deg", "swell")]:
        radians = np.deg2rad(out[col])
        out[f"{prefix}_direction_sin"] = np.sin(radians)
        out[f"{prefix}_direction_cos"] = np.cos(radians)
    for col in ["wind_speed_kts", "wind_gust_kts", "wave_height_m", "swell_height_m", "air_pressure_hpa"]:
        for hours in (3, 6):
            out[f"{col}_delta_{hours}h"] = out.groupby("location_id")[col].diff(periods=hours)
    dynamic = [c for c in out.columns if c.endswith("_missing") or "_delta_" in c or c.endswith("_direction_sin") or c.endswith("_direction_cos")]
    return out, base + dynamic


def metrics(y_true, pred) -> dict:
    labels = [0, 1, 2, 3]
    return {
        "accuracy": float(accuracy_score(y_true, pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, pred)),
        "macro_f1": float(f1_score(y_true, pred, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y_true, pred, average="weighted", zero_division=0)),
        "classification_report": classification_report(y_true, pred, labels=labels, target_names=RISK_ORDER, output_dict=True, zero_division=0),
        "confusion_matrix": confusion_matrix(y_true, pred, labels=labels).tolist(),
        "rows": int(len(y_true)),
    }


def majority_baseline(y: pd.Series) -> dict:
    majority = int(y.mode().iloc[0])
    pred = np.full(len(y), majority, dtype=int)
    result = metrics(y, pred)
    result["majority_class"] = RISK_ORDER[majority]
    return result


def make_model(n_estimators: int = 900) -> xgb.XGBClassifier:
    return xgb.XGBClassifier(
        objective="multi:softprob", num_class=4, n_estimators=n_estimators,
        learning_rate=0.035, max_depth=6, min_child_weight=8,
        subsample=0.85, colsample_bytree=0.85, reg_alpha=0.15, reg_lambda=2.0,
        gamma=0.05, tree_method="hist", eval_metric="mlogloss",
        random_state=RANDOM_STATE, n_jobs=-1,
    )


def class_weights(y: pd.Series) -> dict[int, float]:
    counts = y.value_counts().sort_index()
    return {int(cls): float(len(y) / (4 * count)) for cls, count in counts.items()}


def main() -> None:
    df = load_dataset()
    df, feature_columns = add_dynamic_features(df)
    print(f"Dataset rows after forward-target construction: {len(df):,}; locations: {df.location_id.nunique()}")
    print(f"Prediction horizon: +{int(RISK_HORIZON_HOURS)}h")
    print(f"Feature count: {len(feature_columns)} ({len(FEATURE_COLUMNS)} base + engineered dynamics/missingness)")
    print("Feature dtypes validated: all numeric")
    print("Missing percentage by feature:")
    print((df[feature_columns].isna().mean() * 100).round(2).to_string())
    print("Forward target distribution:")
    print(df[TARGET_COLUMN].map(RISK_CLASS_NAMES).value_counts().reindex(RISK_ORDER, fill_value=0))
    if df[TARGET_COLUMN].nunique() < 4:
        raise ValueError("Forward target does not contain all four risk classes.")

    # Digha is never used for fitting. Remaining locations are split chronologically.
    train_pool = df[df.location_id != HOLDOUT_LOCATION].sort_values("timestamp").copy()
    digha = df[df.location_id == HOLDOUT_LOCATION].copy()
    if digha.empty:
        raise ValueError(f"Spatial holdout {HOLDOUT_LOCATION!r} is missing.")
    n = len(train_pool)
    train_end, validation_end = int(n * 0.70), int(n * 0.85)
    train_df, validation_df = train_pool.iloc[:train_end], train_pool.iloc[train_end:validation_end]
    print("Temporal validation majority baseline:", majority_baseline(validation_df[TARGET_COLUMN]))
    print("Digha holdout majority baseline:", majority_baseline(digha[TARGET_COLUMN]))

    weights = class_weights(train_df[TARGET_COLUMN])
    model = make_model()
    sample_weight = train_df[TARGET_COLUMN].map(weights).to_numpy(dtype=np.float32)
    model.fit(train_df[feature_columns], train_df[TARGET_COLUMN], sample_weight=sample_weight, eval_set=[(validation_df[feature_columns], validation_df[TARGET_COLUMN])], verbose=100)
    validation_pred = model.predict(validation_df[feature_columns]).astype(int)
    digha_pred = model.predict(digha[feature_columns]).astype(int)
    validation_metrics = metrics(validation_df[TARGET_COLUMN], validation_pred)
    digha_metrics = metrics(digha[TARGET_COLUMN], digha_pred)
    print(f"Temporal validation: accuracy={validation_metrics['accuracy']:.4f} balanced_accuracy={validation_metrics['balanced_accuracy']:.4f} macro_f1={validation_metrics['macro_f1']:.4f} weighted_f1={validation_metrics['weighted_f1']:.4f} rows={len(validation_df):,}")
    print(f"Digha spatial holdout: accuracy={digha_metrics['accuracy']:.4f} balanced_accuracy={digha_metrics['balanced_accuracy']:.4f} macro_f1={digha_metrics['macro_f1']:.4f} weighted_f1={digha_metrics['weighted_f1']:.4f} rows={len(digha):,}")

    # Production fit intentionally excludes Digha.
    production = train_pool.copy()
    production_weights = class_weights(production[TARGET_COLUMN])
    best_iteration = getattr(model, "best_iteration", None)
    production_estimators = int(best_iteration + 1) if best_iteration is not None else 500
    final_model = make_model(n_estimators=max(100, production_estimators))
    final_model.fit(production[feature_columns], production[TARGET_COLUMN], sample_weight=production[TARGET_COLUMN].map(production_weights).to_numpy(dtype=np.float32), verbose=100)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / "orca_xgb_risk.json"
    metadata_path = MODELS_DIR / "orca_xgb_risk_metadata.json"
    final_model.save_model(model_path)
    importance = sorted(zip(feature_columns, final_model.feature_importances_), key=lambda x: x[1], reverse=True)
    metadata = {
        "model": "XGBoost", "model_version": "orca-xgb-risk-v2.2",
        "dataset_name": DATASET_NAME, "dataset_version": DATASET_VERSION,
        "prediction_horizon_hours": int(RISK_HORIZON_HOURS), "target": "future_risk_class",
        "classes": {str(i): name for i, name in RISK_CLASS_NAMES.items()},
        "features": feature_columns, "base_features": FEATURE_COLUMNS, "feature_count": len(feature_columns),
        "missing_data_policy": "Native XGBoost missing handling plus explicit missingness indicators; no synthetic visibility imputation.",
        "evaluation": {"temporal": validation_metrics, "digha_spatial_holdout": digha_metrics, "temporal_majority_baseline": majority_baseline(validation_df[TARGET_COLUMN]), "digha_majority_baseline": majority_baseline(digha[TARGET_COLUMN])},
        "class_weights": {str(k): v for k, v in production_weights.items()},
        "feature_importance": {name: float(value) for name, value in importance},
        "training_locations": sorted(train_pool.location_id.unique().tolist()), "digha_excluded_from_training": True,
        "label_policy": "Six-hour forward ORCA-X operational severity proxy anchored to documented marine safety criteria; not official warning labels or incident outcomes.",
        "warning": "RAG and authoritative IMD/INCOIS/Coast Guard evidence remain higher-priority safety evidence.",
    }
    metadata_path.write_text(json.dumps(metadata, indent=2, default=float), encoding="utf-8")
    print(f"Saved production model: {model_path}")
    print(f"Saved metadata: {metadata_path}")


if __name__ == "__main__": main()
