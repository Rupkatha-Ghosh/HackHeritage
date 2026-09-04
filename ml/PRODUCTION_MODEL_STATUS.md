# ORCA-X Production ML Artifact Status

## Current committed artifact

The committed `ml/models/orca_xgb_risk.json` is the currently deployable XGBoost artifact. Its embedded XGBoost feature contract is the legacy 14-feature schema:

- wind_speed_kts
- wind_gust_kts
- wave_height_m
- wave_period_s
- mean_wave_period_s
- wind_direction_deg
- wave_direction_deg
- air_pressure_hpa
- air_temperature_c
- water_temperature_c
- latitude
- longitude
- month
- hour

The inference service now verifies that this embedded contract exactly matches `orca_xgb_risk_metadata.json` before serving predictions.

## Important limitation

This artifact is **not yet the final live-forecast ORCA-X model**. It can perform point-in-time inference when those 14 features are available, but it must not be presented as a validated tomorrow-specific safety forecast merely because current weather/marine data are supplied.

The repository's newer training pipeline (`ml/src/train.py`) defines the forward 6-hour target and the newer operational feature pipeline. That pipeline is the intended path for the next production artifact, but a model must be retrained and its generated metadata/evaluation artifacts must be committed together before it is promoted.

## Required production promotion gate

Before calling the live forecast system production-ready:

1. Train the current forward 6-hour model using the locked 2020–2023 train / 2024 validation / 2025 temporal-test protocol.
2. Keep the 2025 final temporal test completely out of model selection.
3. Run the spatial Digha holdout and the Refinement 39 audit.
4. Verify that the saved XGBoost feature names, metadata feature list, feature count, classes and model version agree.
5. Feed forecast values from the live provider through the same feature contract used during training.
6. Evaluate forecast-input inference against held-out observations before claiming operational forecast reliability.
7. Combine ML output with authoritative IMD/INCOIS/Coast Guard evidence; ML is decision support, not a statutory navigation or safety guarantee.

Until these gates are satisfied, the UI/API should distinguish **live observation risk** from **forecast risk** and should not label a current-observation prediction as a prediction for tomorrow.
