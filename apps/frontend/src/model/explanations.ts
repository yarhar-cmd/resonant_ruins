import type { ModelArtifact } from './artifactSchema';
import type { ModelFeatureContribution } from '../types/model';
import { MODEL_TARGET_CLASSES, type ModelTargetClass } from './featureManifest';
import type { EncodedModelFeatures } from './encoding';

const classLabel: Record<ModelTargetClass, string> = {
  too_easy: 'Too Easy',
  about_right: 'About Right',
  too_hard: 'Too Hard',
};

export function explainEncodedFeatures(
  artifact: ModelArtifact,
  encoded: EncodedModelFeatures,
): Record<ModelTargetClass, ModelFeatureContribution[]> {
  return Object.fromEntries(
    MODEL_TARGET_CLASSES.map((targetClass, classIndex) => [
      targetClass,
      artifact.encodedFeatureOrder.map((feature, featureIndex) => {
        const coefficient = artifact.coefficients[classIndex]![featureIndex]!;
        const normalizedValue = encoded.normalized[featureIndex]!;
        const contribution = normalizedValue * coefficient;
        return {
          feature,
          rawValue: encoded.rawValues[featureIndex]!,
          normalizedValue,
          coefficient,
          contribution,
          targetClass,
          phrase: `${feature} ${contribution >= 0 ? 'raised' : 'lowered'} the ${classLabel[targetClass]} score; this is an association, not a cause.`,
        };
      }),
    ]),
  ) as Record<ModelTargetClass, ModelFeatureContribution[]>;
}

export function strongestContributions(
  contributions: readonly ModelFeatureContribution[],
  limit = 4,
): ModelFeatureContribution[] {
  return [...contributions]
    .sort(
      (left, right) =>
        Math.abs(right.contribution) - Math.abs(left.contribution) ||
        left.feature.localeCompare(right.feature),
    )
    .slice(0, limit);
}
