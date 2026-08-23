"""ORCA-X XGBoost ML inference API."""

from __future__ import annotations

from pathlib import Path
import sys

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ML_ROOT = Path(__file__).resolve().parent
ML_SRC = ML_ROOT / "src"
if str(ML_SRC) not in sys.path:
    sys.path.insert(0, str(ML_SRC))

from predict import OrcaXRiskPredictor  # noqa: E402

app = FastAPI(
    title="ORCA-X ML Risk API",
    description="XGBoost-based marine environmental risk prediction service.",
    version="1.1.0",
)

predictor = OrcaXRiskPredictor()


class RiskRequest(BaseModel):
    wind_speed_kts: float
    wind_gust_kts: float
    wave_height_m: float
    wave_period_s: float
    mean_wave_period_s: float
    wind_direction_deg: float
    wave_direction_deg: float
    air_pressure_hpa: float
    air_temperature_c: float
    water_temperature_c: float
    latitude: float
    longitude: float
    month: int = Field(ge=1, le=12)
    hour: int = Field(ge=0, le=23)


@app.get("/")
def root():
    return {
        "service": "ORCA-X ML Risk API",
        "status": "online",
        "model": "XGBoost",
        "model_version": "orca-xgb-risk-v1",
        "deployment_validation": "NOT_VALIDATED_FOR_INDIAN_COASTAL_DOMAIN",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": predictor.model is not None,
        "model_version": "orca-xgb-risk-v1",
        "deployment_validation": "NOT_VALIDATED_FOR_INDIAN_COASTAL_DOMAIN",
    }


@app.post("/predict-risk")
def predict_risk(request: RiskRequest):
    try:
        result = predictor.predict_one(request.model_dump())
        return {"success": True, **result}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Risk prediction failed: {exc}") from exc
