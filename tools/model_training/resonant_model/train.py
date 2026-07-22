from __future__ import annotations

from collections import Counter
from typing import Any, Sequence

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, GroupShuffleSplit

from .baselines import (
    class_prior_baseline,
    majority_baseline,
    previous_rating_baseline,
    session_history_majority_baseline,
)
from .config import (
    CLASS_ORDER,
    HOLDOUT_FRACTION,
    LOGISTIC_CONFIGURATION,
    MODEL_VARIANTS,
    SPLIT_RANDOM_STATE,
)
from .dataset import PreparedDataset, encode_rows, fit_normalization, normalize
from .evaluate import aggregate_fold_metrics, probability_metrics


def _ordered_probabilities(model: LogisticRegression, values: np.ndarray) -> np.ndarray:
    raw = model.predict_proba(values)
    return np.column_stack([raw[:, list(model.classes_).index(label)] for label in CLASS_ORDER])


def _fit_logistic(
    dataset: PreparedDataset,
    train_indices: np.ndarray,
    features: Sequence[str],
) -> tuple[LogisticRegression, np.ndarray, np.ndarray, tuple[str, ...]]:
    encoded = encode_rows([dataset.rows[index] for index in train_indices], features)
    means, scales = fit_normalization(encoded.values, encoded.numeric_indices)
    normalized = normalize(encoded.values, means, scales)
    model = LogisticRegression(**LOGISTIC_CONFIGURATION)
    model.fit(normalized, dataset.labels[train_indices])
    return model, means, scales, encoded.encoded_feature_order


def _evaluate_logistic(
    dataset: PreparedDataset,
    model: LogisticRegression,
    means: np.ndarray,
    scales: np.ndarray,
    features: Sequence[str],
    indices: np.ndarray,
) -> dict[str, Any]:
    encoded = encode_rows([dataset.rows[index] for index in indices], features)
    values = normalize(encoded.values, means, scales)
    probabilities = _ordered_probabilities(model, values)
    predictions = np.asarray([CLASS_ORDER[int(index)] for index in np.argmax(probabilities, axis=1)])
    return probability_metrics(dataset.labels[indices], predictions, probabilities)


def _predict_logistic(
    dataset: PreparedDataset,
    model: LogisticRegression,
    means: np.ndarray,
    scales: np.ndarray,
    features: Sequence[str],
    indices: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    encoded = encode_rows([dataset.rows[index] for index in indices], features)
    values = normalize(encoded.values, means, scales)
    probabilities = _ordered_probabilities(model, values)
    predictions = np.asarray(
        [CLASS_ORDER[int(index)] for index in np.argmax(probabilities, axis=1)]
    )
    return predictions, probabilities


def _subgroup_evaluation(
    dataset: PreparedDataset,
    indices: np.ndarray,
    predictions: np.ndarray,
    probabilities: np.ndarray,
    field: str,
) -> dict[str, Any]:
    values = sorted({str(dataset.rows[index]["analysis"][field]) for index in indices})
    result: dict[str, Any] = {}
    for value in values:
        positions = np.asarray(
            [
                position
                for position, index in enumerate(indices)
                if str(dataset.rows[index]["analysis"][field]) == value
            ]
        )
        result[value] = probability_metrics(
            dataset.labels[indices[positions]], predictions[positions], probabilities[positions]
        )
    return result


def grouped_partitions(dataset: PreparedDataset) -> tuple[np.ndarray, np.ndarray, list[tuple[np.ndarray, np.ndarray]]]:
    distinct_groups = np.unique(dataset.groups)
    if len(distinct_groups) < 2:
        raise ValueError("Grouped evaluation requires at least two independent groups.")
    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=HOLDOUT_FRACTION,
        random_state=SPLIT_RANDOM_STATE,
    )
    train_indices, holdout_indices = next(
        splitter.split(np.zeros(len(dataset.rows)), dataset.labels, groups=dataset.groups)
    )
    training_groups = np.unique(dataset.groups[train_indices])
    fold_count = min(5, len(training_groups))
    if fold_count < 2:
        raise ValueError("Grouped cross-validation requires at least two training groups.")
    fold_splitter = GroupKFold(n_splits=fold_count, shuffle=True, random_state=SPLIT_RANDOM_STATE)
    folds = [
        (train_indices[fold_train], train_indices[fold_test])
        for fold_train, fold_test in fold_splitter.split(
            np.zeros(len(train_indices)),
            dataset.labels[train_indices],
            groups=dataset.groups[train_indices],
        )
    ]
    return train_indices, holdout_indices, folds


