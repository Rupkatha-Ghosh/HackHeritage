"""Contract tests for the committed ORCA-X ML inference service."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[1]
ML_SRC = ML_ROOT / "src"
if str(ML_SRC) not in sys.path:
    sys.path.insert(0, str(ML_SRC))

from config import FEATURE_COLUMNS  # noqa: E402
from predict import MODEL_VERSION, OrcaXRiskPredictor  # noqa: E402


class InferenceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.predictor = OrcaXRiskPredictor()
        cls.sample = {
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

    def test_feature_contract_matches_metadata(self) -> None:
        self.assertEqual(self.predictor.feature_columns, FEATURE_COLUMNS)
        self.assertEqual(len(self.predictor.feature_columns), 14)

    def test_prediction_returns_valid_probability_distribution(self) -> None:
        result = self.predictor.predict_one(self.sample)
        probabilities = result["probabilities"]

        self.assertEqual(result["model_version"], MODEL_VERSION)
        self.assertIn(result["risk_label"], {"LOW", "MODERATE", "HIGH", "EXTREME"})
        self.assertAlmostEqual(sum(probabilities.values()), 1.0, places=5)
        self.assertTrue(all(0.0 <= value <= 1.0 for value in probabilities.values()))
        self.assertEqual(set(probabilities), {"LOW", "MODERATE", "HIGH", "EXTREME"})

    def test_confidence_matches_exposed_top_probability(self) -> None:
        result = self.predictor.predict_one(self.sample)
        self.assertEqual(result["confidence"], max(result["probabilities"].values()))
        self.assertEqual(result["confidence"], result["probabilities"][result["risk_label"]])

    def test_invalid_physical_input_is_rejected(self) -> None:
        invalid = dict(self.sample)
        invalid["wave_height_m"] = -1.0

        with self.assertRaises(ValueError):
            self.predictor.predict_one(invalid)


if __name__ == "__main__":
    unittest.main()
