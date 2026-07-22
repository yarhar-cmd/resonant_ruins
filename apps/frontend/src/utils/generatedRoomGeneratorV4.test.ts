import { describe, expect, it } from 'vitest';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import { GENERATED_ROOM_SAVE_SCHEMA_VERSION, type GenerationRequest } from '../types/generation';
import { generateDungeonRoom } from './generatedRoomGenerator';
import { buildSharedCandidatePoolV4, generateDungeonRoomV4 } from './generatedRoomGeneratorV4';
import { selectNeutralRoom } from './neutralRoomSelector';
import { selectRuleBasedRoom } from './ruleBasedRoomSelector';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';

function request(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    runSeed: 'generator-4-shared-pool-test',
    dungeonRoomNumber: 10,
    chosenExitId: 'east-exit',
    entranceDirection: 'west',
    experiencePreset: 'dungeon-veteran',
    effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
    mode: 'reinforce',
    generatorVersion: 'generator-4',
    adaptationVersion: 'rules-2',
    gameVersion: 'mvp-0.4',
    recovery: {
      currentHealth: 2,
      maximumHealth: 4,
      recentGeneratedDamage: [1, 0, 1],
      damageStreak: 1,
      roomsSinceLastGeneratedSpawn: 4,
      roomsSinceLastUse: 4,
      previousSkipped: false,
      recentCombatPressure: 1,
      cooldownRemaining: 0,
    },
    ...overrides,
  };
}

const extremeProfile = {
  pace: 1,
  caution: 0,
  aggression: 1,
  hazardTolerance: 1,
  exploration: 0,
};

