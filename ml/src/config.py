from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ML_ROOT = PROJECT_ROOT / "ml"
RAW_DIR = ML_ROOT / "data" / "raw" / "ndbc"
PROCESSED_DIR = ML_ROOT / "data" / "processed"
MODELS_DIR = ML_ROOT / "models"

# Keep the default training/evaluation station list aligned with the
# committed dataset manifest and evaluation artifacts.
DEFAULT_STATIONS = ["41001", "41002", "42002"]
DEFAULT_YEARS = [2024, 2025]

NDBC_BASE = "https://www.ndbc.noaa.gov/data/historical/stdmet"
DATASET_NAME = "NOAA NDBC Standard Meteorological Observations"
DATASET_VERSION = "historical standard meteorological station/year files"
TARGET_COLUMN = "risk_class"

FEATURE_COLUMNS = [
    "wind_speed_kts",
    "wind_gust_kts",
    "wave_height_m",
    "wave_period_s",
    "mean_wave_period_s",
    "wind_direction_deg",
    "wave_direction_deg",
    "air_pressure_hpa",
    "air_temperature_c",
    "water_temperature_c",
    "latitude",
    "longitude",
    "month",
    "hour",
]

# "visibility_nm",
