# ORCA-X ML data

## Refinement 4

The active v2 dataset is generated locally from real historical Open-Meteo weather and marine observations. See `ml/data/REFINEMENT_4.md` and run:

```bash
python ml/src/download_historical_marine.py
python ml/src/prepare_dataset.py
python ml/src/train.py
```

Raw and generated tabular data are intentionally ignored by Git so the repository does not contain a large, stale training snapshot. `dataset_manifest.json` records the reproducible v2 contract.

The previous NOAA NDBC pipeline remains in `ml/src/download_ndbc.py` and `ml/src/prepare_dataset.py` history for comparison/audit; it is no longer the primary v2 training source.
