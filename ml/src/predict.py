"""ORCA-X production XGBoost inference."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

from config import FEATURE_COLUMNS, MODELS_DIR


MODEL_PATH = MODELS_DIR / "orca_xgb_risk.json"
METADATA_PATH = MODELS_DIR / "orca_xgb_risk_metadata.json"

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

        self.metadata = json.loads(
            metadata_path.read_text(encoding="utf-8")
        )

        self.feature_columns = self.metadata.get(
            "features",
            FEATURE_COLUMNS,
        )

    def predict_one(self, features: dict) -> dict:
        row = pd.DataFrame(
            [[features.get(feature) for feature in self.feature_columns]],
            columns=self.feature_columns,
        )

        row = row.apply(pd.to_numeric, errors="coerce")

        probabilities = self.model.predict_proba(row)[0]

        predicted_class = int(np.argmax(probabilities))
        confidence = float(probabilities[predicted_class])

        return {
            "risk_class": predicted_class,
            "risk_label": RISK_CLASS_NAMES[predicted_class],
            "confidence": round(confidence, 6),
            "probabilities": {
                RISK_CLASS_NAMES[i]: round(float(probabilities[i]), 6)
                for i in range(len(probabilities))
            },
        }


def main() -> None:
    predictor = OrcaXRiskPredictor()

    sample = {
        "wind_speed_kts": 12.0,
        "wind_gust_kts": 16.0,
        "wave_height_m": 1.2,
        "wave_period_s": 7.0,
        "mean_wave_period_s": 5.2,
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

    print()
    print("=" * 60)
    print("ORCA-X RISK PREDICTION")
    print("=" * 60)

    print(f"Risk class : {result['risk_class']}")
    print(f"Risk label : {result['risk_label']}")
    print(f"Confidence : {result['confidence']:.4f}")

    print()
    print("Probabilities:")

    for label, probability in result["probabilities"].items():
        print(f"  {label:<10}: {probability:.4f}")


if __name__ == "__main__":
    main()