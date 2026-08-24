"""Auditable ORCA-X operational marine-risk labels.

These labels are project-specific operational proxies, NOT observed incident
labels and NOT official IMD/INCOIS warning categories.

Reference anchors:
- IMD/RSMC marine products explicitly publish 25 kt and 34 kt wind
  exceedance products.
- WMO/Douglas sea-state terminology uses rough = 2.5-4 m, very rough =
  4-6 m, high = 6-9 m.

ORCA-X deliberately uses a COMPOUND policy for EXTREME. A single 25-34 kt
caution/gale wind or a rough 2.5-4 m sea cannot by itself create EXTREME.
EXTREME requires either a genuinely severe single factor (>=48 kt wind or
>=6 m significant wave height) or simultaneous gale-level wind and rough sea.
This avoids turning common rough/gale conditions into an extreme label while
still preserving severe and compound-danger examples.
"""
from __future__ import annotations

import pandas as pd

RISK_CLASS_NAMES = {0: "LOW", 1: "MODERATE", 2: "HIGH", 3: "EXTREME"}

# IMD/RSMC marine products use 25 kt and 34 kt probability/exceedance bands.
WIND_CAUTION_KTS = 25.0
WIND_GALE_KTS = 34.0
WIND_EXTREME_KTS = 48.0

# WMO/Douglas sea-state terminology: rough 2.5-4 m, very rough 4-6 m,
# high 6-9 m. ORCA-X reserves EXTREME single-factor wave severity for >=6 m.
SEA_SLIGHT_MAX_M = 1.25
SEA_MODERATE_MAX_M = 2.50
SEA_ROUGH_MAX_M = 4.00
SEA_VERY_ROUGH_MAX_M = 6.00

# Swell terminology is treated as a supporting hazard rather than an automatic
# EXTREME trigger. WMO Douglas swell: moderate 2-4 m, heavy >4 m.
SWELL_MODERATE_MAX_M = 4.00
SWELL_HEAVY_M = 4.00


def _wind_severity(wind: float | None, gust: float | None) -> int:
    values = [float(value) for value in (wind, gust) if value is not None and pd.notna(value)]
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
    """Return significant-sea severity; swell is a supporting modifier."""
    wave_value = float(wave) if wave is not None and pd.notna(wave) else None
    swell_value = float(swell) if swell is not None and pd.notna(swell) else None

    severity = 0
    if wave_value is not None:
        if wave_value >= SEA_VERY_ROUGH_MAX_M:
            severity = 3
        elif wave_value >= SEA_ROUGH_MAX_M:
            severity = 2
        elif wave_value >= SEA_MODERATE_MAX_M:
            severity = 1

    # Heavy swell increases operational severity, but cannot independently make
    # EXTREME. It can elevate a low/rough sea condition to HIGH when appropriate.
    if swell_value is not None:
        if swell_value > SWELL_HEAVY_M:
            severity = max(severity, 2)
        elif swell_value >= 2.0:
            severity = max(severity, 1)

    return severity


def assign_operational_risk(row: pd.Series) -> int:
    """Return ORCA-X operational class: 0 LOW, 1 MODERATE, 2 HIGH, 3 EXTREME.

    Policy:
      LOW      = no meaningful wind/sea hazard.
      MODERATE = one caution-level hazard.
      HIGH     = one gale/rough-level hazard OR a meaningful compound hazard.
      EXTREME  = >=48 kt wind, >=6 m significant wave, OR gale wind + rough sea.

    Missing values do not manufacture severity. Official warnings and authoritative
    marine evidence remain higher-priority safety evidence in the ORCA-X pipeline.
    """
    wind = _wind_severity(row.get("wind_speed_kts"), row.get("wind_gust_kts"))
    sea = _sea_severity(row.get("wave_height_m"), row.get("swell_height_m"))

    # Severe single-factor conditions.
    if wind >= 3 or sea >= 3:
        return 3

    # Compound gale + rough sea condition. This is deliberately stricter than
    # taking max(wind, sea), preventing routine rough/gale states from becoming
    # EXTREME solely because one variable crossed a boundary.
    if wind >= 2 and sea >= 2:
        return 3

    if wind >= 2 or sea >= 2:
        return 2

    if wind >= 1 or sea >= 1:
        return 1

    return 0


# Backward-compatible import name for existing scripts.
assign_proxy_risk = assign_operational_risk
