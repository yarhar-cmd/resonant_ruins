import { z } from 'zod';
import {
  MODEL_ENCODED_FEATURE_ORDER,
  MODEL_FEATURE_MANIFEST,
  MODEL_FEATURE_SCHEMA_VERSION,
  MODEL_TARGET_CLASSES,
} from './featureManifest';

const finite = z.number().finite();

export const ModelArtifactSchema = z
  .object({
    artifactSchemaVersion: z.literal('model-artifact-1'),
    artifactId: z.string().min(1),
    status: z.enum(['development', 'approved']),
    modelId: z.string().min(1),
    modelVersion: z.string().min(1),
    modelType: z.literal('multinomial-logistic-regression'),
    datasetFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    classOrder: z.array(z.enum(MODEL_TARGET_CLASSES)).length(MODEL_TARGET_CLASSES.length),
    rawSemanticFeatureOrder: z.array(z.string()).min(1),
    encodedFeatureOrder: z.array(z.string()).min(1),
    categoricalVocabularies: z.record(z.string(), z.array(z.string().min(1)).min(1)),
    missingValuePolicy: z.record(z.string(), z.string()),
    normalization: z.object({
      means: z.array(finite),
      scales: z.array(finite.positive()),
    }),
    coefficients: z.array(z.array(finite)).length(MODEL_TARGET_CLASSES.length),
    intercepts: z.array(finite).length(MODEL_TARGET_CLASSES.length),
    trainingConfiguration: z.record(z.string(), z.unknown()),
    aggregateDatasetCounts: z.object({
      ratedRows: z.number().int().nonnegative(),
      groupCount: z.number().int().nonnegative(),
      classCounts: z.record(z.enum(MODEL_TARGET_CLASSES), z.number().int().nonnegative()),
      conditionCounts: z.record(z.string(), z.number().int().nonnegative()),
    }),
    groupedEvaluation: z.record(z.string(), z.unknown()),
    compatibility: z.object({
      gameVersions: z.array(z.string()),
      generatorVersion: z.literal('generator-4'),
      adaptationVersion: z.literal('rules-2'),
      researchSchemaVersion: z.literal('research-1'),
      featureSchemaVersion: z.literal(MODEL_FEATURE_SCHEMA_VERSION),
      shadowSchemaVersion: z.literal('shadow-1'),
    }),
    calibration: z.object({
      method: z.string(),
      note: z.string(),
    }),
    createdAt: z.string().datetime(),
  })
  .superRefine((artifact, context) => {
    const encodedLength = artifact.encodedFeatureOrder.length;
    const issue = (message: string) => context.addIssue({ code: 'custom', message });
    if (artifact.classOrder.join('|') !== MODEL_TARGET_CLASSES.join('|'))
      issue('Artifact class order is incompatible.');
    if (
      artifact.rawSemanticFeatureOrder.join('|') !==
      MODEL_FEATURE_MANIFEST.semanticFeatureOrder.join('|')
    )
      issue('Artifact semantic feature order is incompatible.');
    if (artifact.encodedFeatureOrder.join('|') !== MODEL_ENCODED_FEATURE_ORDER.join('|'))
      issue('Artifact encoded feature order is incompatible.');
    if (
      artifact.normalization.means.length !== encodedLength ||
      artifact.normalization.scales.length !== encodedLength
    )
      issue('Artifact normalization dimensions are invalid.');
    if (artifact.coefficients.some((row) => row.length !== encodedLength))
      issue('Artifact coefficient dimensions are invalid.');
    for (const [name, vocabulary] of Object.entries(MODEL_FEATURE_MANIFEST.categoricalFeatures)) {
      if (artifact.categoricalVocabularies[name]?.join('|') !== vocabulary.join('|'))
        issue(`Artifact category vocabulary is incompatible for ${name}.`);
    }
    if (artifact.status === 'development' && artifact.modelId === 'model-1')
      issue('Development artifacts cannot use model ID model-1.');
  });

export type ModelArtifact = z.infer<typeof ModelArtifactSchema>;

export function parseModelArtifact(value: unknown): ModelArtifact {
  return ModelArtifactSchema.parse(value);
}
