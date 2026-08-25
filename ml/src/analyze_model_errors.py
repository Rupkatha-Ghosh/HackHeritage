"""Explain and diagnose ORCA-X marine-risk model errors.

This script is intentionally separate from evaluate_calibration.py and the
holdout evaluators.  It answers *why* the current model fails rather than
changing the production risk policy.

Outputs are written to ``ml/models/error_analysis/``:

* error_analysis.json          - metrics, confusion matrices and summaries
* misclassified_rows.csv       - row-level error cases with probabilities
* feature_importance.csv       - XGBoost gain/split importance
* shap_feature_importance.csv  - mean absolute SHAP importance (when SHAP works)
* shap_class_importance.csv    - per-class SHAP importance (when SHAP works)

Run from the repository root:
    python ml/src/analyze_model_errors.py

The script uses the frozen model in ``ml/models/orca_xgb_risk.json`` and does
not retrain it, modify labels, or overwrite production artifacts.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)

SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from config import FEATURE_COLUMNS, MODELS_DIR, PROCESSED_DIR, TARGET_COLUMN  # noqa: E402
from label_policy import RISK_CLASS_NAMES  # noqa: E402

RANDOM_STATE = 42
CLASSES = [0, 1, 2, 3]
SHAP_SAMPLE_SIZE = 5000


def load_data() -> pd.DataFrame:
    path = PROCESSED_DIR / "ndbc_marine_risk.parquet"
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found: {path}\nRun prepare_dataset.py first."
        )

    df = pd.read_parquet(path).copy()
    required = [*FEATURE_COLUMNS, TARGET_COLUMN]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)

    df = df.dropna(subset=[*FEATURE_COLUMNS, TARGET_COLUMN]).copy()
    df[TARGET_COLUMN] = df[TARGET_COLUMN].astype(int)
    return df


def load_model() -> xgb.XGBClassifier:
    path = MODELS_DIR / "orca_xgb_risk.json"
    if not path.exists():
        raise FileNotFoundError(
            f"Model not found: {path}\nRun train.py first."
        )
    model = xgb.XGBClassifier()
    model.load_model(path)
    return model


def label(class_id: int) -> str:
    return RISK_CLASS_NAMES.get(int(class_id), str(class_id))


def safe_float(value: object) -> float | None:
    try:
        value = float(value)
        return value if np.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def native_feature_importance(model: xgb.XGBClassifier) -> pd.DataFrame:
    """Return gain and split-count importance from the booster."""
    booster = model.get_booster()
    gain = booster.get_score(importance_type="gain")
    weight = booster.get_score(importance_type="weight")

    rows = []
    for index, feature in enumerate(FEATURE_COLUMNS):
        key = f"f{index}"
        rows.append(
            {
                "feature": feature,
                "gain": float(gain.get(key, 0.0)),
                "split_count": int(weight.get(key, 0.0)),
            }
        )

    result = pd.DataFrame(rows)
    total_gain = result["gain"].sum()
    result["gain_fraction"] = (
        result["gain"] / total_gain if total_gain > 0 else 0.0
    )
    return result.sort_values("gain", ascending=False).reset_index(drop=True)


def compute_shap(model: xgb.XGBClassifier, X: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Compute global and per-class mean(|SHAP|) importance."""
    import shap

    sample = X.sample(
        n=min(SHAP_SAMPLE_SIZE, len(X)),
        random_state=RANDOM_STATE,
    )
    explainer = shap.TreeExplainer(model)
    values = explainer.shap_values(sample)

    # SHAP has returned both list and ndarray representations across versions.
    if isinstance(values, list):
        class_values = [np.asarray(v) for v in values]
    else:
        arr = np.asarray(values)
        if arr.ndim == 3 and arr.shape[0] == len(sample) and arr.shape[1] == len(FEATURE_COLUMNS):
            class_values = [arr[:, :, c] for c in range(arr.shape[2])]
        elif arr.ndim == 3 and arr.shape[1] == len(sample) and arr.shape[2] == len(FEATURE_COLUMNS):
            class_values = [arr[c, :, :] for c in range(arr.shape[0])]
        else:
            raise RuntimeError(f"Unsupported SHAP output shape: {arr.shape}")

    class_rows = []
    global_scores = np.zeros(len(FEATURE_COLUMNS), dtype=float)

    for class_id, class_matrix in enumerate(class_values[: len(CLASSES)]):
        scores = np.mean(np.abs(class_matrix), axis=0)
        global_scores += scores
        for feature, score in zip(FEATURE_COLUMNS, scores):
            class_rows.append(
                {
                    "class_id": class_id,
                    "class": label(class_id),
                    "feature": feature,
                    "mean_abs_shap": float(score),
                }
            )

    global_scores /= max(len(class_values[: len(CLASSES)]), 1)
    global_df = pd.DataFrame(
        {
            "feature": FEATURE_COLUMNS,
            "mean_abs_shap": global_scores,
        }
    ).sort_values("mean_abs_shap", ascending=False).reset_index(drop=True)
    class_df = pd.DataFrame(class_rows).sort_values(
        ["class_id", "mean_abs_shap"], ascending=[True, False]
    ).reset_index(drop=True)
    return global_df, class_df


