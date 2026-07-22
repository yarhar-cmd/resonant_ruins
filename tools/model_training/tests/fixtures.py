from __future__ import annotations

from typing import Any

from resonant_model.config import CATEGORICAL_FEATURES, SEMANTIC_FEATURE_ORDER


def semantic_features(index: int) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for name in SEMANTIC_FEATURE_ORDER:
        vocabulary = CATEGORICAL_FEATURES.get(name)
        if vocabulary is not None:
            values[name] = vocabulary[index % len(vocabulary)]
        else:
            values[name] = float((index % 7) + 1) / 7
    values["currentHealthPercentage"] = min(1.0, values["currentHealthPercentage"])
    values["previousDifficultyRating"] = ("__missing__", "too_easy", "about_right", "too_hard")[
        index % 4
    ]
    values["previousRatingAvailable"] = 0.0 if values["previousDifficultyRating"] == "__missing__" else 1.0
    values["fountainPlacement"] = ("none", "safe", "risky")[index % 3]
    return values


def prepared_dataset(group_count: int = 8, rows_per_group: int = 9) -> dict[str, Any]:
    labels = ("too_easy", "about_right", "too_hard")
    rows = []
    for group in range(group_count):
        for offset in range(rows_per_group):
            index = group * rows_per_group + offset
            label = labels[(group + offset) % len(labels)]
            features = semantic_features(index)
            features["runeCount"] = {"too_easy": 0.0, "about_right": 5.0, "too_hard": 12.0}[label]
            features["ratCount"] = {"too_easy": 0.0, "about_right": 1.0, "too_hard": 3.0}[label]
            features["floorArea"] = {"too_easy": 60.0, "about_right": 40.0, "too_hard": 22.0}[label]
            rows.append(
                {
                    "roomDecisionId": f"synthetic-decision-{index:04d}",
                    "groupId": f"group-{group + 1:04d}",
                    "label": label,
                    "features": features,
                    "analysis": {
                        "condition": "RULES_ADAPTIVE" if group % 2 else "NEUTRAL_PROCEDURAL",
                        "experiencePreset": features["experiencePreset"],
                        "archetype": features["archetype"],
                        "sessionRoomOrdinal": offset + 1,
                    },
                }
            )
    class_counts = {label: sum(row["label"] == label for row in rows) for label in labels}
    return {
        "datasetSchemaVersion": "model-dataset-1",
        "featureSchemaVersion": "model-features-1",
        "datasetId": "model-data-synthetic",
        "datasetFingerprint": "0" * 64,
        "preparationConfig": {"includePilot": False},
        "rows": rows,
        "quality": {
            "ratedRows": len(rows),
            "groupCount": group_count,
            "classCounts": class_counts,
            "conditionCounts": {"RULES_ADAPTIVE": len(rows) // 2, "NEUTRAL_PROCEDURAL": len(rows) // 2},
        },
        "readiness": {"readyForOfficialTraining": len(rows) >= 100 and group_count >= 5},
    }
