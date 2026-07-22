import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from '../config/topology';
import type { AdaptiveProfile } from '../types/adaptation';
import type { GeneratedRoomSave, GenerationRequest } from '../types/generation';
import type { ExitDirection } from '../types/rooms';
import { getResonanceCaches } from './interactions';
import { generateArchetypeRoomV3 } from './generatedRoomGeneratorV3';
import { applyRewardLayer } from './rewardGeneration';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';

const directions: ExitDirection[] = ['north', 'east', 'south', 'west'];
const profile: AdaptiveProfile = {
  pace: 0.5,
  caution: 0.5,
  aggression: 0.5,
  hazardTolerance: 0.5,
  exploration: 0.5,
};

function selectedRooms(): GeneratedRoomSave[] {
  return ARCHETYPE_IDS.map((archetype, archetypeIndex) => {
    const entranceDirection = directions[archetypeIndex % directions.length]!;
    const directionIndex = archetypeIndex % directions.length;
    const request: GenerationRequest = {
      runSeed: `reward-stress-base-${archetype}-${entranceDirection}`,
      dungeonRoomNumber: 20,
      chosenExitId: `stress-${entranceDirection}`,
      entranceDirection,
      experiencePreset: 'dungeon-veteran',
      effectiveProfile: profile,
      mode: archetypeIndex % 2 === 0 ? 'reinforce' : 'poke',
      generatorVersion: 'generator-3',
      adaptationVersion: 'rules-2',
      gameVersion: 'mvp-0.3',
      recovery:
        (archetypeIndex + directionIndex) % 2 === 0
          ? {
              currentHealth: 2,
              maximumHealth: 6,
              recentGeneratedDamage: [1, 1, 1],
              damageStreak: 3,
              roomsSinceLastGeneratedSpawn: 8,
              roomsSinceLastUse: 8,
              previousSkipped: false,
              recentCombatPressure: 3,
              cooldownRemaining: 0,
              placementOverride: 'force',
            }
          : undefined,
    };
    const generated = generateArchetypeRoomV3(request, archetype);
    return {
      ...generated,
      schemaVersion: 2,
      generatorVersion: 'generator-4',
      gameVersion: 'mvp-0.5',
      details: {
        ...generated.details,
        generatorVersion: 'generator-4',
        selectedCandidateId: `reward-stress-${archetype}-${entranceDirection}`,
        selectorId: 'rules-adaptive',
        selectorVersion: 'rules-selector-1',
        selectorProfileConsumed: true,
        fallbackUsed: false,
      },
    } satisfies GeneratedRoomSave;
  });
}

describe('rewards-1 deterministic selected-room stress', () => {
  it('evaluates 3,000 post-selection decisions across every archetype and entrance direction', () => {
    const rooms = selectedRooms();
    expect(new Set(rooms.map((room) => room.roomSnapshot.archetype))).toEqual(
      new Set(ARCHETYPE_IDS),
    );
    expect(new Set(rooms.map((room) => room.details.entranceDirection))).toEqual(
      new Set(directions),
    );

    let evaluated = 0;
    let enabled = 0;
    let spawned = 0;
    const reasons = new Set<string>();
    for (let index = 0; index < 3_000; index += 1) {
      const base = rooms[index % rooms.length]!;
      const selectorId = index % 2 === 0 ? 'rules-adaptive' : 'neutral-procedural';
      const selected: GeneratedRoomSave = {
        ...base,
        runSeed: `reward-stress-evaluation-${index}`,
        details: {
          ...base.details,
          selectorId,
          selectorVersion:
            selectorId === 'rules-adaptive' ? 'rules-selector-1' : 'neutral-selector-1',
          selectorProfileConsumed: selectorId === 'rules-adaptive',
        },
      };
      const phase = index % 250;
      const override = phase === 0 ? 'force' : phase === 1 ? undefined : 'disable';
      const result = applyRewardLayer(selected, override ? { override } : undefined);
      const caches = getResonanceCaches(result.roomSnapshot);
      evaluated += 1;
      if (result.details.rewardDecision?.enabled) enabled += 1;
      if (result.details.rewardDecision?.spawned) spawned += 1;
      reasons.add(result.details.rewardDecision?.spawnReason ?? 'not-applicable');

      if (override !== 'disable') expect(caches.length).toBeLessThanOrEqual(1);
      if (override !== 'disable' && caches.length > 0) {
        expect(validateGeneratedRoomV3(result.roomSnapshot)).toEqual({ valid: true, errors: [] });
        expect(caches[0]!.interactionTiles.length).toBeGreaterThan(0);
      }
      if (index % 500 === 0) {
        const repeated = applyRewardLayer(
          structuredClone(selected),
          override ? { override } : undefined,
        );
        expect(repeated.details.rewardDecision).toEqual(result.details.rewardDecision);
        expect(getResonanceCaches(repeated.roomSnapshot)).toEqual(caches);
      }
    }

    expect(evaluated).toBe(3_000);
    expect(enabled).toBe(24);
    expect(spawned).toBeGreaterThan(0);
    expect(reasons).toContain('sandbox-disabled');
    expect(reasons.has('sandbox-forced') || reasons.has('spawned')).toBe(true);
  }, 120_000);
});
