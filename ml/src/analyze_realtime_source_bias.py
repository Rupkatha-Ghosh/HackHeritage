"""Analyze persisted ORCA-X multi-source telemetry before any ML retraining.

This script intentionally does not train or modify a model. It measures source
coverage, missingness, quality and pairwise disagreement from the JSONL telemetry
written by the server.
"""

from __future__ import annotations

import json
import os
from collections import defaultdict
from pathlib import Path
from statistics import mean

VARIABLES = [
    "windSpeedKts",
    "windGustKts",
    "waveHeightMeters",
    "wavePeriodSec",
    "swellHeightMeters",
    "swellPeriodSec",
    "seaSurfaceTemperatureC",
]

DEFAULT_PATH = Path("data/realtime/marine_telemetry.jsonl")


def load_events(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"Telemetry file not found: {path}. Run the realtime collector first.")
    events: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            item = json.loads(line)
            if isinstance(item, dict) and isinstance(item.get("sources"), list):
                events.append(item)
        except json.JSONDecodeError:
            continue
    return events


def main() -> None:
    path = Path(os.getenv("ORCA_TELEMETRY_PATH", str(DEFAULT_PATH)))
    events = load_events(path)
    source_rows: dict[str, list[dict]] = defaultdict(list)
    pair_rows: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    signed_rows: dict[tuple[str, str, str], list[float]] = defaultdict(list)

    for event in events:
        sources = event["sources"]
        for source in sources:
            source_rows[source.get("source", "UNKNOWN")].append(source)
        for left_idx, left in enumerate(sources):
            for right in sources[left_idx + 1 :]:
                left_name, right_name = sorted((left.get("source", "UNKNOWN"), right.get("source", "UNKNOWN")))
                left_by_var = left.get("values", {})
                right_by_var = right.get("values", {})
                for variable in VARIABLES:
                    a = left_by_var.get(variable)
                    b = right_by_var.get(variable)
                    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
                        continue
                    denominator = max(abs(float(b)), 0.1)
                    key = (left_name, right_name, variable)
                    pair_rows[key].append(abs(float(a) - float(b)) / denominator)
                    signed_rows[key].append(float(a) - float(b))

    report = {
        "event_count": len(events),
        "sources": {
            source: {
                "observations": len(rows),
                "live_rate": round(sum(row.get("availability") == "LIVE" for row in rows) / len(rows), 4),
                "mean_quality": round(mean(float(row.get("qualityScore", 0)) for row in rows), 4),
                "mean_missing_variables": round(mean(len(row.get("missingVariables", [])) for row in rows), 2),
            }
            for source, rows in sorted(source_rows.items())
        },
        "pairwise_bias": {
            f"{left}__{right}__{variable}": {
                "samples": len(values),
                "mean_relative_difference": round(mean(values), 4),
                "mean_signed_difference": round(mean(signed_rows[(left, right, variable)]), 4),
            }
            for (left, right, variable), values in sorted(pair_rows.items())
        },
        "gate": {
            "ready_for_retraining": False,
            "reason": "Collect parallel-source telemetry first, inspect source coverage/disagreement and document distribution shift before retraining XGBoost.",
        },
    }

    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
