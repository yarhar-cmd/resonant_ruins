import manifestJson from './schema/model-features-1.json';
import type { DifficultyRating } from '../types/research';

export const MODEL_FEATURE_SCHEMA_VERSION = 'model-features-1' as const;
export const MODEL_TARGET_CLASSES = ['too_easy', 'about_right', 'too_hard'] as const;
export const MODEL_RATING_HISTORY_WINDOW = 3 as const;

export type ModelTargetClass = (typeof MODEL_TARGET_CLASSES)[number];
export type PreviousDifficultyRating = DifficultyRating | '__missing__';
export type FountainPlacementFeature = 'none' | 'safe' | 'risky';

export interface ModelSemanticFeatures {
  pace: number;
  caution: number;
  aggression: number;
  hazardTolerance: number;
  exploration: number;
  currentHealthPercentage: number;
  recentDamage: number;
  recentAverageRoomDuration: number;
  recentDurationRoomCount: number;
  roomsCompletedInSession: number;
  experiencePreset: 'new-delver' | 'seasoned-adventurer' | 'dungeon-veteran';
  incomingEntranceDirection: 'north' | 'east' | 'south' | 'west';
  previousDifficultyRating: PreviousDifficultyRating;
  previousRatingAvailable: number;
  aboutRightRateLast3RatedRooms: number;
  tooEasyCountLast3RatedRooms: number;
  tooHardCountLast3RatedRooms: number;
  ratedRoomsAvailableInWindow: number;
  roomsSinceLastSubmittedDifficultyRating: number;
  archetype:
    | 'open-arena'
    | 'true-l-ruin'
    | 'split-chamber'
    | 'pillar-hall'
    | 'ring-route'
    | 'twin-chambers'
    | 'safe-fallback';
  boundaryFamily:
    | 'rectangle'
    | 'cut-corner'
    | 'notched'
    | 'true-l'
    | 't-shape'
    | 'connected-chambers'
    | 'asymmetrical-wing';
  floorArea: number;
  openFloorPercentage: number;
  oneTileChokepointCount: number;
  maximumDeadEndLength: number;
  safePathDistance: number;
  directnessRatio: number;
  ratCount: number;
  runeCount: number;
  averageRatSpawnDistance: number;
  fountainPlacement: FountainPlacementFeature;
}

export type ModelSemanticFeatureName = keyof ModelSemanticFeatures;
export type ModelNumericFeatureName = {
  [K in ModelSemanticFeatureName]: ModelSemanticFeatures[K] extends number ? K : never;
}[ModelSemanticFeatureName];
export type ModelCategoricalFeatureName = Exclude<
  ModelSemanticFeatureName,
  ModelNumericFeatureName
>;

export interface ModelFeatureManifest {
  schemaVersion: typeof MODEL_FEATURE_SCHEMA_VERSION;
  targetClasses: readonly ModelTargetClass[];
  ratingHistoryWindow: number;
  semanticFeatureOrder: readonly ModelSemanticFeatureName[];
  numericFeatures: readonly ModelNumericFeatureName[];
  categoricalFeatures: Readonly<Record<ModelCategoricalFeatureName, readonly string[]>>;
  missingPolicy: Readonly<Record<string, string>>;
}

export const MODEL_FEATURE_MANIFEST = manifestJson as ModelFeatureManifest;

const semanticNames = new Set(MODEL_FEATURE_MANIFEST.semanticFeatureOrder);
if (
  MODEL_FEATURE_MANIFEST.schemaVersion !== MODEL_FEATURE_SCHEMA_VERSION ||
  semanticNames.size !== MODEL_FEATURE_MANIFEST.semanticFeatureOrder.length
) {
  throw new Error('The model-features-1 manifest is invalid.');
}

export const MODEL_ENCODED_FEATURE_ORDER = MODEL_FEATURE_MANIFEST.semanticFeatureOrder.flatMap(
  (feature) => {
    const vocabulary = MODEL_FEATURE_MANIFEST.categoricalFeatures[
      feature as ModelCategoricalFeatureName
    ] as readonly string[] | undefined;
    return vocabulary ? vocabulary.map((value) => `${feature}=${value}`) : [feature];
  },
);

export function isModelTargetClass(value: unknown): value is ModelTargetClass {
  return MODEL_TARGET_CLASSES.includes(value as ModelTargetClass);
}