describe('generator-4 shared candidate pools', () => {
  it('declares generated-room schema 2 while keeping frozen generator provenance', () => {
    expect(GENERATED_ROOM_SAVE_SCHEMA_VERSION).toBe(2);
    expect(
      generateDungeonRoom(
        request({
          generatorVersion: 'generator-2',
          gameVersion: 'mvp-0.2',
          adaptationVersion: 'rules-1',
        }),
      ),
    ).toMatchObject({ generatorVersion: 'generator-2', gameVersion: 'mvp-0.2' });
    expect(
      generateDungeonRoom(request({ generatorVersion: 'generator-3', gameVersion: 'mvp-0.3' })),
    ).toMatchObject({ generatorVersion: 'generator-3', gameVersion: 'mvp-0.3' });
    const current = generateDungeonRoomV4(request());
    expect(current.schemaVersion).toBe(2);
    expect(current.generatorVersion).toBe('generator-4');
    expect(current.gameVersion).toBe('mvp-0.5');
  });

  it('keeps candidate construction identical when only behavioral traits or condition change', () => {
    const adaptivePool = buildSharedCandidatePoolV4(
      request({ effectiveProfile: extremeProfile, selectorId: 'rules-adaptive', mode: 'poke' }),
    );
    const neutralPool = buildSharedCandidatePoolV4(
      request({
        effectiveProfile: { ...NEUTRAL_ADAPTIVE_PROFILE },
        selectorId: 'neutral-procedural',
        mode: 'reinforce',
      }),
    );
    expect(adaptivePool.poolId).toBe(neutralPool.poolId);
    expect(adaptivePool.candidates).toEqual(neutralPool.candidates);
    expect(adaptivePool.rejectionCounts).toEqual(neutralPool.rejectionCounts);
  });

  it('passes the same pool ID to adaptive and neutral selectors', () => {
    const pool = buildSharedCandidatePoolV4(request());
    const adaptive = selectRuleBasedRoom(pool.candidates, {
      sharedPoolId: pool.poolId,
      selectionSeed: pool.roomSeed,
      profile: extremeProfile,
      mode: 'reinforce',
    });
    const neutral = selectNeutralRoom(pool.candidates, {
      sharedPoolId: pool.poolId,
      selectionSeed: pool.roomSeed,
    });
    expect(adaptive.sharedPoolId).toBe(pool.poolId);
    expect(neutral.sharedPoolId).toBe(pool.poolId);
    expect(adaptive.candidateCount).toBe(neutral.candidateCount);
    expect(adaptive.profileConsumed).toBe(true);
    expect(neutral.profileConsumed).toBe(false);
  });

  it('changes adaptive scoring with profile while neutral selection remains deterministic', () => {
    const pool = buildSharedCandidatePoolV4(request());
    const low = selectRuleBasedRoom(pool.candidates, {
      sharedPoolId: pool.poolId,
      selectionSeed: pool.roomSeed,
      profile: { pace: 0, caution: 1, aggression: 0, hazardTolerance: 0, exploration: 0 },
      mode: 'reinforce',
    });
    const high = selectRuleBasedRoom(pool.candidates, {
      sharedPoolId: pool.poolId,
      selectionSeed: pool.roomSeed,
      profile: extremeProfile,
      mode: 'reinforce',
    });
    expect(low.topCandidates.map((candidate) => candidate.score)).not.toEqual(
      high.topCandidates.map((candidate) => candidate.score),
    );
    const neutralContext = { sharedPoolId: pool.poolId, selectionSeed: pool.roomSeed };
    expect(selectNeutralRoom(pool.candidates, neutralContext)).toEqual(
      selectNeutralRoom(pool.candidates, neutralContext),
    );
  });

  it('records selector and shared-pool evidence without weakening validation', () => {
    const adaptive = generateDungeonRoomV4(request({ selectorId: 'rules-adaptive' }));
    const neutral = generateDungeonRoomV4(request({ selectorId: 'neutral-procedural' }));
    expect(adaptive.details.sharedPoolId).toBe(neutral.details.sharedPoolId);
    expect(adaptive.details.selectorId).toBe('rules-adaptive');
    expect(neutral.details.selectorId).toBe('neutral-procedural');
    expect(adaptive.details.selectorVersion).toBe('rules-selector-1');
    expect(neutral.details.selectorVersion).toBe('neutral-selector-1');
    expect(adaptive.details.selectorProfileConsumed).toBe(true);
    expect(neutral.details.selectorProfileConsumed).toBe(false);
    expect(validateGeneratedRoomV3(adaptive.roomSnapshot).valid).toBe(true);
    expect(validateGeneratedRoomV3(neutral.roomSnapshot).valid).toBe(true);
  });

  it('keeps active selection byte-identical when shadow is absent, enabled, or throws', () => {
    const absent = generateDungeonRoomV4(request({ selectorId: 'rules-adaptive' }));
    let observedPoolId = '';
    const enabled = generateDungeonRoomV4(
      request({ selectorId: 'rules-adaptive' }),
      undefined,
      (observation) => {
        observedPoolId = observation.sharedPoolId;
        expect(observation.candidates).toHaveLength(10);
      },
    );
    const failed = generateDungeonRoomV4(
      request({ selectorId: 'rules-adaptive' }),
      undefined,
      () => {
        throw new Error('synthetic shadow failure');
      },
    );
    expect(observedPoolId).toBe(absent.details.sharedPoolId);
    expect(enabled).toEqual(absent);
    expect(failed).toEqual(absent);
  });

  it('preserves Fountain opportunity equality across conditions', () => {
    const adaptive = buildSharedCandidatePoolV4(request({ selectorId: 'rules-adaptive' }));
    const neutral = buildSharedCandidatePoolV4(request({ selectorId: 'neutral-procedural' }));
    const fountains = (pool: typeof adaptive) =>
      pool.candidates.map((candidate) =>
        (candidate.save.roomSnapshot.features ?? [])
          .filter((feature) => feature.kind === 'restoration-fountain')
          .map((feature) => ({ id: feature.id, tile: feature.tile })),
      );
    expect(fountains(adaptive)).toEqual(fountains(neutral));
  });

  it('records reduced diversity and deterministic fallback without weakening safety', () => {
    let accepted = 0;
    const reducedPool = buildSharedCandidatePoolV4(request(), (room) => {
      const base = validateGeneratedRoomV3(room);
      if (!base.valid) return base;
      accepted += 1;
      return accepted <= 2 ? base : { valid: false, errors: ['test-reduced-diversity'] };
    });
    let selectedAccepted = 0;
    const reduced = generateDungeonRoomV4(request(), (room) => {
      const base = validateGeneratedRoomV3(room);
      if (!base.valid) return base;
      selectedAccepted += 1;
      return selectedAccepted <= 2 ? base : { valid: false, errors: ['test-reduced-diversity'] };
    });
    expect(reducedPool.candidates.length).toBe(2);
    expect(reduced.details.reducedDiversity).toBe(true);

    const rejected = () => ({ valid: false, errors: ['test-forced-rejection'] });
    const fallbackPool = buildSharedCandidatePoolV4(request(), rejected);
    const fallback = generateDungeonRoomV4(request(), rejected);
    expect(fallbackPool.fallbackUsed).toBe(true);
    expect(fallbackPool.candidates).toHaveLength(1);
    expect(fallback.details.fallbackUsed).toBe(true);
    expect(fallback.details.mode).toBe('fallback');
    expect(validateGeneratedRoomV3(fallback.roomSnapshot).valid).toBe(true);
  });
});
