"""Train the ORCA-X XGBoost marine-risk classifier."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np 
import pandas as pd  
import xgboost as xgb 
from sklearn.metrics import ( 
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split 

from config import (
    FEATURE_COLUMNS,
    PROCESSED_DIR,
    TARGET_COLUMN,
    MODELS_DIR,
    DATASET_NAME,
    DATASET_VERSION,
)
from label_policy import RISK_CLASS_NAMES


RANDOM_STATE = 42

TEST_SIZE = 0.15
VALIDATION_SIZE = 0.15


def load_dataset() -> pd.DataFrame:
    path = PROCESSED_DIR / "ndbc_marine_risk.parquet"

    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found: {path}\n"
            "Run prepare_dataset.py first."
        )

    df = pd.read_parquet(path)

    required_columns = [
        *FEATURE_COLUMNS,
        TARGET_COLUMN,
    ]

    missing = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Dataset is missing required columns: {missing}"
        )

    df = df.dropna(
        subset=[TARGET_COLUMN]
    ).copy()

    return df


def calculate_class_weights(
    y: pd.Series,
) -> dict[int, float]:
    """Calculate balanced class weights."""

    counts = y.value_counts().sort_index()

    total = len(y)
    n_classes = len(counts)

    weights = {
        int(cls): total / (n_classes * count)
        for cls, count in counts.items()
    }

    return weights


def make_sample_weights(
    y: pd.Series,
    class_weights: dict[int, float],
) -> np.ndarray:
    return np.array(
        [
            class_weights[int(label)]
            for label in y
        ],
        dtype=np.float32,
    )


def print_split_distribution(
    name: str,
    y: pd.Series,
) -> None:

    distribution = (
        y.value_counts(normalize=True)
        .sort_index()
        * 100
    )

    counts = (
        y.value_counts()
        .sort_index()
    )

    print()
    print(f"{name} distribution:")

    for cls in sorted(counts.index):

        label = RISK_CLASS_NAMES.get(
            int(cls),
            str(cls),
        )

        print(
            f"  {cls} {label:<10} "
            f"{counts[cls]:>8,} "
            f"({distribution[cls]:>6.2f}%)"
        )


def evaluate_model(
    model: xgb.XGBClassifier,
    X: pd.DataFrame,
    y: pd.Series,
    name: str,
) -> dict:

    predictions = model.predict(X)

    accuracy = accuracy_score(
        y,
        predictions,
    )

    macro_f1 = f1_score(
        y,
        predictions,
        average="macro",
        zero_division=0,
    )

    weighted_f1 = f1_score(
        y,
        predictions,
        average="weighted",
        zero_division=0,
    )

    print()
    print("=" * 70)
    print(f"{name.upper()} EVALUATION")
    print("=" * 70)

    print(
        f"Accuracy:    {accuracy:.4f}"
    )

    print(
        f"Macro F1:    {macro_f1:.4f}"
    )

    print(
        f"Weighted F1: {weighted_f1:.4f}"
    )

    print()
    print("Classification report:")

    report = classification_report(
        y,
        predictions,
        labels=[0, 1, 2, 3],
        target_names=[
            RISK_CLASS_NAMES[0],
            RISK_CLASS_NAMES[1],
            RISK_CLASS_NAMES[2],
            RISK_CLASS_NAMES[3],
        ],
        output_dict=True,
        zero_division=0,
    )

    print(
        classification_report(
            y,
            predictions,
            labels=[0, 1, 2, 3],
            target_names=[
                RISK_CLASS_NAMES[0],
                RISK_CLASS_NAMES[1],
                RISK_CLASS_NAMES[2],
                RISK_CLASS_NAMES[3],
            ],
            zero_division=0,
        )
    )

    print("Confusion matrix:")

    cm = confusion_matrix(
        y,
        predictions,
        labels=[0, 1, 2, 3],
    )

    print(cm)

    return {
        "accuracy": float(accuracy),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
        "classification_report": report,
        "confusion_matrix": cm.tolist(),
    }


def main() -> None:

    print("=" * 70)
    print("ORCA-X XGBOOST TRAINING")
    print("=" * 70)

    print()
    print("Loading dataset...")

    df = load_dataset()

    print(
        f"Rows: {len(df):,}"
    )

    print(
        f"Features: {len(FEATURE_COLUMNS)}"
    )

    print()
    print("Features:")

    for feature in FEATURE_COLUMNS:
        print(f"  - {feature}")

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN].astype(int)

    # --------------------------------------------------------------
    # Train / validation / test split
    # --------------------------------------------------------------

    X_train_full, X_test, y_train_full, y_test = train_test_split(
        X,
        y,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    validation_relative_size = (
        VALIDATION_SIZE
        / (1.0 - TEST_SIZE)
    )

    X_train, X_validation, y_train, y_validation = (
        train_test_split(
            X_train_full,
            y_train_full,
            test_size=validation_relative_size,
            random_state=RANDOM_STATE,
            stratify=y_train_full,
        )
    )

    print()
    print(
        f"Train rows:      {len(X_train):,}"
    )

    print(
        f"Validation rows: {len(X_validation):,}"
    )

    print(
        f"Test rows:       {len(X_test):,}"
    )

    print_split_distribution(
        "Train",
        y_train,
    )

    print_split_distribution(
        "Validation",
        y_validation,
    )

    print_split_distribution(
        "Test",
        y_test,
    )

    # --------------------------------------------------------------
    # Class weights
    # --------------------------------------------------------------

    class_weights = calculate_class_weights(
        y_train
    )

    print()
    print("Class weights:")

    for cls, weight in class_weights.items():

        print(
            f"  {cls} "
            f"{RISK_CLASS_NAMES[cls]:<10} "
            f"{weight:.4f}"
        )

    train_weights = make_sample_weights(
        y_train,
        class_weights,
    )

    validation_weights = make_sample_weights(
        y_validation,
        class_weights,
    )

    # --------------------------------------------------------------
    # XGBoost
    # --------------------------------------------------------------

    model = xgb.XGBClassifier(
        objective="multi:softprob",
        num_class=4,

        n_estimators=700,

        learning_rate=0.05,

        max_depth=8,

        min_child_weight=3,

        subsample=0.85,

        colsample_bytree=0.85,

        reg_alpha=0.05,

        reg_lambda=1.0,

        gamma=0.0,

        tree_method="hist",

        eval_metric="mlogloss",

        random_state=RANDOM_STATE,

        n_jobs=-1,

    )

    print()
    print("Training XGBoost...")

    model.fit(
        X_train,
        y_train,
        sample_weight=train_weights,
        eval_set=[
            (X_train, y_train),
            (X_validation, y_validation),
        ],
        verbose=50,
    )

    # --------------------------------------------------------------
    # Evaluation
    # --------------------------------------------------------------

    validation_metrics = evaluate_model(
        model,
        X_validation,
        y_validation,
        "Validation",
    )

    test_metrics = evaluate_model(
        model,
        X_test,
        y_test,
        "Test",
    )

    # --------------------------------------------------------------
    # Save model
    # --------------------------------------------------------------

    MODELS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    model_path = (
        MODELS_DIR /
        "orca_xgb_risk.json"
    )

    model.save_model(
        model_path
    )

    print()
    print(
        f"Model saved: {model_path}"
    )

    # --------------------------------------------------------------
    # Feature importance
    # --------------------------------------------------------------

    importance = model.feature_importances_

    feature_importance = sorted(
        zip(
            FEATURE_COLUMNS,
            importance,
        ),
        key=lambda item: item[1],
        reverse=True,
    )

    print()
    print("Feature importance:")

    for feature, score in feature_importance:

        print(
            f"  {feature:<28} "
            f"{score:.6f}"
        )

    # --------------------------------------------------------------
    # Metadata
    # --------------------------------------------------------------

    metadata = {
        "model": "XGBoost",
        "model_file": model_path.name,

        "dataset_name": DATASET_NAME,
        "dataset_version": DATASET_VERSION,

        "target": TARGET_COLUMN,

        "classes": {
            str(k): v
            for k, v in RISK_CLASS_NAMES.items()
        },

        "features": FEATURE_COLUMNS,

        "feature_count": len(
            FEATURE_COLUMNS
        ),

        "random_state": RANDOM_STATE,

        "split": {
            "train": 0.70,
            "validation": 0.15,
            "test": 0.15,
        },

        "class_weights": {
            str(k): float(v)
            for k, v in class_weights.items()
        },

        "hyperparameters": {
            "n_estimators": 700,
            "learning_rate": 0.05,
            "max_depth": 8,
            "min_child_weight": 3,
            "subsample": 0.85,
            "colsample_bytree": 0.85,
            "reg_alpha": 0.05,
            "reg_lambda": 1.0,
            "gamma": 0.0,
        },

        "validation_metrics": validation_metrics,

        "test_metrics": test_metrics,

        "feature_importance": {
            feature: float(score)
            for feature, score
            in feature_importance
        },

        "label_policy": (
            "Transparent threshold-derived "
            "operational proxy labels; "
            "not historical incident outcomes."
        ),
    }

    metadata_path = (
        MODELS_DIR /
        "orca_xgb_risk_metadata.json"
    )

    metadata_path.write_text(
        json.dumps(
            metadata,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(
        f"Metadata saved: {metadata_path}"
    )

    print()
    print("=" * 70)
    print("ORCA-X XGBOOST TRAINING COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()