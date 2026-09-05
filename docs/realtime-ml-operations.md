# ORCA-X three-source realtime ML operations

This workflow connects the three-source server fusion layer to the existing XGBoost live-training pipeline without changing the production model.

## Runtime data flow

1. The ORCA-X server collector runs every `REALTIME_COLLECTION_INTERVAL_MS` and queries INCOIS, MOSDAC, and Open-Meteo concurrently.
2. The fusion layer normalizes every source, applies freshness/quality rules, selects values per variable, and records `fusedValues` plus `featureSources` in `ORCA_TELEMETRY_PATH`.
3. `npm run import:realtime-ml` converts persisted fused telemetry into `ml/data/processed/live/live_observations.parquet`.
4. `npm run sync:realtime-ml` performs steps 3 and 5 repeatedly at `REALTIME_ML_SYNC_INTERVAL_SECONDS`.
5. `python ml/src/realtime_training.py mature` waits for the +6h horizon and obtains the observed future label using the existing operational risk policy. It does not label a row before the target exists.
6. `python ml/src/realtime_training.py train-candidate` may be run only after the source evidence/distribution gates are reviewed. It creates a candidate artifact and never promotes automatically.

## Local development

Terminal 1 — ORCA-X server:

```powershell
$env:REALTIME_COLLECTION_ENABLED="true"
$env:REALTIME_COLLECTION_INTERVAL_MS="900000"
npm run dev
```

Terminal 2 — ML telemetry bridge:

```powershell
$env:REALTIME_ML_SYNC_INTERVAL_SECONDS="900"
npm run sync:realtime-ml
```

Terminal 3 — inspect evidence:

```powershell
npm run analyze:realtime
```

The collector can run with only Open-Meteo configured, but the evidence gate must remain closed until at least two sources have real live observations. An `INCOIS` or `MOSDAC` entry with `UNAVAILABLE`, stale data, or an empty normalized value set is not counted as a live source.

## MOSDAC requirement

The repository does not store MOSDAC credentials and does not invent an undocumented NRT endpoint. Production MOSDAC observations must arrive through either:

- `MOSDAC_REALTIME_URL`, an approved normalized gateway; or
- `MOSDAC_REALTIME_CACHE_FILE`, generated from an official MOSDAC API/download product using `scripts/mosdac-normalize.py`.

## ML safety rules

- Production `orca_xgb_risk.json` is not modified by this workflow.
- Live observations are point-in-time inputs; no future values are copied into the feature vector.
- +6h labels are created only after the target time matures.
- Source provenance is retained for every fused feature.
- The three-source evidence gate is separate from model promotion.
- v2.7 promotion requires the locked 2025 temporal test and Digha spatial holdout, plus review of source distribution shift and calibration.
