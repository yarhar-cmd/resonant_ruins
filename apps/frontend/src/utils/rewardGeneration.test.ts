import { describe, expect, it } from 'vitest';
import type { AdaptiveProfile } from '../types/adaptation';
import type { GeneratedRoomSave } from '../types/generation';
import { getResonanceCaches } from './interactions';
import { generateDungeonRoom } from './generatedRoomGenerator';
import { applyRewardLayer, findRewardPlacementCandidates } from './rewardGeneration';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';
import artifact from '../model/__fixtures__/development-artifact-1.json';
import parity from '../model/__fixtures__/parity-cases-1.json';
import { MODEL_FEATURE_MANIFEST, type ModelSemanticFeatures } from '../model/featureManifest';
import { scoreModelCandidates } from '../model/inference';
import { awardResonance } from './resonance';
import { createRectangularRoom } from './roomGeometry';

const profile: AdaptiveProfile = {
  pace: 0.5,
  caution: 0.5,
  aggression: 0.5,
  hazardTolerance: 0.5,
  exploration: 0.5,
};

function generated(seed: string, roomNumber = 10): GeneratedRoomSave {
  return generateDungeonRoom({
    runSeed: seed,
    dungeonRoomNumber: roomNumber,
    chosenExitId: 'reward-entry',
    entranceDirection: 'west',
    experiencePreset: 'seasoned-adventurer',
    effectiveProfile: profile,
    mode: 'reinforce',
    generatorVersion: 'generator-4',
    adaptationVersion: 'rules-2',
    gameVersion: 'mvp-0.5',
  });
}

let eligibleFixture: GeneratedRoomSave | null = null;
function findEligibleFixture(): GeneratedRoomSave {
  if (eligibleFixture) return eligibleFixture;
  for (let index = 0; index < 40; index += 1) {
    const candidate = generated(`reward-fixture-${index}`);
    if (findRewardPlacementCandidates(candidate).candidates.length > 0) {
      eligibleFixture = candidate;
      return candidate;
    }
  }
  throw new Error('No deterministic rewards-1 fixture was eligible.');
}

function selectorEvidence(save: GeneratedRoomSave) {
  return {
    sharedPoolId: save.details.sharedPoolId,
    selectedCandidateId: save.details.selectedCandidateId,
    selectedCandidateRank: save.details.selectedCandidateRank,
    selectedCandidateScore: save.details.selectedCandidateScore,
    seededSelectionRoll: save.details.seededSelectionRoll,
    selectorExplanation: save.details.selectorExplanation,
    topCandidates: save.details.topCandidates,
    selectedFeatureVector: save.details.selectedFeatureVector,
    topology: save.roomSnapshot.topology,
    exits: save.roomSnapshot.exits,
    hazards: save.roomSnapshot.hazards,
    rats: save.roomSnapshot.enemySpawns,
    fountains: save.roomSnapshot.features?.filter(
      (feature) => feature.kind === 'restoration-fountain',
    ),
  };
}

