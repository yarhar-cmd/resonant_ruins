from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from resonant_model.artifact import build_artifact
from resonant_model.dataset import load_prepared_dataset
from resonant_model.train import evaluate_models, fit_final_model

from .fixtures import prepared_dataset


class ArtifactTests(unittest.TestCase):
    def dataset(self, ready: bool):
        value = prepared_dataset(group_count=8, rows_per_group=15)
        value["readiness"]["readyForOfficialTraining"] = ready
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "prepared.json"
            path.write_text(json.dumps(value), encoding="utf-8")
            return load_prepared_dataset(path)

    def test_development_artifact_is_private_and_stable(self):
        dataset = self.dataset(False)
        evaluation = evaluate_models(dataset)
        fitted = fit_final_model(dataset)
        first = build_artifact(
            dataset,
            fitted,
            evaluation,
            model_id="fixture-logistic-development-1",
            model_version="development-1",
            status="development",
        )
        second = build_artifact(
            dataset,
            fitted,
            evaluation,
            model_id="fixture-logistic-development-1",
            model_version="development-1",
            status="development",
        )
        self.assertEqual(first["artifactId"], second["artifactId"])
        serialized = json.dumps(first)
        self.assertNotIn("group-0001", serialized)
        self.assertNotIn("roomDecisionId", serialized)

    def test_development_artifact_cannot_use_official_model_id(self):
        dataset = self.dataset(False)
        with self.assertRaisesRegex(ValueError, "model-1"):
            build_artifact(
                dataset,
                fit_final_model(dataset),
                evaluate_models(dataset),
                model_id="model-1",
                model_version="1",
                status="development",
            )

    def test_unready_dataset_cannot_create_approved_artifact(self):
        dataset = self.dataset(False)
        with self.assertRaisesRegex(ValueError, "unready"):
            build_artifact(
                dataset,
                fit_final_model(dataset),
                evaluate_models(dataset),
                model_id="model-1",
                model_version="1",
                status="approved",
            )


if __name__ == "__main__":
    unittest.main()
