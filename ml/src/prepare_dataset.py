"""Build the ORCA-X v2 training table from real historical Open-Meteo data."""
from __future__ import annotations

import json
from pathlib import Path
import pandas as pd
from config import DATASET_NAME, DATASET_VERSION, FEATURE_COLUMNS, HISTORICAL_LOCATIONS, PROCESSED_DIR, RAW_HISTORICAL_DIR, TARGET_COLUMN
from label_policy import RISK_CLASS_NAMES, assign_operational_risk

KTS_PER_MS = 1.943844492


def load_hourly_json(path: Path) -> pd.DataFrame:
    payload = json.loads(path.read_text(encoding="utf-8"))
    hourly = payload.get("hourly") or {}
    if not hourly.get("time"):
        return pd.DataFrame()
    return pd.DataFrame(hourly)


def season_number(month: int) -> int:
    if month in (12, 1, 2): return 0
    if month in (3, 4, 5): return 1
    if month in (6, 7, 8, 9): return 2
    return 3


def prepare_location(location: dict) -> pd.DataFrame:
    directory = RAW_HISTORICAL_DIR / location["id"]
    weather_files = sorted(directory.glob("weather_*.json"))
    marine_files = sorted(directory.glob("marine_*.json"))
    if not weather_files or not marine_files:
        raise FileNotFoundError(f"Missing raw Open-Meteo files for {location['id']}. Run download_historical_marine.py first.")

    weather = load_hourly_json(weather_files[-1])
    marine = load_hourly_json(marine_files[-1])
    if weather.empty or marine.empty:
        return pd.DataFrame()

    weather["timestamp"] = pd.to_datetime(weather["time"], utc=True, errors="coerce")
    marine["timestamp"] = pd.to_datetime(marine["time"], utc=True, errors="coerce")
    weather = weather.drop(columns=["time"], errors="ignore")
    marine = marine.drop(columns=["time"], errors="ignore")
    frame = pd.merge(weather, marine, on="timestamp", how="inner", suffixes=("", "_marine"))
    frame["location_id"] = location["id"]
    frame["location_name"] = location["name"]
    frame["coastal_region"] = location["region"]
    frame["latitude"] = location["latitude"]
    frame["longitude"] = location["longitude"]

    frame["wind_speed_kts"] = pd.to_numeric(frame["wind_speed_10m"], errors="coerce") * KTS_PER_MS
    frame["wind_gust_kts"] = pd.to_numeric(frame["wind_gusts_10m"], errors="coerce") * KTS_PER_MS
    frame["wave_height_m"] = pd.to_numeric(frame["wave_height"], errors="coerce")
    frame["wave_period_s"] = pd.to_numeric(frame["wave_period"], errors="coerce")
    frame["swell_height_m"] = pd.to_numeric(frame["swell_wave_height"], errors="coerce")
    frame["swell_period_s"] = pd.to_numeric(frame["swell_wave_period"], errors="coerce")
    frame["wind_direction_deg"] = pd.to_numeric(frame["wind_direction_10m"], errors="coerce")
    frame["wave_direction_deg"] = pd.to_numeric(frame["wave_direction"], errors="coerce")
    frame["swell_direction_deg"] = pd.to_numeric(frame["swell_wave_direction"], errors="coerce")
    frame["air_pressure_hpa"] = pd.to_numeric(frame["pressure_msl"], errors="coerce")
    frame["air_temperature_c"] = pd.to_numeric(frame["temperature_2m"], errors="coerce")
    frame["sea_surface_temperature_c"] = pd.to_numeric(frame["sea_surface_temperature"], errors="coerce")
    frame["precipitation_mm"] = pd.to_numeric(frame["precipitation"], errors="coerce")
    # Open-Meteo visibility is metres; ORCA-X stores kilometres.
    frame["visibility_km"] = pd.to_numeric(frame["visibility"], errors="coerce") / 1000.0
    frame["month"] = frame["timestamp"].dt.month.astype("Int64")
    frame["season"] = frame["month"].map(season_number).astype("Int64")

    # Convert every model feature explicitly. This prevents JSON null/string values
    # from leaking into Parquet as object dtype and breaking XGBoost.
    for column in FEATURE_COLUMNS:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    core = ["wind_speed_kts", "wind_gust_kts", "wave_height_m"]
    frame = frame.dropna(subset=core, how="all")
    frame[TARGET_COLUMN] = frame.apply(assign_operational_risk, axis=1).astype("int8")
    frame["risk_label"] = frame[TARGET_COLUMN].map(RISK_CLASS_NAMES)

    keep = ["location_id", "location_name", "coastal_region", "timestamp", *FEATURE_COLUMNS, TARGET_COLUMN, "risk_label"]
    return frame[keep]


def main() -> None:
    records: list[pd.DataFrame] = []
    for location in HISTORICAL_LOCATIONS:
        print(f"READ {location['id']} ({location['name']})")
        try:
            frame = prepare_location(location)
            print(f"  rows: {len(frame):,}")
            if not frame.empty: records.append(frame)
        except Exception as exc:
            print(f"  WARN: {exc}")
    if not records: raise SystemExit("No historical records found. Download the raw dataset first.")

    dataset = pd.concat(records, ignore_index=True).dropna(subset=["timestamp"])
    dataset = dataset.sort_values(["location_id", "timestamp"]).drop_duplicates(["location_id", "timestamp"], keep="last")
    for column in FEATURE_COLUMNS:
        dataset[column] = pd.to_numeric(dataset[column], errors="coerce")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    parquet_path = PROCESSED_DIR / "orca_historical_marine_risk.parquet"
    csv_path = PROCESSED_DIR / "orca_historical_marine_risk.csv"
    manifest_path = PROCESSED_DIR / "dataset_manifest.json"
    dataset.to_parquet(parquet_path, index=False)
    dataset.to_csv(csv_path, index=False)

    distribution = dataset[TARGET_COLUMN].value_counts().sort_index()
    manifest = {
        "dataset_name": DATASET_NAME, "dataset_version": DATASET_VERSION,
        "source": "Open-Meteo Historical Weather API + Historical Marine API",
        "source_urls": ["https://open-meteo.com/en/docs/historical-weather-api", "https://open-meteo.com/en/docs/marine-weather-api"],
        "historical_period": [str(dataset["timestamp"].min()), str(dataset["timestamp"].max())],
        "rows": int(len(dataset)), "locations": sorted(dataset["location_id"].unique().tolist()),
        "features": FEATURE_COLUMNS, "target": TARGET_COLUMN, "risk_classes": RISK_CLASS_NAMES,
        "class_distribution": {str(k): int(v) for k, v in distribution.items()},
        "feature_dtypes": {column: str(dataset[column].dtype) for column in FEATURE_COLUMNS},
        "label_policy": "ORCA-X operational proxy using IMD/RSMC 25/34 kt wind warning bands and WMO Douglas sea-state terminology; not an official warning class or incident outcome.",
        "artifacts": [parquet_path.name, csv_path.name],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("=" * 70)
    print("ORCA-X HISTORICAL DATASET READY")
    print(f"Rows: {len(dataset):,}")
    print(f"Locations: {dataset['location_id'].nunique()}")
    print("Risk distribution:")
    print(dataset["risk_label"].value_counts().sort_index())
    print("Model feature dtypes:")
    print(dataset[FEATURE_COLUMNS].dtypes.to_string())
    print(f"Parquet: {parquet_path}")
    print(f"Manifest: {manifest_path}")

if __name__ == "__main__":
    main()
