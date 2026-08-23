"""ORCA-X production XGBoost inference."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from config import FEATURE_COLUMNS, MODELS_DIR
from ood import check_input_domain

MODEL_PATH = MODELS_DIR / "orca_xgb_risk.json"
METADATA_PATH = MODELS_DIR / "orca_xgb_risk_metadata.json"
MODEL_VERSION = "orca-xgb-risk-v1"

RISK_CLASS_NAMES = {
    0: "LOW",
    1: "MODERATE",
    2: "HIGH",
    3: "EXTREME",
}


class OrcaXRiskPredictor:
    def __init__(
        self,
        model_path: Path = MODEL_PATH,
        metadata_path: Path = METADATA_PATH,
    ) -> None:
        self.model = xgb.XGBClassifier()
        self.model.load_model(str(model_path))

        self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        self.feature_columns = self.metadata.get("features", FEATURE_COLUMNS)

        if self.feature_columns != FEATURE_COLUMNS:
            raise RuntimeError(
                "Model feature contract mismatch: metadata features do not match config FEATURE_COLUMNS."
            )

        if self.metadata.get("feature_count") != len(self.feature_columns):
            raise RuntimeError("Model metadata feature_count does not match the feature list.")

        expected_classes = {str(key): value for key, value in RISK_CLASS_NAMES.items()}
        if self.metadata.get("classes") != expected_classes:
            raise RuntimeError("Model class contract mismatch between metadata and inference service.")

    def predict_one(self, features: dict) -> dict:
        domain = check_input_domain(features)
        if domain.invalid_features:
            raise ValueError(
                f"Invalid or missing model inputs: {', '.join(domain.invalid_features)}"
            )

        row = pd.DataFrame(
            [[features[feature] for feature in self.feature_columns]],
            columns=self.feature_columns,
        )
        row = row.apply(pd.to_numeric, errors="coerce")

        if row.isna().any().any():
            missing = row.columns[row.isna().any()].tolist()
            raise ValueError(f"Model inputs became non-numeric: {', '.join(missing)}")

        if not np.isfinite(row.to_numpy(dtype=float)).all():
            raise ValueError("Model inputs contain non-finite values.")

        probabilities = np.asarray(self.model.predict_proba(row)[0], dtype=float)
        if len(probabilities) != len(RISK_CLASS_NAMES):
            raise RuntimeError("Model returned an unexpected number of class probabilities.")
        if not np.isfinite(probabilities).all() or (probabilities < 0).any():
            raise RuntimeError("Model returned invalid class probabilities.")

        probability_total = float(probabilities.sum())
        if not np.isclose(probability_total, 1.0, atol=1e-6):
            raise RuntimeError("Model returned probabilities that do not sum to 1.")

        predicted_class = int(np.argmax(probabilities))
        probability_map = {
            RISK_CLASS_NAMES[i]: round(float(probabilities[i]), 6)
            for i in range(len(probabilities))
        }
        # Keep confidence derived from the same rounded vector exposed by the
        # API so clients never display conflicting confidence values.
        confidence = max(probability_map.values())

        return {
            "risk_class": predicted_class,
            "risk_label": RISK_CLASS_NAMES[predicted_class],
            "confidence": confidence,
            "probabilities": probability_map,
            "domain_validation": domain.as_dict(),
            "model_version": MODEL_VERSION,
        }


def main() -> None:
    predictor = OrcaXRiskPredictor()
    sample = {
        "wind_speed_kts": 12.0,
        "wind_gust_kts": 16.0,
        "wave_height_m": 1.2,
        "wave_period_s": 7.0,
        "mean_wave_period_s": 6.0,
        "wind_direction_deg": 220.0,
        "wave_direction_deg": 130.0,
        "air_pressure_hpa": 1015.0,
        "air_temperature_c": 25.0,
        "water_temperature_c": 26.0,
        "latitude": 30.0,
        "longitude": -80.0,
        "month": 8,
        "hour": 12,
    }

    result = predictor.predict_one(sample)
    print("=" * 60)
    print("ORCA-X RISK PREDICTION")
    print("=" * 60)
    print(f"Risk class : {result['risk_class']}")
    print(f"Risk label : {result['risk_label']}")
    print(f"Confidence : {result['confidence']:.4f}")
    print(f"Domain     : {result['domain_validation']['status']}")
    print()
    print("Probabilities:")
    for label, probability in result["probabilities"].items():
        print(f"  {label:<10}: {probability:.4f}")


if __name__ == "__main__":
    main()
