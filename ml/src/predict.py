"""ORCA-X production XGBoost inference with explicit feature-contract compatibility."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

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


def _as_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if np.isfinite(number) else None


def _observed_hour(features: dict[str, Any]) -> int:
    observed_at = features.get("observed_at") or features.get("observedAt")
    if observed_at:
        try:
            text = str(observed_at).replace("Z", "+00:00")
            return datetime.fromisoformat(text).astimezone(timezone.utc).hour
        except ValueError:
            pass
    return datetime.now(timezone.utc).hour


def build_inference_features(features: dict[str, Any], feature_columns: list[str]) -> dict[str, float]:
    """Build exactly the features required by the committed model.

    Refinement 4 introduced engineered point-in-time features. Earlier v1 model
    artifacts use the 14-column contract. This adapter keeps both contracts
    runnable and deliberately rejects future-looking lag/trend features because
    a single live observation cannot legitimately manufacture them.
    """
    values = dict(features)
    if values.get("mean_wave_period_s") is None:
        values["mean_wave_period_s"] = values.get("wave_period_s")
    if values.get("water_temperature_c") is None:
        values["water_temperature_c"] = values.get("sea_surface_temperature_c")
    if values.get("hour") is None:
        values["hour"] = _observed_hour(values)

    # Point-in-time Refinement 4 feature engineering.
    for column in FEATURE_COLUMNS:
        if values.get(column) is None:
            values[column] = np.nan

    for column in FEATURE_COLUMNS:
        values[f"{column}_missing"] = 1.0 if values.get(column) is None or pd.isna(values.get(column)) else 0.0

    for column, prefix in (("wind_direction_deg", "wind"), ("wave_direction_deg", "wave"), ("swell_direction_deg", "swell")):
        direction = _as_float(values.get(column))
        radians = np.deg2rad(direction) if direction is not None else np.nan
        values[f"{prefix}_direction_sin"] = float(np.sin(radians)) if np.isfinite(radians) else np.nan
        values[f"{prefix}_direction_cos"] = float(np.cos(radians)) if np.isfinite(radians) else np.nan

    wind = _as_float(values.get("wind_speed_kts"))
    gust = _as_float(values.get("wind_gust_kts"))
    if wind is not None and gust is not None:
        values["gust_excess_kts"] = gust - wind
        values["gust_to_wind_ratio"] = gust / max(wind, 0.1)
    else:
        values["gust_excess_kts"] = np.nan
        values["gust_to_wind_ratio"] = np.nan
    values["gust_above_gale_kts"] = max((gust or 0.0) - 34.0, 0.0) if gust is not None else np.nan
    values["gust_above_extreme_kts"] = max((gust or 0.0) - 48.0, 0.0) if gust is not None else np.nan

    unsupported = [name for name in feature_columns if name not in values]
    if unsupported:
        raise ValueError(
            "The committed model requires features that cannot be derived from one live observation: "
            + ", ".join(unsupported)
        )

    result: dict[str, float] = {}
    for name in feature_columns:
        value = values[name]
        numeric = _as_float(value)
        result[name] = numeric if numeric is not None else np.nan
    return result


class OrcaXRiskPredictor:
    def __init__(self, model_path: Path = MODEL_PATH, metadata_path: Path = METADATA_PATH) -> None:
        self.model = xgb.XGBClassifier()
        self.model.load_model(str(model_path))
        self.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        self.feature_columns = list(self.metadata.get("features", FEATURE_COLUMNS))
        supported_contracts = (FEATURE_COLUMNS, LEGACY_FEATURE_COLUMNS)
        if self.feature_columns not in supported_contracts:
            # A trained Refinement 4 model may contain additional point-in-time
            # engineered features. Lag/trend contracts are intentionally rejected.
            unsupported = [
                name for name in self.feature_columns
                if name not in set(FEATURE_COLUMNS)
                and not name.endswith("_missing")
                and not name.endswith("_direction_sin")
                and not name.endswith("_direction_cos")
                and name not in {"gust_excess_kts", "gust_to_wind_ratio", "gust_above_gale_kts", "gust_above_extreme_kts"}
            ]
            if unsupported:
                raise RuntimeError(
                    "Model feature contract requires unsupported live features: " + ", ".join(unsupported)
                )
        if self.metadata.get("feature_count") != len(self.feature_columns):
            raise RuntimeError("Model metadata feature_count does not match the feature list.")
        expected_classes = {str(key): value for key, value in RISK_CLASS_NAMES.items()}
        if self.metadata.get("classes") != expected_classes:
            raise RuntimeError("Model class contract mismatch between metadata and inference service.")
        self.model_version = self.metadata.get(
            "model_version",
            "orca-xgb-risk-v1" if self.feature_columns == LEGACY_FEATURE_COLUMNS else MODEL_VERSION,
        )

    def predict_one(self, features: dict[str, Any]) -> dict:
        model_features = build_inference_features(features, self.feature_columns)
        domain = check_input_domain(model_features, self.feature_columns)
        if domain.invalid_features:
            raise ValueError(f"Invalid or missing model inputs: {', '.join(domain.invalid_features)}")

        row = pd.DataFrame([model_features], columns=self.feature_columns).apply(pd.to_numeric, errors="coerce")
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
