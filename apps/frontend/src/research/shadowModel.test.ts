import { describe, expect, it } from 'vitest';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import { NO_MODEL_INSTALLED, SHADOW_MODEL_STATUS } from './shadowModel';

describe('future shadow-model boundary', () => {
  it('reports unavailable without synthetic scores, probabilities, or ranking', () => {
    expect(SHADOW_MODEL_STATUS).toEqual({
      availability: 'unavailable',
      message: 'No model installed',
      shadowMode: 'disabled',
      modelId: 'none',
      modelVersion: 'unavailable',
    });
    expect(
      NO_MODEL_INSTALLED.scoreCandidates(
        { runSeed: 'none', roomSequence: 1, profile: NEUTRAL_ADAPTIVE_PROFILE },
        [],
      ),
    ).toEqual({ availability: 'unavailable', scores: null });
  });
});
