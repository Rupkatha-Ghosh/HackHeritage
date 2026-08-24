"""Auditable ORCA-X operational risk labels.

The target is NOT a historical accident label. It is an operational proxy built
from established marine-weather terminology:
- IMD/RSMC publishes marine warning thresholds at 25 kt and 34 kt wind levels.
- WMO recommends the Douglas sea-state terminology: slight 0.5-1.25 m,
  moderate 1.25-2.5 m, rough 2.5-4 m, very rough 4-6 m.

ORCA-X maps these physical/warning bands into four project-specific classes.
This mapping is deliberately documented and must not be presented as an
official INCOIS/IMD warning category.
"""
from __future__ import annotations

import pandas as pd

RISK_CLASS_NAMES = {0: "LOW", 1: "MODERATE", 2: "HIGH", 3: "EXTREME"}

# IMD/RSMC marine products explicitly use probability/warning products around
# 25 kt and 34 kt. WMO Douglas sea-state boundaries are used for wave severity.
WIND_CAUTION_KTS = 25.0
WIND_GALE_KTS = 34.0
WIND_EXTREME_KTS = 48.0

SEA_SLIGHT_MAX_M = 1.25
SEA_MODERATE_MAX_M = 2.50
SEA_ROUGH_MAX_M = 4.00
SWELL_MODERATE_MAX_M = 4.00


def _wind_severity(wind: float | None, gust: float | None) -> int:
    values = [value for value in (wind, gust) if value is not None and pd.notna(value)]
    if not values:
        return 0
    peak = max(values)
    if peak >= WIND_EXTREME_KTS:
        return 3
    if peak >= WIND_GALE_KTS:
        return 2
    if peak >= WIND_CAUTION_KTS:
        return 1
    return 0


def _sea_severity(wave: float | None, swell: float | None) -> int:
    wave_value = float(wave) if wave is not None and pd.notna(wave) else None
    swell_value = float(swell) if swell is not None and pd.notna(swell) else None

    severity = 0
    if wave_value is not None:
        if wave_value >= SEA_ROUGH_MAX_M:
            severity = max(severity, 3)
        elif wave_value >= SEA_MODERATE_MAX_M:
            severity = max(severity, 2)
        elif wave_value >= SEA_SLIGHT_MAX_M:
            severity = max(severity, 1)

    if swell_value is not None:
        if swell_value > SWELL_MODERATE_MAX_M:
            severity = max(severity, 3)
        elif swell_value >= 2.0:
            severity = max(severity, 2)
        elif swell_value >= 1.0:
            severity = max(severity, 1)
    return severity


def assign_operational_risk(row: pd.Series) -> int:
    """Return 0 LOW, 1 MODERATE, 2 HIGH, 3 EXTREME.

    The highest severity from wind/gust and significant-wave/swell conditions is
    used. Missing variables do not manufacture severity. The resulting class is
    an ORCA-X operational proxy, not an official maritime warning.
    """
    wind = row.get("wind_speed_kts")
    gust = row.get("wind_gust_kts")
    wave = row.get("wave_height_m")
    swell = row.get("swell_height_m")
    return max(
        _wind_severity(wind, gust),
        _sea_severity(wave, swell),
    )


# Backward-compatible import name for existing scripts.
assign_proxy_risk = assign_operational_risk
