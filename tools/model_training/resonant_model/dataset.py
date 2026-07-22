from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np

from .config import (
    CATEGORICAL_FEATURES,
    CLASS_ORDER,
    FEATURE_MANIFEST,
    NUMERIC_FEATURES,
    SEMANTIC_FEATURE_ORDER,
)

GROUP_PATTERN = re.compile(r"^group-\d{4,}$")
FORBIDDEN_OUTPUT_KEYS = {
    "participantCode",
    "participant_code",
    "researchSessionId",
    "sessionId",
    "runId",
    "sessions",
    "runs",
    "rooms",
}


@dataclass(frozen=True)
class PreparedDataset:
    source: dict[str, Any]
    rows: list[dict[str, Any]]
    labels: np.ndarray
    groups: np.ndarray

    @property
    def fingerprint(self) -> str:
        return str(self.source["datasetFingerprint"])

    @property
    def ready_for_official_training(self) -> bool:
        return bool(self.source["readiness"]["readyForOfficialTraining"])


@dataclass(frozen=True)
class EncodedRows:
    values: np.ndarray
    encoded_feature_order: tuple[str, ...]
    numeric_indices: tuple[int, ...]


def _walk_keys(value: Any) -> Iterable[str]:
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _walk_keys(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_keys(item)


def validate_prepared_dataset(value: dict[str, Any]) -> None:
    if value.get("datasetSchemaVersion") != "model-dataset-1":
        raise ValueError("Prepared dataset must use model-dataset-1.")
    if value.get("featureSchemaVersion") != FEATURE_MANIFEST["schemaVersion"]:
        raise ValueError("Prepared dataset feature schema is incompatible.")
    if set(_walk_keys(value)) & FORBIDDEN_OUTPUT_KEYS:
        raise ValueError("Prepared dataset contains participant-linked record structure.")
    rows = value.get("rows")
    if not isinstance(rows, list):
        raise ValueError("Prepared dataset rows are missing.")
    for row in rows:
        if row.get("label") not in CLASS_ORDER:
            raise ValueError("Prepared dataset contains an unknown target class.")
        if not GROUP_PATTERN.fullmatch(str(row.get("groupId", ""))):
            raise ValueError("Prepared dataset contains an invalid opaque group ID.")
        features = row.get("features")
        if not isinstance(features, dict) or tuple(features.keys()) != SEMANTIC_FEATURE_ORDER:
            raise ValueError("Prepared dataset semantic feature order is incompatible.")


def load_prepared_dataset(path: str | Path) -> PreparedDataset:
    with Path(path).open("r", encoding="utf-8") as dataset_file:
        source = json.load(dataset_file)
    validate_prepared_dataset(source)
    rows = list(source["rows"])
    return PreparedDataset(
        source=source,
        rows=rows,
        labels=np.asarray([row["label"] for row in rows], dtype=object),
        groups=np.asarray([row["groupId"] for row in rows], dtype=object),
    )


def encoded_feature_order(features: Sequence[str]) -> tuple[str, ...]:
    result: list[str] = []
    for name in features:
        vocabulary = CATEGORICAL_FEATURES.get(name)
        if vocabulary is None:
            result.append(name)
        else:
            result.extend(f"{name}={category}" for category in vocabulary)
    return tuple(result)


def encode_rows(rows: Sequence[dict[str, Any]], features: Sequence[str]) -> EncodedRows:
    order = encoded_feature_order(features)
    numeric_indices: list[int] = []
    values: list[list[float]] = []
    for row in rows:
        semantic = row["features"]
        encoded: list[float] = []
        for name in features:
            if name in NUMERIC_FEATURES:
                value = semantic.get(name)
                if not isinstance(value, (int, float)) or not np.isfinite(value):
                    raise ValueError(f"Feature {name} must be finite.")
                if len(values) == 0:
                    numeric_indices.append(len(encoded))
                encoded.append(float(value))
                continue
            vocabulary = CATEGORICAL_FEATURES.get(name)
            value = semantic.get(name)
            if vocabulary is None or value not in vocabulary:
                raise ValueError(f"Unknown {name} category: {value}")
            encoded.extend(1.0 if value == category else 0.0 for category in vocabulary)
        values.append(encoded)
    matrix = np.asarray(values, dtype=np.float64)
    if matrix.ndim != 2 or matrix.shape[1] != len(order):
        raise ValueError("Encoded model matrix has invalid dimensions.")
    return EncodedRows(matrix, order, tuple(numeric_indices))


def fit_normalization(values: np.ndarray, numeric_indices: Sequence[int]) -> tuple[np.ndarray, np.ndarray]:
    means = np.zeros(values.shape[1], dtype=np.float64)
    scales = np.ones(values.shape[1], dtype=np.float64)
    for index in numeric_indices:
        means[index] = float(np.mean(values[:, index]))
        standard_deviation = float(np.std(values[:, index]))
        scales[index] = standard_deviation if standard_deviation > 0 else 1.0
    return means, scales


def normalize(values: np.ndarray, means: np.ndarray, scales: np.ndarray) -> np.ndarray:
    if np.any(~np.isfinite(means)) or np.any(~np.isfinite(scales)) or np.any(scales <= 0):
        raise ValueError("Normalization values must be finite with positive scales.")
    return (values - means) / scales
