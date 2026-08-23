"""Transparent baseline label policy for the first ORCA-X training dataset.

These labels are operational proxies, not observed accident/incident outcomes.
They deliberately use thresholds that can be inspected and challenged.
"""

from __future__ import annotations

import pandas as pd # pyright: ignore[reportMissingModuleSource]


def assign_proxy_risk(row: pd.Series) -> int:
    """Return 0=LOW, 1=MODERATE, 2=HIGH, 3=EXTREME.

    The highest triggered severity is used. Missing measurements are ignored.
    This is intentionally conservative for a safety-oriented prototype.
    """
    severity = 0

    wave = row.get("wave_height_m")
    wind = row.get("wind_speed_kts")
    gust = row.get("wind_gust_kts")
    visibility = row.get("visibility_nm")
    pressure = row.get("air_pressure_hpa")

    if pd.notna(wave):
        if wave >= 4.0:
            severity = max(severity, 3)
        elif wave >= 2.8:
            severity = max(severity, 2)
        elif wave >= 1.5:
            severity = max(severity, 1)

    if pd.notna(wind):
        if wind >= 34:
            severity = max(severity, 3)
        elif wind >= 28:
            severity = max(severity, 2)
        elif wind >= 18:
            severity = max(severity, 1)

    if pd.notna(gust):
        if gust >= 45:
            severity = max(severity, 3)
        elif gust >= 34:
            severity = max(severity, 2)
        elif gust >= 25:
            severity = max(severity, 1)

    if pd.notna(visibility):
        if visibility < 0.5:
            severity = max(severity, 3)
        elif visibility < 1.0:
            severity = max(severity, 2)
        elif visibility < 2.0:
            severity = max(severity, 1)

    if pd.notna(pressure) and pressure < 990:
        severity = max(severity, 1)

    return severity


RISK_CLASS_NAMES = {
    0: "LOW",
    1: "MODERATE",
    2: "HIGH",
    3: "EXTREME",
}