def build_error_table(
    df: pd.DataFrame,
    predictions: np.ndarray,
    probabilities: np.ndarray,
) -> pd.DataFrame:
    result = df.reset_index(drop=True).copy()
    result["actual_class"] = result[TARGET_COLUMN].astype(int)
    result["actual_label"] = result["actual_class"].map(label)
    result["predicted_class"] = predictions.astype(int)
    result["predicted_label"] = result["predicted_class"].map(label)
    result["correct"] = result["actual_class"] == result["predicted_class"]
    result["predicted_probability"] = probabilities.max(axis=1)
    result["actual_probability"] = probabilities[
        np.arange(len(result)), result["actual_class"].to_numpy()
    ]
    result["margin_top1_top2"] = np.sort(probabilities, axis=1)[:, -1] - np.sort(probabilities, axis=1)[:, -2]
    result["error_type"] = np.where(result["correct"], "correct", "misclassified")

    # Operationally useful adjacent-vs-severe mistakes.
    result["severity_gap"] = result["predicted_class"] - result["actual_class"]
    result["overprediction"] = result["severity_gap"] > 0
    result["underprediction"] = result["severity_gap"] < 0
    result["critical_underprediction"] = (
        (result["actual_class"] >= 2) & (result["predicted_class"] < result["actual_class"])
    )
    return result


def summarize_errors(errors: pd.DataFrame) -> dict:
    mis = errors[~errors["correct"]]
    total = len(errors)

    pair_counts = (
        mis.groupby(["actual_class", "predicted_class"], dropna=False)
        .size()
        .sort_values(ascending=False)
    )

    class_rows = []
    for class_id in CLASSES:
        actual = errors[errors["actual_class"] == class_id]
        wrong = actual[~actual["correct"]]
        severe_actual = actual["actual_class"] >= 2
        critical_missed = actual["critical_underprediction"].sum()
        class_rows.append(
            {
                "class_id": class_id,
                "class": label(class_id),
                "support": int(len(actual)),
                "errors": int(len(wrong)),
                "error_rate": float(len(wrong) / len(actual)) if len(actual) else 0.0,
                "recall": float((actual["correct"].sum() / len(actual))) if len(actual) else 0.0,
                "critical_underpredictions": int(critical_missed),
                "mean_predicted_probability": float(actual["predicted_probability"].mean()) if len(actual) else 0.0,
            }
        )

    return {
        "total_rows": int(total),
        "misclassified_rows": int(len(mis)),
        "error_rate": float(len(mis) / total) if total else 0.0,
        "underpredictions": int(errors["underprediction"].sum()),
        "overpredictions": int(errors["overprediction"].sum()),
        "critical_underpredictions": int(errors["critical_underprediction"].sum()),
        "critical_underprediction_rate": float(
            errors["critical_underprediction"].sum() / max((errors["actual_class"] >= 2).sum(), 1)
        ),
        "most_common_error_pairs": [
            {
                "actual": int(a),
                "actual_label": label(a),
                "predicted": int(p),
                "predicted_label": label(p),
                "count": int(n),
            }
            for (a, p), n in pair_counts.head(12).items()
        ],
        "per_class": class_rows,
    }


