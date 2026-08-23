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
    version="1.0.0",
)

predictor = OrcaXRiskPredictor()


class RiskRequest(BaseModel):
    wind_speed_kts: float | None = None
    wind_gust_kts: float | None = None
    wave_height_m: float | None = None
    wave_period_s: float | None = None
    mean_wave_period_s: float | None = None
    wind_direction_deg: float | None = None
    wave_direction_deg: float | None = None
    air_pressure_hpa: float | None = None
    air_temperature_c: float | None = None
    water_temperature_c: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    month: int | None = Field(default=None, ge=1, le=12)
    hour: int | None = Field(default=None, ge=0, le=23)


@app.get("/")
def root():
    return {"service": "ORCA-X ML Risk API", "status": "online", "model": "XGBoost"}


@app.get("/health")
def health():
    return {"status": "healthy", "model_loaded": predictor.model is not None}


@app.post("/predict-risk")
def predict_risk(request: RiskRequest):
    try:
        result = predictor.predict_one(request.model_dump())
        return {"success": True, **result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Risk prediction failed: {exc}") from exc
