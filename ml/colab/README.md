# ORCA-X Google Colab ML

Use `ORCA_X_Refinements_GPU.ipynb` as the main Colab entry point.

## Quick start

1. Open the notebook in Google Colab.
2. Select a GPU runtime (T4/L4 when available).
3. Run all setup/preflight cells.
4. Run one heavy training/refinement job at a time.

### Production training

```python
!python ml/src/train.py
```

### Refinement 26

```python
!python ml/src/colab_gpu_runner.py ml/src/refinement26_uncertainty_aware_forecast.py
```

### Refinement 25

```python
!python ml/src/colab_gpu_runner.py ml/src/refinement25_temporal_reliability_forecast.py
```

### Any other XGBoost script

```python
!python ml/src/colab_gpu_runner.py ml/src/<script>.py
```

The runner is intentionally a runtime adapter. It does not alter targets, features, validation splits, holdouts, risk policy, or uncertainty methodology.
