"""Convert raw NDBC standard-meteorological files into a model-ready dataset."""

from __future__ import annotations

import gzip
import json
from io import StringIO
from pathlib import Path

import pandas as pd

from config import (
    DATASET_NAME,
    DATASET_VERSION,
    FEATURE_COLUMNS,
    PROCESSED_DIR,
    RAW_DIR,
    TARGET_COLUMN,
)
from label_policy import RISK_CLASS_NAMES, assign_proxy_risk


# Exact column order from the NDBC standard meteorological files.
#
# Example:
# #YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
#
# The second header line contains the units.
RAW_COLUMNS = [
    "YY",
    "MM",
    "DD",
    "hh",
    "mm",
    "WDIR",
    "WSPD",
    "GST",
    "WVHT",
    "DPD",
    "APD",
    "MWD",
    "PRES",
    "ATMP",
    "WTMP",
    "DEWP",
    "VIS",
    "TIDE",
]


# NDBC missing-value markers.
MISSING_VALUES = [
    "MM",
    "MM.MM",
    "99",
    "99.0",
    "99.00",
    "999",
    "999.0",
    "999.00",
    "9999",
    "9999.0",
    "9999.00",
]


# NDBC standard meteorological files report wind speed/gust in m/s.
MS_TO_KNOTS = 1.943844492


def read_ndbc_file(path: Path) -> pd.DataFrame:
    """Read one compressed NDBC historical observation file."""

    with gzip.open(path, "rt", encoding="ascii", errors="replace") as stream:
        lines = stream.readlines()

    # Remove comment/header lines.
    data_lines = [
        line
        for line in lines
        if line.strip() and not line.startswith("#")
    ]

    if not data_lines:
        return pd.DataFrame()

    frame = pd.read_csv(
        StringIO("".join(data_lines)),
        sep=r"\s+",
        header=None,
        names=RAW_COLUMNS,
        engine="python",
        na_values=MISSING_VALUES,
        keep_default_na=True,
    )

    return frame


def station_position(station: str) -> tuple[float | None, float | None]:
    """Return approximate station coordinates."""

    positions = {
        "41001": (34.703, -72.702),
        "41002": (31.759, -74.936),
        "42002": (25.790, -93.666),
        "42003": (26.010, -85.603),
        "42012": (30.064, -87.555),
    }

    return positions.get(station, (None, None))


def transform(
    frame: pd.DataFrame,
    station: str,
    source_file: str,
) -> pd.DataFrame:
    """Transform raw NDBC observations into ORCA-X ML features."""

    if frame.empty:
        return frame

    frame = frame.copy()

    frame["station_id"] = station
    frame["source_file"] = source_file

    # ------------------------------------------------------------------
    # Timestamp
    # ------------------------------------------------------------------

    timestamp_parts = frame[
        ["YY", "MM", "DD", "hh", "mm"]
    ].copy()

    timestamp_parts.columns = [
        "year",
        "month",
        "day",
        "hour",
        "minute",
    ]

    for column in timestamp_parts.columns:
        timestamp_parts[column] = pd.to_numeric(
            timestamp_parts[column],
            errors="coerce",
        )

    frame["timestamp"] = pd.to_datetime(
        timestamp_parts,
        errors="coerce",
        utc=True,
    )

    # ------------------------------------------------------------------
    # Numeric conversion
    # ------------------------------------------------------------------

    numeric_columns = [
        "WDIR",
        "WSPD",
        "GST",
        "WVHT",
        "DPD",
        "APD",
        "MWD",
        "PRES",
        "ATMP",
        "WTMP",
        "DEWP",
        "VIS",
        "TIDE",
    ]

    for column in numeric_columns:
        frame[column] = pd.to_numeric(
            frame[column],
            errors="coerce",
        )

    # ------------------------------------------------------------------
    # Convert units
    # ------------------------------------------------------------------

    # NDBC WSPD and GST are m/s.
    # ORCA-X uses knots for wind features.
    frame["wind_speed_kts"] = (
        frame["WSPD"] * MS_TO_KNOTS
    )

    frame["wind_gust_kts"] = (
        frame["GST"] * MS_TO_KNOTS
    )

    # WVHT is already metres.
    frame["wave_height_m"] = frame["WVHT"]

    # Dominant wave period.
    frame["wave_period_s"] = frame["DPD"]

    # Average wave period.
    frame["mean_wave_period_s"] = frame["APD"]

    # Directions are degrees.
    frame["wind_direction_deg"] = frame["WDIR"]
    frame["wave_direction_deg"] = frame["MWD"]

    # Atmospheric pressure.
    frame["air_pressure_hpa"] = frame["PRES"]

    # Temperatures.
    frame["air_temperature_c"] = frame["ATMP"]
    frame["water_temperature_c"] = frame["WTMP"]

    # NDBC VIS is nautical miles.
    frame["visibility_nm"] = frame["VIS"]

    # ------------------------------------------------------------------
    # Station metadata
    # ------------------------------------------------------------------

    latitude, longitude = station_position(station)

    frame["latitude"] = latitude
    frame["longitude"] = longitude

    frame["month"] = frame["timestamp"].dt.month
    frame["hour"] = frame["timestamp"].dt.hour

    # ------------------------------------------------------------------
    # Proxy risk label
    # ------------------------------------------------------------------

    frame[TARGET_COLUMN] = frame.apply(
        assign_proxy_risk,
        axis=1,
    )

    frame["risk_label"] = frame[TARGET_COLUMN].map(
        RISK_CLASS_NAMES
    )

    # ------------------------------------------------------------------
    # Select ORCA-X ML columns
    # ------------------------------------------------------------------

    keep = [
        "station_id",
        "timestamp",
        *FEATURE_COLUMNS,
        TARGET_COLUMN,
        "risk_label",
        "source_file",
    ]

    return frame[keep]


