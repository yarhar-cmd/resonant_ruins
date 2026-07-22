from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import MODEL_ARTIFACT_SCHEMA
from .config import (
    CATEGORICAL_FEATURES,
    CLASS_ORDER,
    FEATURE_MANIFEST,
    LOGISTIC_CONFIGURATION_DESCRIPTION,
)
from .dataset import PreparedDataset

FORBIDDEN_ARTIFACT_KEYS = {
    "participantCode",
    "participant_code",
    "researchSessionId",
    "sessionId",
    "runId",
    "roomDecisionId",
    "groupId",
    "filePath",
    "sourcePath",
    "rows",
    "sessions",
    "runs",
    "rooms",
}


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _walk_keys(value: Any):
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _walk_keys(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_keys(item)


def build_artifact(
    dataset: PreparedDataset,
    fitted: dict[str, Any],
    evaluation: dict[str, Any],
    *,
    model_id: str,
    model_version: str,
    status: str,
) -> dict[str, Any]:
    if status not in {"development", "approved"}:
        raise ValueError("Artifact status must be development or approved.")
    if status == "approved" and not dataset.ready_for_official_training:
        raise ValueError("An unready dataset cannot produce an approved artifact.")
    if status == "development" and model_id == "model-1":
        raise ValueError("Development artifacts must not use model ID model-1.")
    artifact = {
        "artifactSchemaVersion": MODEL_ARTIFACT_SCHEMA,
        "artifactId": "pending",
        "status": status,
        "modelId": model_id,
        "modelVersion": model_version,
        "modelType": "multinomial-logistic-regression",
        "datasetFingerprint": dataset.fingerprint,
        "classOrder": list(CLASS_ORDER),
        "rawSemanticFeatureOrder": fitted["semanticFeatureOrder"],
        "encodedFeatureOrder": fitted["encodedFeatureOrder"],
        "categoricalVocabularies": CATEGORICAL_FEATURES,
        "missingValuePolicy": FEATURE_MANIFEST["missingPolicy"],
        "normalization": {
            "means": fitted["normalizationMeans"],
            "scales": fitted["normalizationScales"],
        },
        "coefficients": fitted["coefficients"],
        "intercepts": fitted["intercepts"],
        "trainingConfiguration": {
            **LOGISTIC_CONFIGURATION_DESCRIPTION,
            "iterations": fitted["iterations"],
        },
        "aggregateDatasetCounts": {
            "ratedRows": dataset.source["quality"]["ratedRows"],
            "groupCount": dataset.source["quality"]["groupCount"],
            "classCounts": dataset.source["quality"]["classCounts"],
            "conditionCounts": dataset.source["quality"]["conditionCounts"],
        },
        "groupedEvaluation": evaluation,
        "compatibility": {
            "gameVersions": ["mvp-0.4", "mvp-0.5"],
            "generatorVersion": "generator-4",
            "adaptationVersion": "rules-2",
            "researchSchemaVersion": "research-1",
            "featureSchemaVersion": "model-features-1",
            "shadowSchemaVersion": "shadow-1",
        },
        "calibration": {
            "method": "uncalibrated-logistic",
            "note": "Reliability is evaluated; no post-hoc calibrator is installed.",
        },
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    identity = {
        key: value
        for key, value in artifact.items()
        if key not in {"artifactId", "createdAt", "groupedEvaluation"}
    }
    artifact["artifactId"] = f"artifact-{hashlib.sha256(canonical_json(identity).encode()).hexdigest()[:16]}"
    forbidden = set(_walk_keys(artifact)) & FORBIDDEN_ARTIFACT_KEYS
    if forbidden:
        raise ValueError(f"Artifact contains forbidden fields: {sorted(forbidden)}")
    return artifact


def write_artifact(path: str | Path, artifact: dict[str, Any], *, overwrite_development: bool = False) -> None:
    destination = Path(path)
    if destination.exists() and not (
        overwrite_development and artifact["status"] == "development"
    ):
        raise FileExistsError("Refusing to overwrite an existing model artifact.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
