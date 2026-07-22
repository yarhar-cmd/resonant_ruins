import { describe, expect, it } from 'vitest';
import artifact from './__fixtures__/development-artifact-1.json';
import parity from './__fixtures__/parity-cases-1.json';
import { scoreModelCandidates, stableSoftmax } from './inference';
import type { ModelSemanticFeatures } from './featureManifest';

describe('TypeScript multinomial inference', () => {
  it('uses stable softmax for extreme logits', () => {
    const probabilities = stableSoftmax([10_000, 9_999, -10_000]);
    expect(probabilities.every(Number.isFinite)).toBe(true);
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
  });

  it('produces probabilities, deterministic ranks, and readable contributions', () => {
    const result = scoreModelCandidates(
      artifact,
      parity.cases.slice(0, 3).map((item) => ({
        candidateId: item.candidateId,
        features: item.semanticInput as ModelSemanticFeatures,
      })),
    );
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.predictions.map((item) => item.rank)).toEqual([1, 2, 3]);
    expect(result.predictions[0]!.contributions.about_right[0]!.phrase).toContain(
      'association, not a cause',
    );
    for (const prediction of result.predictions) {
      expect(
        Object.values(prediction.probabilities).reduce((sum, value) => sum + value, 0),
      ).toBeCloseTo(1, 12);
    }
  });

  it('returns typed compatibility and failure states instead of throwing', () => {
    const semantic = parity.cases[0]!.semanticInput as ModelSemanticFeatures;
    expect(
      scoreModelCandidates(artifact, [
        {
          candidateId: 'unknown',
          features: {
            ...semantic,
            archetype: 'invented',
          } as unknown as ModelSemanticFeatures,
        },
      ]),
    ).toMatchObject({ status: 'incompatible', reasonCode: 'unknown-category' });
    expect(scoreModelCandidates({ ...artifact, coefficients: [] }, [])).toMatchObject({
      status: 'incompatible',
      stage: 'artifact-validation',
    });
  });
});
