"""ORCA-X production XGBoost v2 inference."""
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


class OrcaXRiskPredictor:
    def __init__(self, model_path: Path = MODEL_PATH, metadata_path: Path = METADATA_PATH) -> None:
        self.model = xgb.XGBClassifier()
        self.model.load_model(str(model_path))
        self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        self.feature_columns = self.metadata.get("features", FEATURE_COLUMNS)
        if self.feature_columns != FEATURE_COLUMNS:
            raise RuntimeError("Model feature contract mismatch: metadata features do not match config FEATURE_COLUMNS.")
        if self.metadata.get("feature_count") != len(self.feature_columns):
            raise RuntimeError("Model metadata feature_count does not match the feature list.")
        expected_classes = {str(key): value for key, value in RISK_CLASS_NAMES.items()}
        if self.metadata.get("classes") != expected_classes:
            raise RuntimeError("Model class contract mismatch between metadata and inference service.")

    def predict_one(self, features: dict) -> dict:
        domain = check_input_domain(features)
        if domain.invalid_features:
            raise ValueError(f"Invalid or missing model inputs: {', '.join(domain.invalid_features)}")

        row = pd.DataFrame([[features[feature] for feature in self.feature_columns]], columns=self.feature_columns)
        row = row.apply(pd.to_numeric, errors="coerce")
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
            "model_version": MODEL_VERSION,
            "feature_contract": self.feature_columns,
        }
