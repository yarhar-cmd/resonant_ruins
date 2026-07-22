import type { ModelArtifact } from './artifactSchema';
import {
  MODEL_FEATURE_MANIFEST,
  type ModelCategoricalFeatureName,
  type ModelSemanticFeatures,
} from './featureManifest';

export interface EncodedModelFeatures {
  encoded: number[];
  normalized: number[];
  rawValues: (number | string)[];
}

export class ModelCompatibilityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ModelCompatibilityError';
    this.code = code;
  }
}

export function encodeModelFeatures(
  features: ModelSemanticFeatures,
  artifact: ModelArtifact,
): EncodedModelFeatures {
  const encoded: number[] = [];
  const rawValues: (number | string)[] = [];
  for (const name of MODEL_FEATURE_MANIFEST.semanticFeatureOrder) {
    const value = features[name];
    const vocabulary = MODEL_FEATURE_MANIFEST.categoricalFeatures[
      name as ModelCategoricalFeatureName
    ] as readonly string[] | undefined;
    if (vocabulary) {
      if (!vocabulary.includes(String(value)))
        throw new ModelCompatibilityError('unknown-category', `Unknown ${name} category.`);
      for (const category of vocabulary) {
        encoded.push(value === category ? 1 : 0);
        rawValues.push(String(value));
      }
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new ModelCompatibilityError('invalid-numeric-feature', `${name} must be finite.`);
      encoded.push(value);
      rawValues.push(value);
    }
  }
  if (encoded.length !== artifact.encodedFeatureOrder.length)
    throw new ModelCompatibilityError('feature-dimension', 'Encoded feature dimensions differ.');
  const normalized = encoded.map(
    (value, index) =>
      (value - artifact.normalization.means[index]!) / artifact.normalization.scales[index]!,
  );
  if (normalized.some((value) => !Number.isFinite(value)))
    throw new ModelCompatibilityError('normalization-failed', 'Normalized features are invalid.');
  return { encoded, normalized, rawValues };
}
