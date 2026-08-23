"""Conservative validation metadata for ORCA-X ML inference."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


PHYSICAL_RANGES: dict[str, tuple[float, float]] = {
    "wind_speed_kts": (0.0, 150.0),
    "wind_gust_kts": (0.0, 180.0),
    "wave_height_m": (0.0, 30.0),
    "wave_period_s": (0.0, 40.0),
    "mean_wave_period_s": (0.0, 40.0),
    "wind_direction_deg": (0.0, 360.0),
    "wave_direction_deg": (0.0, 360.0),
    "air_pressure_hpa": (850.0, 1100.0),
    "air_temperature_c": (-80.0, 60.0),
    "water_temperature_c": (-5.0, 45.0),
    "latitude": (-90.0, 90.0),
    "longitude": (-180.0, 180.0),
    "month": (1.0, 12.0),
    "hour": (0.0, 23.0),
}

TRAINING_DATASET = "NOAA NDBC stations 41001, 41002 and 42002"
DEPLOYMENT_VALIDATION_STATUS = "NOT_VALIDATED_FOR_INDIAN_COASTAL_DOMAIN"


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

    for name, (minimum, maximum) in PHYSICAL_RANGES.items():
        value = features.get(name)
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            invalid.append(name)
            continue
        if not minimum <= numeric <= maximum:
            invalid.append(name)

    if invalid:
        warnings.append(
            "One or more model inputs are missing or outside conservative physical bounds."
        )

    warnings.append(
        "The committed model is trained on NOAA NDBC observations; Indian coastal deployment is not independently validated by the committed dataset."
    )

    return DomainCheck(
        status="INVALID_INPUT" if invalid else "UNVALIDATED_DEPLOYMENT_DOMAIN",
        invalid_features=invalid,
        warnings=warnings,
        training_dataset=TRAINING_DATASET,
        deployment_validation_status=DEPLOYMENT_VALIDATION_STATUS,
    )
