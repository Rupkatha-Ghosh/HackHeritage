# ORCA-X Google Colab GPU training

The canonical ORCA-X production model is XGBoost. The project can now train that model on a Google Colab GPU without changing the model's data contract or evaluation policy.

## What changed

- `ml/src/train.py` accepts `ORCA_X_DEVICE=cpu|cuda`.
- `ORCA_X_DEVICE=cuda` maps to XGBoost's GPU `device="cuda"` while retaining `tree_method="hist"`.
- `ORCA_X_N_JOBS` controls CPU-side worker parallelism; the Colab notebook uses `2` to avoid unnecessary CPU contention.
- CPU remains the default, so existing local execution is backward-compatible.
- `ml/requirements-colab.txt` contains only the dependencies required for dataset preparation and XGBoost training.
- `ml/colab/ORCA_X_GPU_Training.ipynb` downloads the real historical Open-Meteo dataset, prepares the canonical parquet, trains the production model on GPU, evaluates temporal and Digha spatial holdout performance, and bundles the model artifacts.

## Colab workflow

1. Open `ml/colab/ORCA_X_GPU_Training.ipynb` in Google Colab.
2. Select a T4/L4 GPU runtime.
3. Run all cells.
4. The notebook downloads the historical data instead of requiring the raw dataset to be committed to Git.
5. The canonical training command runs with `ORCA_X_DEVICE=cuda`.
6. Download `orca_x_model_bundle.zip` from Colab and copy its two files into `ml/models/`:
   - `orca_xgb_risk.json`
   - `orca_xgb_risk_metadata.json`

## Important model contract

This is a **compute migration, not a model redesign**. The current training logic remains the source of truth:

- six-hour forward target
- Digha spatial holdout
- temporal validation
- point-in-time features only
- explicit missingness indicators
- circular wind/wave/swell direction encoding
- class-weighted 4-class XGBoost
- production artifact + metadata

Refinements 20–26 remain audit/benchmark work and are not automatically replaced by a new production model.

## Local CPU fallback

The same script still works locally:

```bash
export ORCA_X_DEVICE=cpu
export ORCA_X_N_JOBS=-1
python ml/src/train.py
```

For Colab:

```bash
export ORCA_X_DEVICE=cuda
export ORCA_X_N_JOBS=2
python ml/src/train.py
```

Do not commit the generated model/data artifacts unless the repository's artifact policy explicitly requires it; the Colab notebook is designed to keep the large raw dataset out of Git.
