# ORCA-X three-source realtime ML operations

This workflow connects the three-source server fusion layer to the existing XGBoost live-training pipeline without changing the production model.

## Runtime data flow

1. The ORCA-X server collector runs every `REALTIME_COLLECTION_INTERVAL_MS` and queries INCOIS, MOSDAC, and Open-Meteo concurrently.
2. The fusion layer normalizes every source, applies freshness/quality rules, selects values per variable, and records `fusedValues` plus `featureSources` in `ORCA_TELEMETRY_PATH`.
3. `npm run import:realtime-ml` converts persisted fused telemetry into `ml/data/processed/live/live_observations.parquet`.
4. `npm run sync:realtime-ml` performs the import and +6h maturation repeatedly at `REALTIME_ML_SYNC_INTERVAL_SECONDS`.
5. `python ml/src/realtime_training.py mature` waits for the +6h horizon and obtains the observed future label using the existing operational risk policy. It does not label a row before the target exists.
6. `npm run analyze:realtime` writes an auditable source-evidence report to `ml/evaluations/realtime_source_evidence_gate.json`.
7. `python ml/src/realtime_training.py train-candidate` is blocked unless the evidence criteria pass **and** an engineer explicitly approves distribution-shift review with `ORCA_V27_DISTRIBUTION_SHIFT_APPROVED=true`.
8. A candidate is always saved separately and must pass the locked 2025 temporal and Digha spatial evaluation before any manual promotion review.

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

The collector may run with only Open-Meteo configured, but the evidence gate remains closed until at least two sources have real live observations. An `INCOIS` or `MOSDAC` entry with `UNAVAILABLE`, stale data, or an empty normalized value set is not counted as a live source.

## Evidence gate

The default gate requires:

- at least 100 telemetry events;
- at least 2 sources with at least 80% `LIVE` rate and mean quality >= 0.60;
- at least 50 pairwise samples for source comparison;
- explicit engineering/domain review of source-distribution shift.

The generated report is intentionally ignored by Git because it is deployment/runtime evidence, not source code. It should be retained on persistent deployment storage and attached to the model-review record when v2.7 is considered.

Only after reviewing that report may an engineer run:

```powershell
$env:ORCA_V27_DISTRIBUTION_SHIFT_APPROVED="true"
python ml/src/realtime_training.py train-candidate
```

This flag is an explicit human/engineering acknowledgement; it is not a claim that the sources are ground truth or that the model is safe.

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
