from __future__ import annotations

import argparse
import json
from pathlib import Path

from resonant_model.dataset import load_prepared_dataset
from resonant_model.train import evaluate_models


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate Resonant Ruins model baselines offline")
    parser.add_argument("dataset")
    parser.add_argument("--output", required=True)
    options = parser.parse_args()
    dataset = load_prepared_dataset(options.dataset)
    destination = Path(options.output)
    if destination.exists():
        raise FileExistsError("Refusing to overwrite an existing evaluation report.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(
            {
                "datasetId": dataset.source["datasetId"],
                "datasetFingerprint": dataset.fingerprint,
                "aggregateDatasetCounts": {
                    "ratedRows": dataset.source["quality"]["ratedRows"],
                    "groupCount": dataset.source["quality"]["groupCount"],
                    "classCounts": dataset.source["quality"]["classCounts"],
                },
                "groupedEvaluation": evaluate_models(dataset),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote sanitized grouped evaluation for {dataset.source['datasetId']}.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(str(error))
        raise SystemExit(1) from None
