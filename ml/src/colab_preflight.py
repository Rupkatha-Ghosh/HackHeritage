"""Validate the ORCA-X Colab ML runtime before an expensive refinement run."""
from __future__ import annotations

import ast
import importlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "ml" / "src"


def xgboost_scripts() -> list[Path]:
    found = []
    for path in sorted(SRC.glob("*.py")):
        if path.name in {"colab_gpu_runner.py", "colab_preflight.py"}:
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except (OSError, SyntaxError):
            continue
        text = path.read_text(encoding="utf-8")
        uses_xgb = any(
            isinstance(node, ast.Name) and node.id.startswith("XGB")
            for node in ast.walk(tree)
        ) or "import xgboost" in text or "from xgboost" in text
        if uses_xgb:
            found.append(path)
    return found


def main() -> None:
    print("=" * 78)
    print("ORCA-X COLAB ML PREFLIGHT")
    print("=" * 78)

    failures = []
    for package in ("numpy", "pandas", "sklearn", "pyarrow", "xgboost"):
        try:
            mod = importlib.import_module(package)
            print(f"OK   {package}: {getattr(mod, '__version__', 'installed')}")
        except Exception as exc:
            failures.append(f"{package}: {exc}")
            print(f"FAIL {package}: {exc}")

    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            check=False, capture_output=True, text=True,
        )
        if result.returncode == 0 and result.stdout.strip():
            print("OK   NVIDIA GPU:", result.stdout.strip())
        else:
            failures.append("No visible NVIDIA GPU")
            print("FAIL NVIDIA GPU: no GPU visible")
    except OSError:
        failures.append("nvidia-smi unavailable")
        print("FAIL NVIDIA GPU: nvidia-smi unavailable")

    scripts = xgboost_scripts()
    print(f"\nDetected XGBoost scripts: {len(scripts)}")
    for path in scripts:
        print(f"  - {path.relative_to(ROOT)}")

    # Compile every ML Python file without executing it. This catches Colab/Python
    # syntax problems before a long training job starts.
    compile_failures = []
    for path in sorted(SRC.glob("*.py")):
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
        except SyntaxError as exc:
            compile_failures.append(f"{path.name}: {exc}")
    if compile_failures:
        failures.extend(compile_failures)
        print("\nFAIL Python compilation:")
        for item in compile_failures:
            print("  ", item)
    else:
        print("OK   Python compilation: all ml/src/*.py files compile")

    print("\n" + "=" * 78)
    if failures:
        print("PREFLIGHT FAILED")
        for item in failures:
            print(" -", item)
        raise SystemExit(1)
    print("PREFLIGHT PASSED — Colab is ready for XGBoost ML execution")


if __name__ == "__main__":
    main()
