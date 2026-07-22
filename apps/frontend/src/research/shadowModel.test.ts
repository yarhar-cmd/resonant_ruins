import { describe, expect, it } from 'vitest';
import { NO_MODEL_INSTALLED, SHADOW_MODEL_STATUS } from './shadowModel';

describe('future shadow-model boundary', () => {
  it('reports unavailable without synthetic scores, probabilities, or ranking', () => {
    expect(SHADOW_MODEL_STATUS).toEqual({
      availability: 'unavailable',
      message: 'No model installed',
      shadowMode: 'disabled',
      modelId: 'none',
      modelVersion: 'unavailable',
      artifactId: 'none',
    });
    expect(NO_MODEL_INSTALLED.scoreCandidates([])).toEqual({
      status: 'unavailable',
      artifactId: null,
      stage: 'registry',
      reasonCode: 'no-approved-model',
    });
  });
});
