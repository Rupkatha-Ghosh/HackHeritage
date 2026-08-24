"""Train ORCA-X v2 on real historical Indian-coastal environmental data."""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from config import DATASET_NAME, DATASET_VERSION, FEATURE_COLUMNS, MODELS_DIR, PROCESSED_DIR, RISK_CLASS_NAMES, TARGET_COLUMN

RANDOM_STATE = 42
HOLDOUT_LOCATION = "digha_wb"

def load_dataset() -> pd.DataFrame:
    path = PROCESSED_DIR / "orca_historical_marine_risk.parquet"
    if not path.exists(): raise FileNotFoundError("Run download_historical_marine.py and prepare_dataset.py first.")
    df = pd.read_parquet(path)
    required = ["location_id", "timestamp", *FEATURE_COLUMNS, TARGET_COLUMN]
    missing = [column for column in required if column not in df.columns]
    if missing: raise ValueError(f"Dataset is missing required columns: {missing}")
    # Parquet preserves object dtype if an upstream JSON field contained strings.
    # XGBoost accepts only numeric/bool/category columns, so enforce the feature contract here too.
    for column in FEATURE_COLUMNS:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    df[TARGET_COLUMN] = pd.to_numeric(df[TARGET_COLUMN], errors="coerce")
    df = df.dropna(subset=[TARGET_COLUMN]).sort_values("timestamp").copy()
    bad_dtypes = {column: str(df[column].dtype) for column in FEATURE_COLUMNS if not pd.api.types.is_numeric_dtype(df[column])}
    if bad_dtypes: raise TypeError(f"Non-numeric model features after coercion: {bad_dtypes}")
    if df.empty: raise ValueError("Historical dataset contains no usable target rows.")
    return df

def class_weights(y: pd.Series) -> dict[int, float]:
    counts = y.value_counts().sort_index()
    return {int(cls): len(y) / (len(counts) * count) for cls, count in counts.items()}

def evaluate(model: xgb.XGBClassifier, X: pd.DataFrame, y: pd.Series, name: str) -> dict:
    pred = model.predict(X)
    report = classification_report(y, pred, labels=[0, 1, 2, 3], target_names=[RISK_CLASS_NAMES[i] for i in range(4)], output_dict=True, zero_division=0)
    metrics = {"accuracy": float(accuracy_score(y, pred)), "macro_f1": float(f1_score(y, pred, average="macro", zero_division=0)), "weighted_f1": float(f1_score(y, pred, average="weighted", zero_division=0)), "classification_report": report, "confusion_matrix": confusion_matrix(y, pred, labels=[0, 1, 2, 3]).tolist(), "rows": int(len(y))}
    print(f"{name}: accuracy={metrics['accuracy']:.4f} macro_f1={metrics['macro_f1']:.4f} rows={len(y):,}")
    return metrics

def make_model() -> xgb.XGBClassifier:
    return xgb.XGBClassifier(objective="multi:softprob", num_class=4, n_estimators=700, learning_rate=0.05, max_depth=8, min_child_weight=3, subsample=0.85, colsample_bytree=0.85, reg_alpha=0.05, reg_lambda=1.0, gamma=0.0, tree_method="hist", eval_metric="mlogloss", random_state=RANDOM_STATE, n_jobs=-1)

def main() -> None:
    df = load_dataset()
    print(f"Dataset rows: {len(df):,}; locations: {df['location_id'].nunique()}")
    print("Feature dtypes validated: all numeric")
    print("Missing values by feature:")
    print(df[FEATURE_COLUMNS].isna().sum().to_string())

    spatial_train = df[df["location_id"] != HOLDOUT_LOCATION].copy()
    spatial_test = df[df["location_id"] == HOLDOUT_LOCATION].copy()
    if spatial_test.empty: raise ValueError(f"Spatial holdout location {HOLDOUT_LOCATION!r} is missing.")
    spatial_train = spatial_train.sort_values("timestamp")
    n = len(spatial_train); train_end = int(n * 0.70); validation_end = int(n * 0.85)
    train_df = spatial_train.iloc[:train_end]; validation_df = spatial_train.iloc[train_end:validation_end]
    weights = class_weights(train_df[TARGET_COLUMN].astype(int))
    sample_weights = train_df[TARGET_COLUMN].astype(int).map(weights).to_numpy(dtype=np.float32)

    model = make_model()
    model.fit(train_df[FEATURE_COLUMNS], train_df[TARGET_COLUMN].astype(int), sample_weight=sample_weights, eval_set=[(validation_df[FEATURE_COLUMNS], validation_df[TARGET_COLUMN].astype(int))], verbose=100)
    validation_metrics = evaluate(model, validation_df[FEATURE_COLUMNS], validation_df[TARGET_COLUMN].astype(int), "Temporal validation")
    spatial_metrics = evaluate(model, spatial_test[FEATURE_COLUMNS], spatial_test[TARGET_COLUMN].astype(int), "Digha spatial holdout")

    final_weights = class_weights(df[TARGET_COLUMN].astype(int))
    final_sample_weights = df[TARGET_COLUMN].astype(int).map(final_weights).to_numpy(dtype=np.float32)
    final_model = make_model()
    final_model.fit(df[FEATURE_COLUMNS], df[TARGET_COLUMN].astype(int), sample_weight=final_sample_weights, verbose=100)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / "orca_xgb_risk.json"; metadata_path = MODELS_DIR / "orca_xgb_risk_metadata.json"
    final_model.save_model(model_path)
    importance = sorted(zip(FEATURE_COLUMNS, final_model.feature_importances_), key=lambda item: item[1], reverse=True)
    metadata = {"model": "XGBoost", "model_version": "orca-xgb-risk-v2", "model_file": model_path.name, "dataset_name": DATASET_NAME, "dataset_version": DATASET_VERSION, "target": TARGET_COLUMN, "classes": {str(k): v for k, v in RISK_CLASS_NAMES.items()}, "features": FEATURE_COLUMNS, "feature_count": len(FEATURE_COLUMNS), "random_state": RANDOM_STATE, "evaluation": {"temporal_split": "70/15 on non-Digha locations ordered by timestamp", "spatial_holdout": HOLDOUT_LOCATION, "temporal_validation": validation_metrics, "spatial_holdout": spatial_metrics}, "training_rows": int(len(df)), "training_locations": sorted(df["location_id"].unique().tolist()), "class_weights": {str(k): float(v) for k, v in final_weights.items()}, "hyperparameters": {"n_estimators": 700, "learning_rate": 0.05, "max_depth": 8, "min_child_weight": 3, "subsample": 0.85, "colsample_bytree": 0.85, "reg_alpha": 0.05, "reg_lambda": 1.0, "gamma": 0.0}, "feature_importance": {feature: float(score) for feature, score in importance}, "label_policy": "ORCA-X operational proxy anchored to IMD/RSMC 25/34 kt marine wind bands and WMO Douglas sea-state terminology.", "deployment_validation": "INDIAN_COASTAL_HISTORICAL_PROXY_VALIDATED_NOT_A_STATUTORY_WARNING", "warning": "The target is an operational severity proxy, not historical vessel incidents or official IMD/INCOIS warning labels. RAG/authoritative advisories remain the final safety evidence layer."}
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Saved production model: {model_path}"); print(f"Saved metadata: {metadata_path}")

if __name__ == "__main__": main()
