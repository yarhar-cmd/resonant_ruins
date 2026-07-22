from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import numpy as np

from resonant_model.config import MODEL_VARIANTS
from resonant_model.dataset import encode_rows, load_prepared_dataset

from .fixtures import prepared_dataset


class DatasetTests(unittest.TestCase):
    def test_loads_privacy_reduced_dataset_and_encodes_categories(self):
        value = prepared_dataset()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "prepared.json"
            path.write_text(json.dumps(value), encoding="utf-8")
            dataset = load_prepared_dataset(path)
        encoded = encode_rows(dataset.rows, MODEL_VARIANTS["player-room-rating-logistic"])
        self.assertEqual(encoded.values.shape[0], len(value["rows"]))
        self.assertTrue(np.isfinite(encoded.values).all())
        self.assertIn("previousDifficultyRating=__missing__", encoded.encoded_feature_order)

    def test_rejects_participant_linked_structure(self):
        value = prepared_dataset()
        value["participantCode"] = "PRIVATE"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "unsafe.json"
            path.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "participant-linked"):
                load_prepared_dataset(path)


if __name__ == "__main__":
    unittest.main()
