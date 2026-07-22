import { describe, expect, it } from 'vitest';
import artifact from './__fixtures__/development-artifact-1.json';
import parity from './__fixtures__/parity-cases-1.json';
import type { ModelSemanticFeatures } from './featureManifest';
import { scoreModelCandidates } from './inference';
import { attachObservedShadowRating, createShadowRoomEvidence } from './shadowEvidence';

const activeDecision = {
  selectorId: 'rules-adaptive' as const,
  selectorVersion: 'rules-selector-1' as const,
  sharedPoolId: 'pool-1',
  candidateCount: 2,
  selectedCandidateId: parity.cases[0]!.candidateId,
  selectedCandidateRank: 1,
  selectedScore: 0.5,
  deterministicRoll: 0.2,
  explanationTokens: [],
  topCandidates: [],
  reducedDiversity: false,
  fallbackUsed: false,
  profileConsumed: true,
  challengedTraits: [],
};

describe('shadow evidence', () => {
  it('stores compact prediction evidence and attaches observed feedback later', () => {
    const result = scoreModelCandidates(
      artifact,
      parity.cases.slice(0, 2).map((item) => ({
        candidateId: item.candidateId,
        features: item.semanticInput as ModelSemanticFeatures,
      })),
    );
    const evidence = createShadowRoomEvidence({
      roomDecisionId: 'run:1:candidate',
      sharedPoolId: 'pool-1',
      activeDecision,
      result,
      priorRatingAvailable: false,
    })!;
    expect(evidence.status).toBe('scored');
    expect(evidence.candidates[0]!.topContributions.length).toBeLessThanOrEqual(6);
    expect(evidence.observedRating).toBeNull();
    const finalized = attachObservedShadowRating(evidence, 'about_right');
    expect(finalized.observedRating).toBe('about_right');
    expect(finalized.predictedObservedClass).not.toBeNull();
  });

  it('does not create fake evidence for the no-model state', () => {
    expect(
      createShadowRoomEvidence({
        roomDecisionId: 'none',
        sharedPoolId: 'pool-1',
        activeDecision,
        result: {
          status: 'unavailable',
          artifactId: null,
          stage: 'registry',
          reasonCode: 'no-approved-model',
        },
        priorRatingAvailable: false,
      }),
    ).toBeNull();
  });
});
