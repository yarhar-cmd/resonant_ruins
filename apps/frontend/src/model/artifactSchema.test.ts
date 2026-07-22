import { describe, expect, it } from 'vitest';
import artifact from './__fixtures__/development-artifact-1.json';
import { ModelArtifactSchema } from './artifactSchema';

describe('model-artifact-1 validation', () => {
  it('accepts the synthetic development fixture with strict dimensions', () => {
    const parsed = ModelArtifactSchema.parse(artifact);
    expect(parsed.status).toBe('development');
    expect(parsed.modelId).toBe('fixture-logistic-development-1');
    expect(parsed.coefficients).toHaveLength(3);
    expect(parsed.coefficients[0]).toHaveLength(parsed.encodedFeatureOrder.length);
  });

  it('rejects invalid dimensions, class order, and non-finite values', () => {
    expect(ModelArtifactSchema.safeParse({ ...artifact, intercepts: [0, 1] }).success).toBe(false);
    expect(
      ModelArtifactSchema.safeParse({
        ...artifact,
        classOrder: ['about_right', 'too_easy', 'too_hard'],
      }).success,
    ).toBe(false);
    expect(
      ModelArtifactSchema.safeParse({
        ...artifact,
        normalization: {
          ...artifact.normalization,
          scales: [0, ...artifact.normalization.scales.slice(1)],
        },
      }).success,
    ).toBe(false);
  });
});
