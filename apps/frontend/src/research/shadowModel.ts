import type { CandidateModelScores, CandidateScoringModel } from '../types/model';

export const NO_MODEL_INSTALLED: CandidateScoringModel = Object.freeze({
  modelId: 'none',
  modelVersion: 'unavailable',
  scoreCandidates(): CandidateModelScores {
    return { availability: 'unavailable', scores: null };
  },
});

export const SHADOW_MODEL_STATUS = Object.freeze({
  availability: 'unavailable' as const,
  message: 'No model installed',
  shadowMode: 'disabled' as const,
  modelId: NO_MODEL_INSTALLED.modelId,
  modelVersion: NO_MODEL_INSTALLED.modelVersion,
});
