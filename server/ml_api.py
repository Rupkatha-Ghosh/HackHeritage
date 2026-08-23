"""ORCA-X XGBoost ML API."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Allow imports from ml/src
PROJECT_ROOT = Path(__file__).resolve().parents[1]
ML_SRC = PROJECT_ROOT / "ml" / "src"

if str(ML_SRC) not in sys.path:
    sys.path.insert(0, str(ML_SRC))

from predict import OrcaXRiskPredictor


app = FastAPI(
    title="ORCA-X ML Risk API",
    description="XGBoost-based marine environmental risk prediction service.",
    version="1.0.0",
)


predictor = OrcaXRiskPredictor()


class RiskRequest(BaseModel):
    wind_speed_kts: float | None = Field(default=None)
    wind_gust_kts: float | None = Field(default=None)
    wave_height_m: float | None = Field(default=None)
    wave_period_s: float | None = Field(default=None)
    mean_wave_period_s: float | None = Field(default=None)

    wind_direction_deg: float | None = Field(default=None)
    wave_direction_deg: float | None = Field(default=None)

    air_pressure_hpa: float | None = Field(default=None)
    air_temperature_c: float | None = Field(default=None)
    water_temperature_c: float | None = Field(default=None)

    latitude: float | None = Field(default=None)
    longitude: float | None = Field(default=None)

    month: int | None = Field(default=None, ge=1, le=12)
    hour: int | None = Field(default=None, ge=0, le=23)


@app.get("/")
def root():
    return {
        "service": "ORCA-X ML Risk API",
        "status": "online",
        "model": "XGBoost",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": predictor.model is not None,
    }


@app.post("/predict-risk")
def predict_risk(request: RiskRequest):
    try:
        features = request.model_dump()

        result = predictor.predict_one(features)

        return {
            "success": True,
            **result,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Risk prediction failed: {exc}",
        ) from exc