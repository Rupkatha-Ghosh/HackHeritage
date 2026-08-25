"""Conservative physical-domain validation for ORCA-X models."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from config import FEATURE_COLUMNS

PHYSICAL_RANGES: dict[str, tuple[float, float]] = {
    "wind_speed_kts": (0.0, 150.0), "wind_gust_kts": (0.0, 180.0),
    "wave_height_m": (0.0, 30.0), "wave_period_s": (0.0, 40.0),
    "mean_wave_period_s": (0.0, 40.0), "swell_height_m": (0.0, 30.0),
    "swell_period_s": (0.0, 60.0), "wind_direction_deg": (0.0, 360.0),
    "wave_direction_deg": (0.0, 360.0), "swell_direction_deg": (0.0, 360.0),
    "air_pressure_hpa": (850.0, 1100.0), "air_temperature_c": (-80.0, 60.0),
    "water_temperature_c": (-5.0, 45.0), "sea_surface_temperature_c": (-5.0, 45.0),
    "precipitation_mm": (0.0, 500.0), "visibility_km": (0.0, 100.0),
    "latitude": (-90.0, 90.0), "longitude": (-180.0, 180.0),
    "month": (1.0, 12.0), "hour": (0.0, 23.0), "season": (0.0, 3.0),
}

TRAINING_DATASET = "Open-Meteo historical weather + marine observations at six Indian coastal regions (2020-2025)"
DEPLOYMENT_VALIDATION_STATUS = "INDIAN_COASTAL_HISTORICAL_PROXY_VALIDATED_NOT_A_STATUTORY_WARNING"


@dataclass(frozen=True)
class DomainCheck:
    status: str
    invalid_features: list[str]
    warnings: list[str]
    training_dataset: str
    deployment_validation_status: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "invalid_features": self.invalid_features,
            "warnings": self.warnings,
            "training_dataset": self.training_dataset,
            "deployment_validation_status": self.deployment_validation_status,
        }


def check_input_domain(features: dict[str, Any], feature_names: Iterable[str] | None = None) -> DomainCheck:
    invalid: list[str] = []
    warnings: list[str] = []
    names = list(feature_names or FEATURE_COLUMNS)

    for name in names:
        # Engineered indicators are not physical measurements and therefore do
        # not have independent physical ranges.
        if name.endswith("_missing"):
            continue
        if name.endswith("_direction_sin") or name.endswith("_direction_cos"):
            value = features.get(name)
            if value is not None:
                try:
                    numeric = float(value)
                    if not -1.000001 <= numeric <= 1.000001:
                        invalid.append(name)
                except (TypeError, ValueError):
                    invalid.append(name)
            continue
        if name in {"gust_excess_kts", "gust_to_wind_ratio", "gust_above_gale_kts", "gust_above_extreme_kts"}:
            value = features.get(name)
            if value is None:
                continue
            try:
                numeric = float(value)
                if name == "gust_to_wind_ratio" and numeric < 0:
                    invalid.append(name)
                elif name != "gust_to_wind_ratio" and numeric < 0:
                    invalid.append(name)
            except (TypeError, ValueError):
                invalid.append(name)
            continue

        if name not in PHYSICAL_RANGES:
            invalid.append(name)
            continue

        raw = features.get(name)
        if raw is None:
            warnings.append(f"Missing optional model input: {name}; XGBoost may use its native missing-value path.")
            continue
        try:
            numeric = float(raw)
        except (TypeError, ValueError):
            invalid.append(name)
            continue
        if numeric != numeric:  # NaN
            warnings.append(f"Missing optional model input: {name}; XGBoost may use its native missing-value path.")
            continue
        minimum, maximum = PHYSICAL_RANGES[name]
        if not minimum <= numeric <= maximum:
            invalid.append(name)

    if invalid:
        warnings.append("One or more model inputs are outside conservative physical bounds or malformed.")
    warnings.append("The Refinement 4 target is an operational proxy rather than incident outcomes or statutory warnings.")
    return DomainCheck(
        "INVALID_INPUT" if invalid else "UNVALIDATED_DEPLOYMENT_DOMAIN",
        sorted(set(invalid)),
        list(dict.fromkeys(warnings)),
        TRAINING_DATASET,
        DEPLOYMENT_VALIDATION_STATUS,
    )
