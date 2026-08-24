# ORCA-X ML data

## Refinement 4 / v2.1

The active model is trained from real historical Open-Meteo weather + marine observations at six representative Indian coastal points.

Run:

```bash
python ml/src/download_historical_marine.py
python ml/src/prepare_dataset.py
python ml/src/train.py
```

The training target is a **six-hour forward operational severity proxy**. The current environmental state is used as input and the risk class is derived from conditions six hours later. This is intentional: using the same observation to create both X and y would make the model reproduce the labeling rule and can produce misleading 1.0000 validation scores.

The v2.1 model excludes `visibility_km` because the historical archive used in this build returned it as 100% missing. No synthetic visibility values are introduced. Other missing marine observations remain missing and are handled by XGBoost's native missing-value support.

Evaluation includes a chronological temporal validation split and a complete Digha spatial holdout, plus majority-class baselines. Raw and generated tabular data are intentionally ignored by Git; `dataset_manifest.json` is regenerated locally.

The previous NOAA NDBC pipeline remains available for comparison/audit but is no longer the primary Refinement 4 training source.
