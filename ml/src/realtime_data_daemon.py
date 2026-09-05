"""Continuously bridge server-side fused telemetry into the ML live store.

Run this process alongside the ORCA-X server when persistent shared storage is available.
It imports fused 17-feature observations and matures +6h labels. It never trains or
promotes a model automatically.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INTERVAL_SECONDS = max(300, int(os.environ.get("REALTIME_ML_SYNC_INTERVAL_SECONDS", "900")))


def run(command: str) -> None:
    script = ROOT / "ml" / "src" / f"{command}.py"
    result = subprocess.run([sys.executable, str(script)], cwd=ROOT, check=False)
    if result.returncode != 0:
        print(f"REALTIME ML SYNC: {command} exited with code {result.returncode}")


def main() -> None:
    print(f"Realtime ML sync enabled: interval={INTERVAL_SECONDS}s")
    while True:
        started = time.monotonic()
        try:
            run("import_realtime_telemetry")
            run("realtime_training")
            # realtime_training.py requires an explicit command; the mature operation is
            # intentionally invoked separately so this daemon never trains a candidate.
            result = subprocess.run(
                [sys.executable, str(ROOT / "ml" / "src" / "realtime_training.py"), "mature"],
                cwd=ROOT,
                check=False,
            )
            if result.returncode != 0:
                print(f"REALTIME ML SYNC: mature exited with code {result.returncode}")
        except Exception as exc:
            print(f"REALTIME ML SYNC: cycle failed: {exc}")
        elapsed = time.monotonic() - started
        time.sleep(max(5, INTERVAL_SECONDS - elapsed))


if __name__ == "__main__":
    main()