def _baseline_metrics(
    dataset: PreparedDataset,
    train_indices: np.ndarray,
    test_indices: np.ndarray,
) -> dict[str, Any]:
    train_labels = dataset.labels[train_indices]
    test_labels = dataset.labels[test_indices]
    counts = Counter(train_labels.tolist())
    fallback = max(CLASS_ORDER, key=lambda label: (counts[label], -CLASS_ORDER.index(label)))
    test_rows = [dataset.rows[index] for index in test_indices]
    train_rows = [dataset.rows[index] for index in train_indices]
    predictions: dict[str, tuple[np.ndarray, np.ndarray]] = {
        "global-majority": majority_baseline(train_labels, len(test_indices)),
        "training-class-prior": class_prior_baseline(train_labels, len(test_indices)),
        "previous-rating-persistence": previous_rating_baseline(test_rows, fallback),
        "session-history-majority": session_history_majority_baseline(
            train_rows, test_rows, fallback
        ),
    }
    return {
        name: probability_metrics(test_labels, predicted, probabilities)
        for name, (predicted, probabilities) in predictions.items()
    }


def evaluate_models(dataset: PreparedDataset) -> dict[str, Any]:
    train_indices, holdout_indices, folds = grouped_partitions(dataset)
    comparison: dict[str, Any] = {}
    for name in (
        "global-majority",
        "training-class-prior",
        "previous-rating-persistence",
        "session-history-majority",
    ):
        fold_metrics = [
            _baseline_metrics(dataset, fold_train, fold_test)[name]
            for fold_train, fold_test in folds
        ]
        comparison[name] = {
            "crossValidation": aggregate_fold_metrics(fold_metrics),
            "holdout": _baseline_metrics(dataset, train_indices, holdout_indices)[name],
        }
    for name, features in MODEL_VARIANTS.items():
        fold_metrics = []
        for fold_train, fold_test in folds:
            model, means, scales, _ = _fit_logistic(dataset, fold_train, features)
            fold_metrics.append(
                _evaluate_logistic(dataset, model, means, scales, features, fold_test)
            )
        model, means, scales, _ = _fit_logistic(dataset, train_indices, features)
        holdout_predictions, holdout_probabilities = _predict_logistic(
            dataset, model, means, scales, features, holdout_indices
        )
        comparison[name] = {
            "crossValidation": aggregate_fold_metrics(fold_metrics),
            "holdout": probability_metrics(
                dataset.labels[holdout_indices], holdout_predictions, holdout_probabilities
            ),
        }
        if name == "player-room-rating-logistic":
            group_scores = []
            for group in np.unique(dataset.groups[holdout_indices]):
                positions = np.asarray(
                    [
                        position
                        for position, index in enumerate(holdout_indices)
                        if dataset.groups[index] == group
                    ]
                )
                group_scores.append(
                    probability_metrics(
                        dataset.labels[holdout_indices[positions]],
                        holdout_predictions[positions],
                        holdout_probabilities[positions],
                    )["macroF1"]
                )
            comparison[name]["subgroups"] = {
                "condition": _subgroup_evaluation(
                    dataset,
                    holdout_indices,
                    holdout_predictions,
                    holdout_probabilities,
                    "condition",
                ),
                "preset": _subgroup_evaluation(
                    dataset,
                    holdout_indices,
                    holdout_predictions,
                    holdout_probabilities,
                    "experiencePreset",
                ),
                "archetype": _subgroup_evaluation(
                    dataset,
                    holdout_indices,
                    holdout_predictions,
                    holdout_probabilities,
                    "archetype",
                ),
                "sanitizedGroupVariation": {
                    "groupCount": len(group_scores),
                    "minimumMacroF1": float(np.min(group_scores)),
                    "medianMacroF1": float(np.median(group_scores)),
                    "maximumMacroF1": float(np.max(group_scores)),
                },
            }
    return {
        "split": {
            "method": "group-shuffle-holdout-plus-group-k-fold",
            "randomState": SPLIT_RANDOM_STATE,
            "trainingRows": int(len(train_indices)),
            "holdoutRows": int(len(holdout_indices)),
            "trainingGroups": int(len(np.unique(dataset.groups[train_indices]))),
            "holdoutGroups": int(len(np.unique(dataset.groups[holdout_indices]))),
            "foldCount": len(folds),
        },
        "models": comparison,
    }


def fit_final_model(dataset: PreparedDataset) -> dict[str, Any]:
    features = MODEL_VARIANTS["player-room-rating-logistic"]
    all_indices = np.arange(len(dataset.rows))
    model, means, scales, encoded_order = _fit_logistic(dataset, all_indices, features)
    coefficients = np.vstack(
        [model.coef_[list(model.classes_).index(label)] for label in CLASS_ORDER]
    )
    intercepts = np.asarray(
        [model.intercept_[list(model.classes_).index(label)] for label in CLASS_ORDER]
    )
    return {
        "semanticFeatureOrder": list(features),
        "encodedFeatureOrder": list(encoded_order),
        "normalizationMeans": means.tolist(),
        "normalizationScales": scales.tolist(),
        "coefficients": coefficients.tolist(),
        "intercepts": intercepts.tolist(),
        "iterations": [int(value) for value in model.n_iter_],
    }
