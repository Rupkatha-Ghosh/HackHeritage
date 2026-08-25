"""ORCA-X Refinement 4C: probability calibration and safety thresholds.

Selection is temporal-validation-only. Digha is reserved for final audit.
No production model is modified by this script.

The script compares Trial-12 and the class-aware Trial-14 candidate, fits
multiclass probability calibration on a calibration slice of the training
pool, and searches class decision thresholds under explicit safety floors.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    recall_score,
)
from xgboost import XGBClassifier

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "ml" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from config import (  # noqa: E402
    DIGHА_LOCATION if False else DIGHА_LOCATION,
)
