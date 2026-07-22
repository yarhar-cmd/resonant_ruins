from __future__ import annotations

import json
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
FEATURE_MANIFEST_PATH = (
    REPOSITORY_ROOT
    / "apps"
    / "frontend"
    / "src"
    / "model"
    / "schema"
    / "model-features-1.json"
)

with FEATURE_MANIFEST_PATH.open("r", encoding="utf-8") as manifest_file:
    FEATURE_MANIFEST = json.load(manifest_file)

CLASS_ORDER = tuple(FEATURE_MANIFEST["targetClasses"])
SEMANTIC_FEATURE_ORDER = tuple(FEATURE_MANIFEST["semanticFeatureOrder"])
NUMERIC_FEATURES = tuple(FEATURE_MANIFEST["numericFeatures"])
CATEGORICAL_FEATURES = {
    name: tuple(values) for name, values in FEATURE_MANIFEST["categoricalFeatures"].items()
}

ROOM_FEATURES = (
    "archetype",
    "boundaryFamily",
    "floorArea",
    "openFloorPercentage",
    "oneTileChokepointCount",
    "maximumDeadEndLength",
    "safePathDistance",
    "directnessRatio",
    "ratCount",
    "runeCount",
    "averageRatSpawnDistance",
    "fountainPlacement",
)
PLAYER_FEATURES = (
    "pace",
    "caution",
    "aggression",
    "hazardTolerance",
    "exploration",
    "currentHealthPercentage",
    "recentDamage",
    "recentAverageRoomDuration",
    "recentDurationRoomCount",
    "roomsCompletedInSession",
    "experiencePreset",
    "incomingEntranceDirection",
)
RATING_FEATURES = (
    "previousDifficultyRating",
    "previousRatingAvailable",
    "aboutRightRateLast3RatedRooms",
    "tooEasyCountLast3RatedRooms",
    "tooHardCountLast3RatedRooms",
    "ratedRoomsAvailableInWindow",
    "roomsSinceLastSubmittedDifficultyRating",
)
MODEL_VARIANTS = {
    "room-only-logistic": ROOM_FEATURES,
    "player-plus-room-logistic": PLAYER_FEATURES + ROOM_FEATURES,
    "player-room-rating-logistic": PLAYER_FEATURES + RATING_FEATURES + ROOM_FEATURES,
}

LOGISTIC_CONFIGURATION = {
    "l1_ratio": 0.0,
    "solver": "lbfgs",
    "C": 1.0,
    "class_weight": "balanced",
    "fit_intercept": True,
    "max_iter": 2000,
    "tol": 1e-8,
}
LOGISTIC_CONFIGURATION_DESCRIPTION = {"regularization": "l2", **LOGISTIC_CONFIGURATION}
SPLIT_RANDOM_STATE = 1705
HOLDOUT_FRACTION = 0.2
CALIBRATION_BIN_COUNT = 10