def main() -> None:
    print("=" * 78)
    print("ORCA-X MODEL ERROR ANALYSIS")
    print("=" * 78)
    print("No retraining, label-policy changes, or production-model changes are performed.")

    df = load_data()
    model = load_model()
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN].astype(int)

    probabilities = model.predict_proba(X)
    predictions = probabilities.argmax(axis=1)
    errors = build_error_table(df, predictions, probabilities)

    accuracy = accuracy_score(y, predictions)
    balanced_accuracy = balanced_accuracy_score(y, predictions)
    macro_f1 = f1_score(y, predictions, average="macro", zero_division=0)
    weighted_f1 = f1_score(y, predictions, average="weighted", zero_division=0)
    precision, recall, f1, support = precision_recall_fscore_support(
        y, predictions, labels=CLASSES, zero_division=0
    )
    cm = confusion_matrix(y, predictions, labels=CLASSES)

    output_dir = MODELS_DIR / "error_analysis"
    output_dir.mkdir(parents=True, exist_ok=True)

    errors.sort_values(
        ["critical_underprediction", "margin_top1_top2", "predicted_probability"],
        ascending=[False, True, True],
    ).to_csv(output_dir / "misclassified_rows.csv", index=False)

    native = native_feature_importance(model)
    native.to_csv(output_dir / "feature_importance.csv", index=False)

    shap_status = {"available": False, "error": None}
    shap_global = None
    shap_class = None
    try:
        shap_global, shap_class = compute_shap(model, X)
        shap_global.to_csv(output_dir / "shap_feature_importance.csv", index=False)
        shap_class.to_csv(output_dir / "shap_class_importance.csv", index=False)
        shap_status["available"] = True
    except Exception as exc:  # SHAP is diagnostic; native XGBoost importance remains available.
        shap_status["error"] = f"{type(exc).__name__}: {exc}"
        print(f"SHAP analysis skipped: {shap_status['error']}")

    summary = summarize_errors(errors)
    results = {
        "analysis": "frozen_model_error_analysis",
        "model_file": "orca_xgb_risk.json",
        "dataset_file": "ndbc_marine_risk.parquet",
        "rows_analyzed": int(len(df)),
        "features": FEATURE_COLUMNS,
        "metrics": {
            "accuracy": float(accuracy),
            "balanced_accuracy": float(balanced_accuracy),
            "macro_f1": float(macro_f1),
            "weighted_f1": float(weighted_f1),
            "classification_report": classification_report(
                y,
                predictions,
                labels=CLASSES,
                target_names=[label(c) for c in CLASSES],
                output_dict=True,
                zero_division=0,
            ),
            "confusion_matrix": cm.tolist(),
            "per_class": {
                label(c): {
                    "precision": float(precision[i]),
                    "recall": float(recall[i]),
                    "f1": float(f1[i]),
                    "support": int(support[i]),
                }
                for i, c in enumerate(CLASSES)
            },
        },
        "error_summary": summary,
        "native_feature_importance": native.to_dict(orient="records"),
        "shap": shap_status,
        "interpretation": {
            "risk_policy_changed": False,
            "labels_are_operational_proxy": True,
            "note": "Use these diagnostics to guide tuning; do not alter the safety policy solely to improve class balance.",
        },
    }

    if shap_global is not None:
        results["shap_global_importance"] = shap_global.to_dict(orient="records")
        results["shap_class_importance"] = shap_class.to_dict(orient="records")

    (output_dir / "error_analysis.json").write_text(
        json.dumps(results, indent=2),
        encoding="utf-8",
    )

    print()
    print(f"Rows analyzed:           {len(df):,}")
    print(f"Accuracy:                {accuracy:.4f}")
    print(f"Balanced accuracy:       {balanced_accuracy:.4f}")
    print(f"Macro F1:                {macro_f1:.4f}")
    print(f"Weighted F1:             {weighted_f1:.4f}")
    print(f"Misclassified rows:      {len(errors[~errors['correct']]):,}")
    print(f"Critical underpredictions: {int(errors['critical_underprediction'].sum()):,}")

    print("\nConfusion matrix [actual x predicted]:")
    print(cm)

    print("\nTop native feature importance by gain:")
    for row in native.head(10).itertuples(index=False):
        print(f"  {row.feature:<28} gain_fraction={row.gain_fraction:.6f}")

    print("\nMost common error pairs:")
    for item in summary["most_common_error_pairs"][:8]:
        print(
            f"  {item['actual_label']} -> {item['predicted_label']}: "
            f"{item['count']:,}"
        )

    print("\nArtifacts:")
    for path in sorted(output_dir.iterdir()):
        print(f"  {path}")

    print("\nAnalysis complete. This script did not modify the production model or safety policy.")


if __name__ == "__main__":
    main()
