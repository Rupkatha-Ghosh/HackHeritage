"""ORCA-X production XGBoost inference with staged v1/v2 model compatibility."""
from __future__ import annotations

import json
from pathlib import Path
import numpy as np
import pandas as pd
import xgboost as xgb
from config import FEATURE_COLUMNS, MODELS_DIR, RISK_CLASS_NAMES
from ood import check_input_domain

MODEL_PATH = MODELS_DIR / "orca_xgb_risk.json"
METADATA_PATH = MODELS_DIR / "orca_xgb_risk_metadata.json"
MODEL_VERSION = "orca-xgb-risk-v2"
LEGACY_FEATURE_COLUMNS = [
    "wind_speed_kts", "wind_gust_kts", "wave_height_m", "wave_period_s",
    "mean_wave_period_s", "wind_direction_deg", "wave_direction_deg",
    "air_pressure_hpa", "air_temperature_c", "water_temperature_c",
    "latitude", "longitude", "month", "hour",
]

class OrcaXRiskPredictor:
    def __init__(self, model_path: Path = MODEL_PATH, metadata_path: Path = METADATA_PATH) -> None:
        self.model = xgb.XGBClassifier()
        self.model.load_model(str(model_path))
        self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        self.feature_columns = self.metadata.get("features", FEATURE_COLUMNS)
        if self.feature_columns not in (FEATURE_COLUMNS, LEGACY_FEATURE_COLUMNS):
            raise RuntimeError("Model feature contract is not a supported ORCA-X v1/v2 contract.")
        if self.metadata.get("feature_count") != len(self.feature_columns):
            raise RuntimeError("Model metadata feature_count does not match the feature list.")
        expected_classes = {str(key): value for key, value in RISK_CLASS_NAMES.items()}
        if self.metadata.get("classes") != expected_classes:
            raise RuntimeError("Model class contract mismatch between metadata and inference service.")
        self.model_version = self.metadata.get("model_version", "orca-xgb-risk-v1" if self.feature_columns == LEGACY_FEATURE_COLUMNS else MODEL_VERSION)

    def predict_one(self, features: dict) -> dict:
        domain = check_input_domain(features, self.feature_columns)
        if domain.invalid_features:
            raise ValueError(f"Invalid or missing model inputs: {', '.join(domain.invalid_features)}")
        try:
            values = [features[feature] for feature in self.feature_columns]
        except KeyError as exc:
            raise ValueError(f"Missing model input: {exc.args[0]}") from exc
        row = pd.DataFrame([values], columns=self.feature_columns).apply(pd.to_numeric, errors="coerce")
        if row.isna().any().any():
            missing = row.columns[row.isna().any()].tolist()
            raise ValueError(f"Model inputs became non-numeric: {', '.join(missing)}")
        if not np.isfinite(row.to_numpy(dtype=float)).all():
            raise ValueError("Model inputs contain non-finite values.")
        probabilities = np.asarray(self.model.predict_proba(row)[0], dtype=float)
        if len(probabilities) != 4 or not np.isfinite(probabilities).all() or (probabilities < 0).any():
            raise RuntimeError("Model returned invalid class probabilities.")
        if not np.isclose(float(probabilities.sum()), 1.0, atol=1e-6):
            raise RuntimeError("Model returned probabilities that do not sum to 1.")
        predicted_class = int(np.argmax(probabilities))
        probability_map = {RISK_CLASS_NAMES[i]: round(float(probabilities[i]), 6) for i in range(4)}
        return {
            "risk_class": predicted_class,
            "risk_label": RISK_CLASS_NAMES[predicted_class],
            "confidence": max(probability_map.values()),
            "probabilities": probability_map,
            "domain_validation": domain.as_dict(),
            "model_version": self.model_version,
            "feature_contract": self.feature_columns,
        }
