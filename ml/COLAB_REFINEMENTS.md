# ORCA-X Colab GPU refinements

Heavy XGBoost refinements should run inside Google Colab rather than the local PowerShell/VS Code terminal when the laptop does not have a suitable GPU.

## Refinement 26

After selecting a T4/L4 GPU runtime:

```bash
python -m pip install -r ml/requirements-colab.txt
python ml/src/colab_gpu_runner.py ml/src/refinement26_uncertainty_aware_forecast.py
```

The runner sets `ORCA_X_DEVICE=cuda`, verifies the NVIDIA runtime with `nvidia-smi`, and injects `device="cuda"` into XGBoost estimators used by the existing refinement scripts.

## Methodology preserved

The Colab change is a **compute migration, not a model redesign**. It does not change:

- target construction;
- feature definitions;
- temporal validation;
- Digha spatial holdout;
- observation-degradation scenarios;
- risk-policy thresholds;
- uncertainty calibration.

Pandas/NumPy/scikit-learn evaluation remains CPU-side in Colab. XGBoost tree computation uses the attached NVIDIA GPU.

## Local terminal warning

Running this on the developer machine:

```bash
python ml/src/refinement26_uncertainty_aware_forecast.py
```

uses the local CPU. The Colab GPU is available only to processes running inside the Colab runtime.

## Recommended notebook

Open `ml/colab/ORCA_X_Refinements_GPU.ipynb` in Colab, select a T4/L4 GPU runtime, and run the notebook. It installs the lightweight ML dependencies, checks `nvidia-smi`, and launches Refinement 26 through the repository GPU runner.

For Refinement 25, use:

```bash
python ml/src/colab_gpu_runner.py ml/src/refinement25_temporal_reliability_forecast.py
```

Do not run multiple heavy refinements simultaneously on one GPU.
