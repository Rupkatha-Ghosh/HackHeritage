"""Run any ORCA-X XGBoost refinement inside a Colab GPU runtime.

Usage from the repository root:
    python ml/src/colab_gpu_runner.py ml/src/refinement26_uncertainty_aware_forecast.py

The runner deliberately does not change refinement logic. It only configures the
process for CUDA and injects the GPU device into XGBoost estimators that do not
explicitly choose a device. CPU remains the default for direct script execution.
"""
from __future__ import annotations

import argparse
import os
import runpy
import sys
from pathlib import Path


def _configure_environment() -> None:
    os.environ["ORCA_X_DEVICE"] = "cuda"
    # XGBoost's GPU training is controlled by device; n_jobs controls CPU-side
    # orchestration and should not be set to an unnecessarily large value in Colab.
    os.environ.setdefault("ORCA_X_N_JOBS", "2")


def _patch_xgboost() -> None:
    """Make legacy refinement scripts GPU-aware without changing their algorithms."""
    try:
        import xgboost as xgb
    except ImportError as exc:
        raise SystemExit("xgboost is not installed. Run: pip install -r ml/requirements-colab.txt") from exc

    device = os.getenv("ORCA_X_DEVICE", "cuda")
    n_jobs = int(os.getenv("ORCA_X_N_JOBS", "2"))

    for class_name in ("XGBClassifier", "XGBRegressor"):
        original = getattr(xgb, class_name)
        if getattr(original, "_orca_colab_patched", False):
            continue

        def make_wrapper(base_class):
            def wrapper(*args, **kwargs):
                kwargs.setdefault("device", device)
                kwargs.setdefault("tree_method", "hist")
                kwargs.setdefault("n_jobs", n_jobs)
                return base_class(*args, **kwargs)

            wrapper.__name__ = base_class.__name__
            wrapper.__qualname__ = base_class.__qualname__
            wrapper.__doc__ = base_class.__doc__
            wrapper._orca_colab_patched = True
            return wrapper

        setattr(xgb, class_name, make_wrapper(original))

    # The public xgboost module is shared by every import in the target script.
    print(f"ORCA-X Colab runner: XGBoost device={device}, n_jobs={n_jobs}")
    print(f"XGBoost version: {xgb.__version__}")
    try:
        import subprocess
        subprocess.run(["nvidia-smi"], check=False)
    except OSError:
        print("WARNING: nvidia-smi is unavailable. Make sure the Colab runtime has a GPU attached.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script", help="Path to an ORCA-X Python refinement/training script")
    parser.add_argument("script_args", nargs=argparse.REMAINDER, help="Arguments forwarded to the target script")
    args = parser.parse_args()

    target = Path(args.script).resolve()
    if not target.exists() or target.suffix != ".py":
        raise SystemExit(f"Target Python script not found: {target}")

    _configure_environment()
    _patch_xgboost()

    # Match normal `python ml/src/script.py` import behavior so modules such as
    # config.py and label_policy.py continue to resolve from ml/src.
    script_dir = str(target.parent)
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)

    # Preserve a normal script-like argv for argparse-based refinements.
    sys.argv = [str(target), *args.script_args]
    runpy.run_path(str(target), run_name="__main__")


if __name__ == "__main__":
    main()
