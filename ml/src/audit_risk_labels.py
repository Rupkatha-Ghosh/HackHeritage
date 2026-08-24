"""Audit the ORCA-X operational label policy before model selection."""
from __future__ import annotations
import json
from pathlib import Path
import pandas as pd
from config import PROCESSED_DIR, TARGET_COLUMN
from label_policy import assign_operational_risk, RISK_CLASS_NAMES, WIND_CAUTION_KTS, WIND_GALE_KTS, WIND_EXTREME_KTS, SEA_SLIGHT_MAX_M, SEA_MODERATE_MAX_M, SEA_ROUGH_MAX_M


def main():
    path = PROCESSED_DIR / "orca_historical_marine_risk.parquet"
    df = pd.read_parquet(path)
    required = ["wind_speed_kts", "wind_gust_kts", "wave_height_m", "swell_height_m"]
    missing = [c for c in required if c not in df]
    if missing:
        raise ValueError(f"Missing label inputs: {missing}")
    labels = df.apply(assign_operational_risk, axis=1)
    counts = labels.value_counts().sort_index()
    report = {
        "rows": int(len(df)),
        "class_counts": {RISK_CLASS_NAMES[int(k)]: int(v) for k, v in counts.items()},
        "class_percent": {RISK_CLASS_NAMES[int(k)]: round(float(v / len(df) * 100), 3) for k, v in counts.items()},
        "thresholds": {
            "wind_caution_kts": WIND_CAUTION_KTS,
            "wind_gale_kts": WIND_GALE_KTS,
            "wind_extreme_kts": WIND_EXTREME_KTS,
            "wave_slight_max_m": SEA_SLIGHT_MAX_M,
            "wave_moderate_max_m": SEA_MODERATE_MAX_M,
            "wave_rough_max_m": SEA_ROUGH_MAX_M,
        },
        "single_factor_extreme_share": round(float(((df["wind_speed_kts"].fillna(-1) >= WIND_EXTREME_KTS) | (df["wind_gust_kts"].fillna(-1) >= WIND_EXTREME_KTS) | (df["wave_height_m"].fillna(-1) >= SEA_ROUGH_MAX_M)).mean() * 100), 3),
        "note": "Labels are ORCA-X operational proxies, not observed incidents or official warning labels.",
    }
    out = Path(__file__).resolve().parents[1] / "models" / "risk_label_audit.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Saved label audit: {out}")


if __name__ == "__main__":
    main()
