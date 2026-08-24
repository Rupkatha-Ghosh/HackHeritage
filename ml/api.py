"""ORCA-X v2 XGBoost ML inference API."""
from __future__ import annotations

from pathlib import Path
import sys

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ML_ROOT = Path(__file__).resolve().parent
ML_SRC = ML_ROOT / "src"
if str(ML_SRC) not in sys.path:
    sys.path.insert(0, str(ML_SRC))

from predict import MODEL_VERSION, OrcaXRiskPredictor  # noqa: E402

app = FastAPI(
    title="ORCA-X ML Risk API",
    description="XGBoost marine environmental risk prediction using real historical coastal data.",
    version="2.0.0",
)

predictor = OrcaXRiskPredictor()


class RiskRequest(BaseModel):
    wind_speed_kts: float = Field(ge=0, le=150)
    wind_gust_kts: float = Field(ge=0, le=180)
    wave_height_m: float = Field(ge=0, le=30)
    wave_period_s: float = Field(ge=0, le=40)
    swell_height_m: float = Field(ge=0, le=30)
    swell_period_s: float = Field(ge=0, le=60)
    wind_direction_deg: float = Field(ge=0, le=360)
    wave_direction_deg: float = Field(ge=0, le=360)
    swell_direction_deg: float = Field(ge=0, le=360)
    air_pressure_hpa: float = Field(ge=850, le=1100)
    air_temperature_c: float = Field(ge=-80, le=60)
    sea_surface_temperature_c: float = Field(ge=-5, le=45)
    precipitation_mm: float = Field(ge=0, le=500)
    visibility_km: float = Field(ge=0, le=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    month: int = Field(ge=1, le=12)
    season: int = Field(ge=0, le=3)


@app.get("/")
def root():
    return {
        "service": "ORCA-X ML Risk API",
        "status": "online",
        "model": "XGBoost",
        "model_version": MODEL_VERSION,
        "feature_count": len(predictor.feature_columns),
        "deployment_validation": "INDIAN_COASTAL_HISTORICAL_PROXY_VALIDATED_NOT_A_STATUTORY_WARNING",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": predictor.model is not None,
        "model_version": MODEL_VERSION,
        "feature_count": len(predictor.feature_columns),
    }


@app.get("/ready")
def ready():
    if predictor.model is None:
        raise HTTPException(status_code=503, detail="ML model is not loaded")
    return {"status": "ready", "model_loaded": True, "model_version": MODEL_VERSION, "feature_count": len(predictor.feature_columns)}


@app.post("/predict-risk")
def predict_risk(request: RiskRequest):
    try:
        result = predictor.predict_one(request.model_dump())
        return {"success": True, **result}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Risk prediction failed: {exc}") from exc
