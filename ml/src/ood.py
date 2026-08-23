"""Input-domain checks for ORCA-X marine risk inference.

These checks do not change the XGBoost prediction. They explicitly identify
whether an inference request is inside the geographic/data domain represented
by the committed training dataset, so the application can avoid presenting
out-of-domain predictions as fully validated forecasts.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


# The committed training manifest contains only these stations. The exact
# station coordinates are intentionally not hard-coded here; the model's
# training/evaluation artifacts should remain the source of truth for data
# provenance. This guard therefore focuses on values that can be validated
# without inventing training bounds.

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


@dataclass(frozen=True)
class DomainCheck:
    status: str
    warnings: list[str]
    invalid_features: list[str]
    geographic_validation: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "warnings": self.warnings,
            "invalid_features": self.invalid_features,
            "geographic_validation": self.geographic_validation,
        }


def check_input_domain(features: dict[str, Any]) -> DomainCheck:
    """Validate basic physical bounds and report dataset-domain limitations.

    The current model was trained from NOAA NDBC observations from stations
    41001, 41002 and 42002. The repository does not contain a committed India-
    specific training/validation dataset, so this function deliberately does
    not claim that Indian coastal inputs are in-domain.
    """

    warnings: list[str] = []
    invalid: list[str] = []

    for name, (minimum, maximum) in PHYSICAL_RANGES.items():
        value = features.get(name)
        if value is None:
            invalid.append(name)
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            invalid.append(name)
            continue
        if not minimum <= numeric <= maximum:
            invalid.append(name)

    if invalid:
        warnings.append(
            "One or more inference features are missing or outside the supported physical bounds."
        )

    # Geographic validation is intentionally conservative. The current
    # dataset manifest identifies only three NOAA NDBC stations and does not
    # establish validated coverage for ORCA's Indian coastal locations.
    geographic_validation = "NO_INDIA_DOMAIN_VALIDATION"
    warnings.append(
        "The committed XGBoost model was trained and evaluated on NOAA NDBC stations 41001, 41002 and 42002; Indian coastal deployment is not independently validated by the current dataset."
    )

    status = "INVALID" if invalid else "DOMAIN_UNVERIFIED"

    return DomainCheck(
        status=status,
        warnings=warnings,
        invalid_features=invalid,
        geographic_validation=geographic_validation,
    )
