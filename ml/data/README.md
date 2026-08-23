# ORCA-X ML data

This directory contains the datasets used to train and evaluate the ORCA-X marine-risk model.

## Layout

- `raw/` — downloaded NDBC source observations. These are reproducible inputs and should normally be regenerated with `ml/src/download_ndbc.py` rather than committed for new stations/years.
- `processed/` — normalized training/evaluation datasets produced by `ml/src/prepare_dataset.py`.
- `processed/dataset_manifest.json` — metadata describing the checked-in dataset build.

Large generated CSV/Parquet files are ignored for future commits. The currently tracked files remain available for reproducibility of this revision.

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