def main() -> None:

    records: list[pd.DataFrame] = []

    files = sorted(
        RAW_DIR.glob("*/**/*.txt.gz")
    )

    if not files:
        raise SystemExit(
            "No NDBC raw files found. Run:\n"
            "python ml/src/download_ndbc.py "
            "--stations 41001 41002 42002 "
            "--years 2024 2025"
        )

    total_raw_rows = 0
    total_transformed_rows = 0

    for path in files:

        station = path.parent.name

        print(f"READ  {path}")

        try:

            raw = read_ndbc_file(path)

            total_raw_rows += len(raw)

            print(
                f"      Raw rows: {len(raw):,}"
            )

            transformed = transform(
                raw,
                station,
                path.name,
            )

            total_transformed_rows += len(transformed)

            if not transformed.empty:
                records.append(transformed)

        except Exception as exc:

            print(
                f"WARN  skipped {path}: {exc}"
            )

    if not records:
        raise SystemExit(
            "No usable observations were parsed "
            "from the raw NDBC files."
        )

    dataset = pd.concat(
        records,
        ignore_index=True,
    )

    # Remove invalid timestamps.
    dataset = dataset.dropna(
        subset=["timestamp"]
    )

    # Sort chronologically.
    dataset = dataset.sort_values(
        ["station_id", "timestamp"]
    )

    # Remove duplicate station/timestamp observations.
    dataset = dataset.drop_duplicates(
        subset=[
            "station_id",
            "timestamp",
        ],
        keep="last",
    )

    # Keep observations where at least one major environmental
    # measurement is available.
    required = [
        "wind_speed_kts",
        "wind_gust_kts",
        "wave_height_m",
        "air_pressure_hpa",
    ]

    dataset = dataset.dropna(
        subset=required,
        how="all",
    )

    # ------------------------------------------------------------------
    # Save processed dataset
    # ------------------------------------------------------------------

    PROCESSED_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    parquet_path = (
        PROCESSED_DIR /
        "ndbc_marine_risk.parquet"
    )

    csv_path = (
        PROCESSED_DIR /
        "ndbc_marine_risk.csv"
    )

    manifest_path = (
        PROCESSED_DIR /
        "dataset_manifest.json"
    )

    dataset.to_parquet(
        parquet_path,
        index=False,
    )

    dataset.to_csv(
        csv_path,
        index=False,
    )

    # ------------------------------------------------------------------
    # Dataset manifest
    # ------------------------------------------------------------------

    class_distribution = (
        dataset[TARGET_COLUMN]
        .value_counts()
        .sort_index()
    )

    manifest = {
        "dataset_name": DATASET_NAME,
        "dataset_version": DATASET_VERSION,
        "source": (
            "NOAA National Data Buoy Center (NDBC) "
            "historical standard meteorological observations"
        ),
        "raw_files": len(files),
        "raw_rows": int(total_raw_rows),
        "transformed_rows": int(total_transformed_rows),
        "rows": int(len(dataset)),
        "stations": sorted(
            dataset["station_id"]
            .dropna()
            .unique()
            .tolist()
        ),
        "features": FEATURE_COLUMNS,
        "target": TARGET_COLUMN,
        "target_type": (
            "proxy operational severity label"
        ),
        "risk_classes": RISK_CLASS_NAMES,
        "class_distribution": {
            str(k): int(v)
            for k, v in class_distribution.items()
        },
        "artifacts": [
            parquet_path.name,
            csv_path.name,
        ],
        "unit_conversions": {
            "wind_speed": "m/s → knots",
            "wind_gust": "m/s → knots",
            "wave_height": "metres",
            "wave_period": "seconds",
            "visibility": "nautical miles",
        },
        "warning": (
            "Labels are threshold-derived operational "
            "proxies, not historical vessel-incident outcomes."
        ),
    }

    manifest_path.write_text(
        json.dumps(
            manifest,
            indent=2,
        ),
        encoding="utf-8",
    )

    # ------------------------------------------------------------------
    # Console summary
    # ------------------------------------------------------------------

    print()
    print("=" * 60)
    print("ORCA-X DATASET PREPARATION COMPLETE")
    print("=" * 60)

    print(
        f"Raw rows:         {total_raw_rows:,}"
    )

    print(
        f"Transformed rows: {total_transformed_rows:,}"
    )

    print(
        f"Prepared rows:    {len(dataset):,}"
    )

    print()
    print("Stations:")

    print(
        dataset["station_id"]
        .value_counts()
        .sort_index()
    )

    print()
    print("Risk distribution:")

    print(
        dataset[TARGET_COLUMN]
        .map(RISK_CLASS_NAMES)
        .value_counts()
        .sort_index()
    )

    print()
    print(
        f"Parquet: {parquet_path}"
    )

    print(
        f"CSV:     {csv_path}"
    )

    print(
        f"Manifest:{manifest_path}"
    )


if __name__ == "__main__":
    main()