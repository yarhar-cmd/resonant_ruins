from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from resonant_model.dataset import load_prepared_dataset
from resonant_model.train import evaluate_models, fit_final_model, grouped_partitions

from .fixtures import prepared_dataset


class TrainingTests(unittest.TestCase):
    def dataset(self):
        value = prepared_dataset(group_count=8, rows_per_group=15)
        value["readiness"]["readyForOfficialTraining"] = True
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "prepared.json"
            path.write_text(json.dumps(value), encoding="utf-8")
            return load_prepared_dataset(path)

    def test_grouped_partitions_never_overlap(self):
        dataset = self.dataset()
        training, holdout, folds = grouped_partitions(dataset)
        self.assertFalse(set(dataset.groups[training]) & set(dataset.groups[holdout]))
        for fold_training, fold_test in folds:
            self.assertFalse(set(dataset.groups[fold_training]) & set(dataset.groups[fold_test]))

    def test_training_and_baselines_are_deterministic(self):
        dataset = self.dataset()
        first = evaluate_models(dataset)
        second = evaluate_models(dataset)
        self.assertEqual(first, second)
        self.assertEqual(
            set(first["models"]),
            {
                "global-majority",
                "training-class-prior",
                "previous-rating-persistence",
                "session-history-majority",
                "room-only-logistic",
                "player-plus-room-logistic",
                "player-room-rating-logistic",
            },
        )
        fitted = fit_final_model(dataset)
        self.assertEqual(len(fitted["coefficients"]), 3)
        self.assertTrue(np.isfinite(np.asarray(fitted["coefficients"])).all())


if __name__ == "__main__":
    unittest.main()
