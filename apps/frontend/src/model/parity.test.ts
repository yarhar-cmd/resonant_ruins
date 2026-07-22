import { describe, expect, it } from 'vitest';
import artifactValue from './__fixtures__/development-artifact-1.json';
import parity from './__fixtures__/parity-cases-1.json';
import { parseModelArtifact } from './artifactSchema';
import { encodeModelFeatures } from './encoding';
import type { ModelSemanticFeatures } from './featureManifest';
import { scoreModelCandidates } from './inference';

describe('Python and TypeScript model parity', () => {
  it('matches encoded values, normalization, logits, probabilities, class, and rank', () => {
    const artifact = parseModelArtifact(artifactValue);
    const tolerance = parity.tolerance;
    const result = scoreModelCandidates(
      artifact,
      parity.cases.map((item) => ({
        candidateId: item.candidateId,
        features: item.semanticInput as ModelSemanticFeatures,
      })),
    );
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    for (const fixture of parity.cases) {
      const encoded = encodeModelFeatures(fixture.semanticInput as ModelSemanticFeatures, artifact);
      encoded.encoded.forEach((value, index) =>
        expect(Math.abs(value - fixture.encodedVector[index]!)).toBeLessThanOrEqual(tolerance),
      );
      encoded.normalized.forEach((value, index) =>
        expect(Math.abs(value - fixture.normalizedVector[index]!)).toBeLessThanOrEqual(tolerance),
      );
      const prediction = result.predictions.find(
        (item) => item.candidateId === fixture.candidateId,
      )!;
      Object.values(prediction.logits).forEach((value, index) =>
        expect(Math.abs(value - fixture.logits[index]!)).toBeLessThanOrEqual(tolerance),
      );
      Object.values(prediction.probabilities).forEach((value, index) =>
        expect(Math.abs(value - fixture.probabilities[index]!)).toBeLessThanOrEqual(tolerance),
      );
      expect(prediction.predictedClass).toBe(fixture.predictedClass);
      expect(prediction.rank).toBe(fixture.candidateRank);
    }
  });
});
