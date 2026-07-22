import { performance } from './performance';
import type {
  CandidateModelInput,
  CandidateModelPrediction,
  CandidateModelScoringResult,
  CandidateScoringModel,
} from '../types/model';
import { ModelArtifactSchema, type ModelArtifact } from './artifactSchema';
import { encodeModelFeatures, ModelCompatibilityError } from './encoding';
import { explainEncodedFeatures } from './explanations';
import { MODEL_TARGET_CLASSES, type ModelTargetClass } from './featureManifest';

function stableSoftmax(logits: readonly number[]): number[] {
  const maximum = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  const probabilities = exponentials.map((value) => value / total);
  if (
    probabilities.some((value) => !Number.isFinite(value) || value < 0 || value > 1) ||
    Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) > 1e-9
  )
    throw new Error('Probability validation failed.');
  return probabilities;
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * right[index]!, 0);
}

function predictCandidate(
  artifact: ModelArtifact,
  candidate: CandidateModelInput,
): CandidateModelPrediction {
  const encoded = encodeModelFeatures(candidate.features, artifact);
  const logitValues = artifact.coefficients.map(
    (coefficients, index) => dot(encoded.normalized, coefficients) + artifact.intercepts[index]!,
  );
  const probabilityValues = stableSoftmax(logitValues);
  const predictedIndex = probabilityValues.indexOf(Math.max(...probabilityValues));
  return {
    candidateId: candidate.candidateId,
    probabilities: Object.fromEntries(
      MODEL_TARGET_CLASSES.map((targetClass, index) => [targetClass, probabilityValues[index]!]),
    ) as Record<ModelTargetClass, number>,
    predictedClass: MODEL_TARGET_CLASSES[predictedIndex]!,
    confidence: probabilityValues[predictedIndex]!,
    rank: 0,
    logits: Object.fromEntries(
      MODEL_TARGET_CLASSES.map((targetClass, index) => [targetClass, logitValues[index]!]),
    ) as Record<ModelTargetClass, number>,
    contributions: explainEncodedFeatures(artifact, encoded),
  };
}

export function scoreModelCandidates(
  artifactValue: unknown,
  candidates: readonly CandidateModelInput[],
): CandidateModelScoringResult {
  const parsed = ModelArtifactSchema.safeParse(artifactValue);
  if (!parsed.success)
    return {
      status: 'incompatible',
      artifactId:
        artifactValue && typeof artifactValue === 'object'
          ? String((artifactValue as Record<string, unknown>).artifactId ?? '') || null
          : null,
      stage: 'artifact-validation',
      reasonCode: 'invalid-artifact',
    };
  const started = performance.now();
  try {
    const predictions = candidates.map((candidate) => predictCandidate(parsed.data, candidate));
    predictions.sort(
      (left, right) =>
        right.probabilities.about_right - left.probabilities.about_right ||
        left.candidateId.localeCompare(right.candidateId),
    );
    predictions.forEach((prediction, index) => {
      prediction.rank = index + 1;
    });
    return {
      status: 'success',
      artifactId: parsed.data.artifactId,
      modelId: parsed.data.modelId,
      modelVersion: parsed.data.modelVersion,
      predictions,
      preferredCandidateId: predictions[0]?.candidateId ?? '',
      scoringDurationMs: performance.now() - started,
    };
  } catch (error) {
    return {
      status: error instanceof ModelCompatibilityError ? 'incompatible' : 'failed',
      artifactId: parsed.data.artifactId,
      stage: error instanceof ModelCompatibilityError ? 'feature-construction' : 'inference',
      reasonCode: error instanceof ModelCompatibilityError ? error.code : 'scoring-failed',
    };
  }
}

export function createArtifactScoringModel(artifact: ModelArtifact): CandidateScoringModel {
  return Object.freeze({
    modelId: artifact.modelId,
    modelVersion: artifact.modelVersion,
    artifactId: artifact.artifactId,
    scoreCandidates(candidates: readonly CandidateModelInput[]) {
      return scoreModelCandidates(artifact, candidates);
    },
  });
}

export { stableSoftmax };
