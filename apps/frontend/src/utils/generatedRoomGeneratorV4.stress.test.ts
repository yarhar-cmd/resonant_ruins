import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from '../config/topology';
import { EXPERIENCE_PRESET_IDS, type AdaptiveProfile } from '../types/adaptation';
import type { ExitDirection, RoomDefinition } from '../types/rooms';
import type { GenerationRequest } from '../types/generation';
import { buildSharedCandidatePoolV4, generateDungeonRoomV4 } from './generatedRoomGeneratorV4';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';

const directions: ExitDirection[] = ['north', 'east', 'south', 'west'];
const profiles: AdaptiveProfile[] = [
  { pace: 0.5, caution: 0.5, aggression: 0.5, hazardTolerance: 0.5, exploration: 0.5 },
  { pace: 1, caution: 0, aggression: 1, hazardTolerance: 1, exploration: 0 },
  { pace: 0, caution: 1, aggression: 0, hazardTolerance: 0, exploration: 1 },
];

function request(index: number, selectorId: GenerationRequest['selectorId']): GenerationRequest {
  const recoveryCase = index % 4;
  return {
    runSeed: `generator-4-stress-${index}`,
    dungeonRoomNumber: 10,
    chosenExitId: `chosen-exit-${index}`,
    entranceDirection: directions[index % directions.length]!,
    experiencePreset: EXPERIENCE_PRESET_IDS[index % EXPERIENCE_PRESET_IDS.length]!,
    effectiveProfile: profiles[index % profiles.length]!,
    mode: index % 2 === 0 ? 'reinforce' : 'poke',
    generatorVersion: 'generator-4',
    gameVersion: 'mvp-0.4',
    adaptationVersion: 'rules-2',
    selectorId,
    recovery: {
      currentHealth: recoveryCase === 0 ? 1 : 4,
      maximumHealth: 4,
      recentGeneratedDamage: recoveryCase === 1 ? [1, 1, 0] : [0, 0, 0],
      damageStreak: recoveryCase === 1 ? 2 : 0,
      roomsSinceLastGeneratedSpawn: recoveryCase === 2 ? 0 : 6,
      roomsSinceLastUse: recoveryCase === 2 ? 0 : 6,
      previousSkipped: recoveryCase === 3,
      recentCombatPressure: recoveryCase === 1 ? 2 : 0,
      cooldownRemaining: recoveryCase === 2 ? 2 : 0,
      placementOverride: recoveryCase === 3 ? 'disable' : 'force',
    },
  };
}

function roomEvidence(room: RoomDefinition): string {
  return JSON.stringify({
    floor: room.floorTiles,
    walls: [room.outerWallTiles, room.internalWallTiles],
    exits: room.exits,
    hazards: room.hazards,
    enemies: room.enemySpawns,
    features: room.features,
  });
}

describe('generator-4 stress verification', () => {
  for (let batch = 0; batch < 6; batch += 1) {
    it(`validates shared-pool condition pairs ${batch * 40 + 1}-${(batch + 1) * 40}`, async () => {
      const seenArchetypes = new Set<string>();
      let sawMultipleExits = false;
      let sawFountain = false;
      let sawNoFountain = false;
      for (let offset = 0; offset < 40; offset += 1) {
        const index = batch * 40 + offset;
        const adaptiveRequest = request(index, 'rules-adaptive');
        const neutralRequest = request(index, 'neutral-procedural');
        const adaptivePool = buildSharedCandidatePoolV4(adaptiveRequest);
        const neutralPool = buildSharedCandidatePoolV4(neutralRequest);
        expect(neutralPool.poolId, adaptivePool.roomSeed).toBe(adaptivePool.poolId);
        expect(neutralPool.candidates, adaptivePool.poolId).toEqual(adaptivePool.candidates);
        expect(neutralPool.rejectionCounts, adaptivePool.poolId).toEqual(
          adaptivePool.rejectionCounts,
        );
        for (const candidate of adaptivePool.candidates) {
          seenArchetypes.add(candidate.archetype);
          const validation = validateGeneratedRoomV3(candidate.save.roomSnapshot);
          expect(validation.errors, `${adaptivePool.poolId}:${candidate.id}`).toEqual([]);
          expect(JSON.parse(JSON.stringify(candidate.save))).toEqual(candidate.save);
          expect(roomEvidence(candidate.save.roomSnapshot)).toBe(
            roomEvidence(
              neutralPool.candidates.find((other) => other.id === candidate.id)!.save.roomSnapshot,
            ),
          );
          sawMultipleExits ||= candidate.save.roomSnapshot.exits.length > 1;
          const hasFountain = (candidate.save.roomSnapshot.features ?? []).some(
            (feature) => feature.kind === 'restoration-fountain',
          );
          sawFountain ||= hasFountain;
          sawNoFountain ||= !hasFountain;
        }
        const adaptive = generateDungeonRoomV4(adaptiveRequest);
        const neutral = generateDungeonRoomV4(neutralRequest);
        expect(adaptive.details.sharedPoolId).toBe(neutral.details.sharedPoolId);
        expect(validateGeneratedRoomV3(adaptive.roomSnapshot).valid).toBe(true);
        expect(validateGeneratedRoomV3(neutral.roomSnapshot).valid).toBe(true);
        if (offset % 5 === 4) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      expect(seenArchetypes).toEqual(new Set(ARCHETYPE_IDS));
      expect(sawMultipleExits).toBe(true);
      expect(sawFountain).toBe(true);
      expect(sawNoFountain).toBe(true);
    }, 180_000);
  }
});
