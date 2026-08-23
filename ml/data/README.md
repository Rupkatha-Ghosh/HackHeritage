# ORCA-X ML data

This directory documents the reproducible datasets used to train and evaluate the ORCA-X marine-risk model.

## Layout

- `raw/` — downloaded NDBC source observations. These are reproducible inputs and are intentionally not committed.
- `processed/` — normalized training/evaluation datasets produced by `ml/src/prepare_dataset.py`; generated CSV/Parquet outputs are intentionally not committed.
- `processed/dataset_manifest.json` — checked-in metadata describing the dataset build used for the committed model.

Keeping generated datasets out of Git prevents the application repository from carrying large training artifacts. The production inference model remains checked in under `ml/models/`.

## Rebuild

From the repository root:

```bash
python ml/src/download_ndbc.py
python ml/src/prepare_dataset.py
```

Then train with:

```bash
python ml/src/train.py
```

The inference API loads the checked-in model from `ml/models/orca_xgb_risk.json`.
