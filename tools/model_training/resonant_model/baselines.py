from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Sequence

import numpy as np

from .config import CLASS_ORDER


def majority_baseline(train_labels: np.ndarray, count: int) -> tuple[np.ndarray, np.ndarray]:
    counts = Counter(train_labels.tolist())
    majority = max(CLASS_ORDER, key=lambda label: (counts[label], -CLASS_ORDER.index(label)))
    probabilities = np.zeros((count, len(CLASS_ORDER)), dtype=np.float64)
    probabilities[:, CLASS_ORDER.index(majority)] = 1.0
    return np.asarray([majority] * count, dtype=object), probabilities


def class_prior_baseline(train_labels: np.ndarray, count: int) -> tuple[np.ndarray, np.ndarray]:
    counts = Counter(train_labels.tolist())
    total = max(1, len(train_labels))
    prior = np.asarray([counts[label] / total for label in CLASS_ORDER], dtype=np.float64)
    predictions = np.asarray([CLASS_ORDER[int(np.argmax(prior))]] * count, dtype=object)
    return predictions, np.tile(prior, (count, 1))


def previous_rating_baseline(rows: Sequence[dict[str, Any]], fallback: str) -> tuple[np.ndarray, np.ndarray]:
    predictions = []
    for row in rows:
        previous = row["features"]["previousDifficultyRating"]
        predictions.append(previous if previous in CLASS_ORDER else fallback)
    probabilities = np.zeros((len(rows), len(CLASS_ORDER)), dtype=np.float64)
    for index, prediction in enumerate(predictions):
        probabilities[index, CLASS_ORDER.index(prediction)] = 1.0
    return np.asarray(predictions, dtype=object), probabilities


def session_history_majority_baseline(
    train_rows: Sequence[dict[str, Any]], test_rows: Sequence[dict[str, Any]], fallback: str
) -> tuple[np.ndarray, np.ndarray]:
    history: dict[str, Counter[str]] = defaultdict(Counter)
    for row in train_rows:
        history[row["groupId"]][row["label"]] += 1
    predictions = []
    for row in test_rows:
        counts = history[row["groupId"]]
        predictions.append(
            max(CLASS_ORDER, key=lambda label: (counts[label], -CLASS_ORDER.index(label)))
            if counts
            else fallback
        )
    probabilities = np.zeros((len(test_rows), len(CLASS_ORDER)), dtype=np.float64)
    for index, prediction in enumerate(predictions):
        probabilities[index, CLASS_ORDER.index(prediction)] = 1.0
    return np.asarray(predictions, dtype=object), probabilities
