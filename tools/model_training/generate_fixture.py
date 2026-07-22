from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path

import numpy as np

from resonant_model.artifact import build_artifact
from resonant_model.config import CATEGORICAL_FEATURES, CLASS_ORDER, SEMANTIC_FEATURE_ORDER
from resonant_model.dataset import encode_rows, load_prepared_dataset, normalize
from resonant_model.train import evaluate_models, fit_final_model
from tests.fixtures import prepared_dataset, semantic_features


def predict(artifact, semantic):
    row = {
        "features": semantic,
        "label": "about_right",
        "groupId": "group-0001",
    }
    encoded = encode_rows([row], artifact["rawSemanticFeatureOrder"])
    means = np.asarray(artifact["normalization"]["means"])
    scales = np.asarray(artifact["normalization"]["scales"])
    normalized = normalize(encoded.values, means, scales)[0]
    coefficients = np.asarray(artifact["coefficients"])
    intercepts = np.asarray(artifact["intercepts"])
    logits = coefficients @ normalized + intercepts
    exponentials = np.exp(logits - np.max(logits))
    probabilities = exponentials / np.sum(exponentials)
    return {
        "semanticInput": semantic,
        "encodedVector": encoded.values[0].tolist(),
        "normalizedVector": normalized.tolist(),
        "logits": logits.tolist(),
        "probabilities": probabilities.tolist(),
        "predictedClass": CLASS_ORDER[int(np.argmax(probabilities))],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate committed synthetic model fixtures")
    parser.add_argument("--artifact-output", required=True)
    parser.add_argument("--parity-output", required=True)
    parser.add_argument("--force", action="store_true")
    options = parser.parse_args()
    artifact_path = Path(options.artifact_output)
    parity_path = Path(options.parity_output)
    if not options.force and (artifact_path.exists() or parity_path.exists()):
        raise FileExistsError("Refusing to overwrite an existing synthetic fixture.")

    value = prepared_dataset(group_count=9, rows_per_group=15)
    value["datasetId"] = "model-data-synthetic-development-fixture"
    value["datasetFingerprint"] = "f" * 64
    value["readiness"]["readyForOfficialTraining"] = False
    with tempfile.TemporaryDirectory() as directory:
        dataset_path = Path(directory) / "prepared.json"
        dataset_path.write_text(json.dumps(value), encoding="utf-8")
        dataset = load_prepared_dataset(dataset_path)
    artifact = build_artifact(
        dataset,
        fit_final_model(dataset),
        evaluate_models(dataset),
        model_id="fixture-logistic-development-1",
        model_version="synthetic-1",
        status="development",
    )
    artifact["createdAt"] = "2026-07-21T00:00:00.000Z"
    artifact["groupedEvaluation"]["fixtureDisclaimer"] = (
        "Synthetic fixture metrics are implementation checks, not research findings."
    )

    candidate_cases = []
    seen_classes = set()
    for index in range(300):
        semantic = semantic_features(index)
        intended = CLASS_ORDER[index % len(CLASS_ORDER)]
        semantic["runeCount"] = {"too_easy": 0.0, "about_right": 5.0, "too_hard": 12.0}[
            intended
        ]
        semantic["ratCount"] = {"too_easy": 0.0, "about_right": 1.0, "too_hard": 3.0}[
            intended
        ]
        semantic["floorArea"] = {"too_easy": 60.0, "about_right": 40.0, "too_hard": 22.0}[
            intended
        ]
        semantic["experiencePreset"] = CATEGORICAL_FEATURES["experiencePreset"][index % 3]
        semantic["incomingEntranceDirection"] = CATEGORICAL_FEATURES[
            "incomingEntranceDirection"
        ][index % 4]
        result = predict(artifact, semantic)
        predicted = result["predictedClass"]
        if predicted not in seen_classes or index < 12:
            result["candidateId"] = f"parity-candidate-{index:03d}"
            candidate_cases.append(result)
            seen_classes.add(predicted)
        if seen_classes == set(CLASS_ORDER) and len(candidate_cases) >= 12:
            break
    if seen_classes != set(CLASS_ORDER):
        raise ValueError("Synthetic fixture did not produce all three prediction classes.")
    ranking = sorted(
        candidate_cases,
        key=lambda item: (-item["probabilities"][CLASS_ORDER.index("about_right")], item["candidateId"]),
    )
    ranks = {item["candidateId"]: index + 1 for index, item in enumerate(ranking)}
    for item in candidate_cases:
        item["candidateRank"] = ranks[item["candidateId"]]

    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    parity_path.parent.mkdir(parents=True, exist_ok=True)
    artifact_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    parity_path.write_text(
        json.dumps(
            {
                "fixtureSchemaVersion": "model-parity-fixture-1",
                "artifactId": artifact["artifactId"],
                "tolerance": 1e-9,
                "classOrder": list(CLASS_ORDER),
                "cases": candidate_cases,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote synthetic fixture {artifact['artifactId']} with {len(candidate_cases)} parity cases.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(str(error))
        raise SystemExit(1) from None
