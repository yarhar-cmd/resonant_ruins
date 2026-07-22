from __future__ import annotations

from typing import Any, Iterable

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)

from .config import CALIBRATION_BIN_COUNT, CLASS_ORDER


def probability_metrics(labels: np.ndarray, predictions: np.ndarray, probabilities: np.ndarray) -> dict[str, Any]:
    precision, recall, f1, support = precision_recall_fscore_support(
        labels, predictions, labels=CLASS_ORDER, zero_division=0
    )
    one_hot = np.asarray([[1.0 if label == category else 0.0 for category in CLASS_ORDER] for label in labels])
    about_index = CLASS_ORDER.index("about_right")
    true_indices = np.asarray([CLASS_ORDER.index(str(label)) for label in labels])
    multiclass_log_loss = -float(
        np.mean(np.log(np.clip(probabilities[np.arange(len(labels)), true_indices], 1e-15, 1.0)))
    )
    reliability: list[dict[str, Any]] = []
    for index in range(CALIBRATION_BIN_COUNT):
        lower = index / CALIBRATION_BIN_COUNT
        upper = (index + 1) / CALIBRATION_BIN_COUNT
        selected = (probabilities[:, about_index] >= lower) & (
            probabilities[:, about_index] <= upper if index == CALIBRATION_BIN_COUNT - 1 else probabilities[:, about_index] < upper
        )
        count = int(np.sum(selected))
        reliability.append(
            {
                "lower": lower,
                "upper": upper,
                "count": count,
                "meanPredicted": float(np.mean(probabilities[selected, about_index])) if count else None,
                "observedRate": float(np.mean(one_hot[selected, about_index])) if count else None,
            }
        )
    populated = [item for item in reliability if item["count"]]
    expected_calibration_error = sum(
        item["count"] / len(labels) * abs(item["meanPredicted"] - item["observedRate"])
        for item in populated
    )
    return {
        "sampleCount": int(len(labels)),
        "accuracy": float(accuracy_score(labels, predictions)),
        "balancedAccuracy": float(
            np.mean([recall[index] for index, count in enumerate(support) if count > 0])
        ),
        "macroPrecision": float(np.mean(precision)),
        "macroRecall": float(np.mean(recall)),
        "macroF1": float(np.mean(f1)),
        "perClass": {
            label: {
                "precision": float(precision[index]),
                "recall": float(recall[index]),
                "f1": float(f1[index]),
                "support": int(support[index]),
            }
            for index, label in enumerate(CLASS_ORDER)
        },
        "confusionMatrix": confusion_matrix(labels, predictions, labels=CLASS_ORDER).tolist(),
        "logLoss": multiclass_log_loss,
        "multiclassBrier": float(np.mean(np.sum((probabilities - one_hot) ** 2, axis=1))),
        "aboutRightPrecision": float(precision[about_index]),
        "aboutRightRecall": float(recall[about_index]),
        "reliability": reliability,
        "expectedCalibrationError": float(expected_calibration_error),
    }


def aggregate_fold_metrics(folds: Iterable[dict[str, Any]]) -> dict[str, Any]:
    fold_list = list(folds)
    scalar_names = (
        "accuracy",
        "balancedAccuracy",
        "macroPrecision",
        "macroRecall",
        "macroF1",
        "logLoss",
        "multiclassBrier",
        "aboutRightPrecision",
        "aboutRightRecall",
        "expectedCalibrationError",
    )
    return {
        "foldCount": len(fold_list),
        "mean": {
            name: float(np.mean([fold[name] for fold in fold_list])) for name in scalar_names
        },
        "missingClassFolds": [
            index
            for index, fold in enumerate(fold_list)
            if any(item["support"] == 0 for item in fold["perClass"].values())
        ],
    }
