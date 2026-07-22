import type { ModelSemanticFeatures, ModelTargetClass } from '../model/featureManifest';

export type ModelArtifactStatus = 'development' | 'approved';
export type ModelScoringAvailability = 'success' | 'unavailable' | 'incompatible' | 'failed';

export interface ModelFeatureContribution {
  feature: string;
  rawValue: number | string;
  normalizedValue: number;
  coefficient: number;
  contribution: number;
  targetClass: ModelTargetClass;
  phrase: string;
}

export interface CandidateModelPrediction {
  candidateId: string;
  probabilities: Record<ModelTargetClass, number>;
  predictedClass: ModelTargetClass;
  confidence: number;
  rank: number;
  logits: Record<ModelTargetClass, number>;
  contributions: Record<ModelTargetClass, ModelFeatureContribution[]>;
}

export type CandidateModelScoringResult =
  | {
      status: 'success';
      artifactId: string;
      modelId: string;
      modelVersion: string;
      predictions: CandidateModelPrediction[];
      preferredCandidateId: string;
      scoringDurationMs: number;
    }
  | {
      status: Exclude<ModelScoringAvailability, 'success'>;
      artifactId: string | null;
      stage: 'registry' | 'artifact-validation' | 'feature-construction' | 'inference';
      reasonCode: string;
    };

export interface CandidateModelInput {
  candidateId: string;
  features: ModelSemanticFeatures;
}

export interface CandidateScoringModel {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly artifactId: string;
  scoreCandidates(candidates: readonly CandidateModelInput[]): CandidateModelScoringResult;
}

export interface LearnedRoomSelectorBoundary {
  readonly selectorId: 'learned-model';
  readonly model: CandidateScoringModel;
}
