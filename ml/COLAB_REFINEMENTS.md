# ORCA-X Colab GPU ML workflow

The ML directory has been audited for Colab execution. The goal is to move **heavy XGBoost computation** from the developer laptop to a Colab T4/L4 GPU without changing the completed ORCA-X refinement methodology.

## Single recommended workflow

Open `ml/colab/ORCA_X_Refinements_GPU.ipynb` in Google Colab.

1. Select `Runtime > Change runtime type > GPU` and use T4/L4 when available.
2. Run the installation cell.
3. Run `python ml/src/colab_preflight.py`.
4. Run **one** expensive training/refinement at a time.

The preflight checks Python package availability, GPU visibility, and compilation of every `ml/src/*.py` file. It also enumerates scripts that import/use XGBoost.

## Canonical production model

```bash
python ml/src/train.py
```

In the Colab notebook this executes with:

```text
ORCA_X_DEVICE=cuda
ORCA_X_N_JOBS=2
```

`train.py` already has first-class CUDA configuration and remains CPU-compatible by default on a developer machine.

## Existing XGBoost refinements/training scripts

The repository contains multiple historical training, tuning, benchmark and refinement scripts using XGBoost, including the later Refinements 14, 18, 19, 22, 23, 24, 25 and 26 and supporting tuning/evaluation scripts. They should be launched through the adapter when GPU acceleration is desired:

```bash
python ml/src/colab_gpu_runner.py ml/src/<script>.py
```

For example:

```bash
python ml/src/colab_gpu_runner.py ml/src/refinement25_temporal_reliability_forecast.py
python ml/src/colab_gpu_runner.py ml/src/refinement26_uncertainty_aware_forecast.py
python ml/src/colab_gpu_runner.py ml/src/tune_xgboost.py
```

The adapter covers `XGBClassifier`, `XGBRegressor` and `XGBRanker`, sets `device="cuda"`, keeps `tree_method="hist"`, limits estimator-level CPU parallelism to a sensible Colab default, and fails early when no NVIDIA GPU is visible.

## What is and is not GPU-accelerated

GPU:

- XGBoost tree construction;
- XGBoost model prediction performed by the estimator.

Colab CPU:

- pandas data loading/transforms;
- NumPy feature calculations;
- scikit-learn metrics and calibration utilities;
- CSV/JSON/parquet I/O;
- ordinary Python orchestration.

This is expected. The purpose is to remove the expensive XGBoost training workload from the user's laptop.

## Methodology preservation

This change is a **runtime/compute migration only**. It does not change:

- the six-hour forward forecasting horizon;
- point-in-time feature constraints;
- temporal validation rules;
- Digha spatial holdout;
- observation-degradation scenarios;
- uncertainty calibration;
- risk-policy thresholds;
- production inference contract;
- completed refinement conclusions.

The Colab runner is intentionally separate from the refinement implementations so a GPU run cannot silently become a new scientific variant.

## Important local-terminal rule

This command on the developer's laptop:

```bash
python ml/src/refinement26_uncertainty_aware_forecast.py
```

still uses the laptop CPU. A Colab GPU is not remotely attached to a local PowerShell process.

Use this **inside Colab** instead:

```bash
!python ml/src/colab_gpu_runner.py ml/src/refinement26_uncertainty_aware_forecast.py
```

## Data and artifacts

The Colab environment is ephemeral. Rebuild/download the required processed dataset in Colab and export generated model/evaluation artifacts before the runtime is deleted. Do not commit large raw datasets merely to make Colab work.