describe('post-selection rewards-1 generation', () => {
  it('is deterministic and independent of profile, condition, selector, and model context', () => {
    const base = findEligibleFixture();
    const left = applyRewardLayer(base, { override: 'force' });
    const right = applyRewardLayer(structuredClone(base), { override: 'force' });
    expect(right.details.rewardDecision).toEqual(left.details.rewardDecision);
    expect(right.roomSnapshot.features).toEqual(left.roomSnapshot.features);
  });

  it('does not alter candidate, selector, topology, Fountain, or model evidence', () => {
    const base = findEligibleFixture();
    const before = selectorEvidence(base);
    for (const result of [
      applyRewardLayer(base, { override: 'disable' }),
      applyRewardLayer(base),
      applyRewardLayer(base, { override: 'force' }),
    ]) {
      expect(selectorEvidence(result)).toEqual(before);
    }
    expect(base.details.rewardDecision).toBeUndefined();
  });

  it('rolls only after eligibility and uses 35% as the eligible-room chance', () => {
    const result = applyRewardLayer(findEligibleFixture());
    expect(result.details.rewardDecision).toMatchObject({
      rewardSystemVersion: 'rewards-1',
      eligible: true,
      spawnChance: 0.35,
    });
    expect(result.details.rewardDecision?.spawnRoll).toBeGreaterThanOrEqual(0);
    expect(result.details.rewardDecision?.spawnRoll).toBeLessThan(1);
  });

  it('forces at most one Cache onto a validated optional-route placement', () => {
    const result = applyRewardLayer(findEligibleFixture(), { override: 'force' });
    const caches = getResonanceCaches(result.roomSnapshot);
    expect(caches).toHaveLength(1);
    expect(result.details.rewardDecision).toMatchObject({
      spawned: true,
      spawnReason: 'sandbox-forced',
      eligible: true,
    });
    expect(result.details.rewardDecision?.placementCategory).not.toBeNull();
    expect(result.details.rewardDecision?.interactionTiles.length).toBeGreaterThan(0);
    expect(validateGeneratedRoomV3(result.roomSnapshot)).toEqual({ valid: true, errors: [] });
  });

  it('suppresses safe fallbacks and never changes their geometry', () => {
    const base = findEligibleFixture();
    const fallback: GeneratedRoomSave = {
      ...base,
      roomSnapshot: { ...base.roomSnapshot, archetype: 'safe-fallback' },
      details: { ...base.details, archetype: 'safe-fallback', fallbackUsed: true },
    };
    const result = applyRewardLayer(fallback, { override: 'force' });
    expect(result.details.rewardDecision?.spawnReason).toBe('fallback-suppressed');
    expect(getResonanceCaches(result.roomSnapshot)).toHaveLength(0);
    expect(result.roomSnapshot.floorTiles).toEqual(base.roomSnapshot.floorTiles);
  });

  it('suppresses authored rooms and records honest provenance', () => {
    const base = findEligibleFixture();
    const authored: GeneratedRoomSave = {
      ...base,
      roomSnapshot: { ...base.roomSnapshot, phase: 'evaluation' },
    };
    const result = applyRewardLayer(authored, { override: 'force' });
    expect(result.details.rewardDecision?.spawnReason).toBe('authored-room');
    expect(getResonanceCaches(result.roomSnapshot)).toHaveLength(0);
  });

  it('qualifies a real optional dead end but rejects main-route-only and Open Arena center layouts', () => {
    const base = findEligibleFixture();
    const corridor = Array.from({ length: 9 }, (_, x) => ({ x, y: 2 }));
    const optionalDeadEnd: GeneratedRoomSave = {
      ...base,
      roomSnapshot: {
        id: 'optional-dead-end-fixture',
        phase: 'dungeon',
        width: 9,
        height: 5,
        archetype: 'pillar-hall',
        floorTiles: [...corridor, { x: 4, y: 1 }, { x: 4, y: 0 }],
        wallTiles: [],
        exits: [
          {
            id: 'east-exit',
            direction: 'east',
            tile: { x: 8, y: 2 },
            kind: 'standard',
            condition: { type: 'enemies-defeated' },
            enabled: true,
            destination: { type: 'next-generated-room' },
          },
        ],
        entrance: { direction: 'west', tile: { x: 0, y: 2 } },
        spawnPoints: { west: { x: 1, y: 2 } },
        hazards: [],
        enemySpawns: [],
      },
    };
    const deadEnd = findRewardPlacementCandidates(optionalDeadEnd);
    expect(deadEnd.candidates).toContainEqual(
      expect.objectContaining({
        coordinate: { x: 4, y: 0 },
        placementCategory: 'optional-dead-end',
      }),
    );

    const mainRouteOnly = findRewardPlacementCandidates({
      ...optionalDeadEnd,
      roomSnapshot: { ...optionalDeadEnd.roomSnapshot, floorTiles: corridor },
    });
    expect(mainRouteOnly).toEqual({ meaningfulCount: 0, candidates: [] });

    const arena = createRectangularRoom({
      id: 'open-arena-center-fixture',
      phase: 'dungeon',
      width: 11,
      height: 9,
      exitEnabled: true,
    });
    const openArena = findRewardPlacementCandidates({
      ...base,
      roomSnapshot: { ...arena, archetype: 'open-arena' },
    });
    expect(openArena.candidates).toHaveLength(0);
  });

  it('removes a selected Cache when complete validation rejects it', () => {
    const result = applyRewardLayer(findEligibleFixture(), {
      override: 'force',
      validator: () => ({ valid: false, errors: ['test-rejection'] }),
    });
    expect(result.details.rewardDecision?.spawnReason).toBe('invalid-after-validation');
    expect(getResonanceCaches(result.roomSnapshot)).toHaveLength(0);
  });

  it('keeps rewards and Resonance outside model-features-1 and leaves predictions/ranks identical', () => {
    expect(MODEL_FEATURE_MANIFEST.schemaVersion).toBe('model-features-1');
    expect(MODEL_FEATURE_MANIFEST.semanticFeatureOrder).not.toContain('resonance');
    expect(MODEL_FEATURE_MANIFEST.semanticFeatureOrder).not.toContain('cacheSpawned');
    const candidates = parity.cases.slice(0, 3).map((item) => ({
      candidateId: item.candidateId,
      features: item.semanticInput as ModelSemanticFeatures,
    }));
    const before = scoreModelCandidates(artifact, candidates);
    const rewardedRoom = applyRewardLayer(findEligibleFixture(), { override: 'force' });
    const collected = awardResonance(0, false);
    const after = scoreModelCandidates(artifact, candidates);

    expect(getResonanceCaches(rewardedRoom.roomSnapshot)).toHaveLength(1);
    expect(collected).toEqual({ resonance: 1, awarded: true });
    expect(after.status).toBe('success');
    expect(before.status).toBe('success');
    if (before.status !== 'success' || after.status !== 'success')
      throw new Error('Development model fixture did not score successfully.');
    expect(after.predictions).toEqual(before.predictions);
    expect(after.preferredCandidateId).toBe(before.preferredCandidateId);
  });
});
