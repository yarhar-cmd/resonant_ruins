from __future__ import annotations

import argparse
import json
from pathlib import Path

from .artifact import build_artifact, write_artifact
from .dataset import load_prepared_dataset
from .train import evaluate_models, fit_final_model


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Offline Resonant Ruins model training")
    root.add_argument("dataset", help="Privacy-reduced model-dataset-1 JSON")
    root.add_argument("--output", required=True, help="Artifact output path")
    root.add_argument("--report", help="Optional aggregate evaluation report path")
    root.add_argument("--model-id", default="fixture-logistic-development-1")
    root.add_argument("--model-version", default="development-1")
    root.add_argument("--status", choices=("development", "approved"), default="development")
    root.add_argument("--allow-development-artifact", action="store_true")
    root.add_argument("--approve-artifact", action="store_true")
    root.add_argument("--overwrite-development", action="store_true")
    return root


def main(arguments: list[str] | None = None) -> int:
    options = parser().parse_args(arguments)
    dataset = load_prepared_dataset(options.dataset)
    if not dataset.ready_for_official_training and not options.allow_development_artifact:
        raise ValueError(
            "Dataset is below Official thresholds; pass --allow-development-artifact for development-only training."
        )
    if options.status == "approved" and not options.approve_artifact:
        raise ValueError("Approved artifacts require explicit --approve-artifact confirmation.")
    evaluation = evaluate_models(dataset)
    fitted = fit_final_model(dataset)
    artifact = build_artifact(
        dataset,
        fitted,
        evaluation,
        model_id=options.model_id,
        model_version=options.model_version,
        status=options.status,
    )
    write_artifact(options.output, artifact, overwrite_development=options.overwrite_development)
    if options.report:
        report_path = Path(options.report)
        if report_path.exists():
            raise FileExistsError("Refusing to overwrite an existing evaluation report.")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(
                {
                    "datasetId": dataset.source["datasetId"],
                    "artifactId": artifact["artifactId"],
                    "status": artifact["status"],
                    "aggregateDatasetCounts": artifact["aggregateDatasetCounts"],
                    "groupedEvaluation": evaluation,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    print(f"Wrote {artifact['status']} artifact {artifact['artifactId']}.")
    return 0
