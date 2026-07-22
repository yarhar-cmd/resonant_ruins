import type { CandidateScoringModel } from '../types/model';

export const NO_MODEL_INSTALLED: CandidateScoringModel = Object.freeze({
  modelId: 'none',
  modelVersion: 'unavailable',
  artifactId: 'none',
  scoreCandidates() {
    return {
      status: 'unavailable' as const,
      artifactId: null,
      stage: 'registry' as const,
      reasonCode: 'no-approved-model',
    };
  },
});

export const SHADOW_MODEL_STATUS = Object.freeze({
  availability: 'unavailable' as const,
  message: 'No model installed',
  shadowMode: 'disabled' as const,
  modelId: NO_MODEL_INSTALLED.modelId,
  modelVersion: NO_MODEL_INSTALLED.modelVersion,
  artifactId: NO_MODEL_INSTALLED.artifactId,
});
