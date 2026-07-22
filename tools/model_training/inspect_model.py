from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect sanitized Resonant Ruins model metadata")
    parser.add_argument("artifact")
    options = parser.parse_args()
    artifact = json.loads(Path(options.artifact).read_text(encoding="utf-8"))
    if artifact.get("artifactSchemaVersion") != "model-artifact-1":
        raise ValueError("Input is not a model-artifact-1 file.")
    summary = {
        "artifactId": artifact.get("artifactId"),
        "status": artifact.get("status"),
        "modelId": artifact.get("modelId"),
        "modelVersion": artifact.get("modelVersion"),
        "featureSchema": artifact.get("compatibility", {}).get("featureSchemaVersion"),
        "datasetFingerprint": artifact.get("datasetFingerprint"),
        "classOrder": artifact.get("classOrder"),
        "encodedFeatureCount": len(artifact.get("encodedFeatureOrder", [])),
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(str(error))
        raise SystemExit(1) from None
