"""Conservative physical-domain validation for ORCA-X v2."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from config import FEATURE_COLUMNS

PHYSICAL_RANGES: dict[str, tuple[float, float]] = {
    "wind_speed_kts": (0.0, 150.0),
    "wind_gust_kts": (0.0, 180.0),
    "wave_height_m": (0.0, 30.0),
    "wave_period_s": (0.0, 40.0),
    "swell_height_m": (0.0, 30.0),
    "swell_period_s": (0.0, 60.0),
    "wind_direction_deg": (0.0, 360.0),
    "wave_direction_deg": (0.0, 360.0),
    "swell_direction_deg": (0.0, 360.0),
    "air_pressure_hpa": (850.0, 1100.0),
    "air_temperature_c": (-80.0, 60.0),
    "sea_surface_temperature_c": (-5.0, 45.0),
    "precipitation_mm": (0.0, 500.0),
    "visibility_km": (0.0, 100.0),
    "latitude": (-90.0, 90.0),
    "longitude": (-180.0, 180.0),
    "month": (1.0, 12.0),
    "season": (0.0, 3.0),
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


def check_input_domain(features: dict[str, Any]) -> DomainCheck:
    invalid: list[str] = []
    warnings: list[str] = []
    for name in FEATURE_COLUMNS:
        minimum, maximum = PHYSICAL_RANGES[name]
        value = features.get(name)
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            invalid.append(name)
            continue
        if not minimum <= numeric <= maximum:
            invalid.append(name)
    if invalid:
        warnings.append("One or more model inputs are missing or outside conservative physical bounds.")
    warnings.append("The v2 model is trained on historical Indian-coastal environmental observations, but its labels are operational proxies rather than incident outcomes or statutory warnings.")
    return DomainCheck(
        status="INVALID_INPUT" if invalid else "UNVALIDATED_DEPLOYMENT_DOMAIN",
        invalid_features=invalid,
        warnings=warnings,
        training_dataset=TRAINING_DATASET,
        deployment_validation_status=DEPLOYMENT_VALIDATION_STATUS,
    )
