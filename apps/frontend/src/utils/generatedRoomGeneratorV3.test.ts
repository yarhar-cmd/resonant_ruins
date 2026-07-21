import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS, TOPOLOGY_CONFIG } from '../config/topology';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import type { GenerationRequest } from '../types/generation';
import type { ExitDirection } from '../types/rooms';
import { coordinateKey, isWalkableCoordinate } from './roomGeometry';
import { findRatPath, playerStaticEscapeTiles } from './enemySystem';
import { createRules2Profile, scoreRoomFeatureVector } from './roomSelector';
import {
  generateArchetypeRoomV3,
  generateDungeonRoomV3,
  oppositeExitDirectionV3,
} from './generatedRoomGeneratorV3';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';
import { getRestorationFountains } from './interactions';

function request(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    runSeed: 'generator-3-test',
    dungeonRoomNumber: 10,
    chosenExitId: 'east-exit',
    entranceDirection: 'west',
    experiencePreset: 'dungeon-veteran',
    effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
    mode: 'reinforce',
    generatorVersion: 'generator-3',
    adaptationVersion: 'rules-2',
    gameVersion: 'mvp-0.3',
    ...overrides,
  };
}

describe('generator-3 topology and directional rooms', () => {
  it('supports all opposite-direction transitions', () => {
    expect(
      (['north', 'east', 'south', 'west'] as ExitDirection[]).map(oppositeExitDirectionV3),
    ).toEqual(['south', 'west', 'north', 'east']);
    for (const exitDirection of ['north', 'east', 'south', 'west'] as ExitDirection[]) {
      const nextEntrance = oppositeExitDirectionV3(exitDirection);
      const next = generateArchetypeRoomV3(
        request({ entranceDirection: nextEntrance, chosenExitId: `${exitDirection}-exit` }),
        'open-arena',
      );
      expect(next.roomSnapshot.entrance?.direction).toBe(nextEntrance);
    }
  });

  it('generates every archetype deterministically with valid layered topology', () => {
    for (const archetype of ARCHETYPE_IDS) {
      const generated = generateArchetypeRoomV3(request(), archetype);
      expect(generated).toEqual(generateArchetypeRoomV3(request(), archetype));
      expect(generated.roomSnapshot.archetype).toBe(archetype);
      expect(generated.roomSnapshot.outerWallTiles?.length).toBeGreaterThan(0);
      expect(validateGeneratedRoomV3(generated.roomSnapshot).errors).toEqual([]);
    }
  });

  it('places True L-Ruin exits on the actual reachable L boundary rather than void walls', () => {
    const room = generateArchetypeRoomV3(request(), 'true-l-ruin').roomSnapshot;
    const floor = new Set(room.floorTiles.map(coordinateKey));
    const inward: Record<ExitDirection, { x: number; y: number }> = {
      north: { x: 0, y: 1 },
      south: { x: 0, y: -1 },
      east: { x: -1, y: 0 },
      west: { x: 1, y: 0 },
    };
    expect(room.boundaryFamily).toBe('true-l');
    for (const exit of room.exits) {
      const offset = inward[exit.direction];
      expect(
        floor.has(coordinateKey({ x: exit.tile.x + offset.x, y: exit.tile.y + offset.y })),
      ).toBe(true);
      expect(
        floor.has(coordinateKey({ x: exit.tile.x - offset.x, y: exit.tile.y - offset.y })),
      ).toBe(false);
    }
  });

  it('uses distinct reachable directions for multiple exits and preserves safe routes', () => {
    const generated = generateDungeonRoomV3(
      request({ effectiveProfile: { ...NEUTRAL_ADAPTIVE_PROFILE, exploration: 0.95, pace: 0.2 } }),
    );
    const directions = generated.roomSnapshot.exits.map((exit) => exit.direction);
    expect(directions.length).toBe(3);
    expect(new Set(directions).size).toBe(directions.length);
    expect(generated.roomSnapshot.topology?.safeRouteExists).toBe(true);
    expect(generated.details.exitDecisions?.every((exit) => exit.pathDistance >= 0)).toBe(true);
  });

  it('routes Rats around internal structures while preserving player escape analysis', () => {
    const room = generateArchetypeRoomV3(request(), 'ring-route').roomSnapshot;
    const spawn = room.spawnPoints?.[room.entrance!.direction];
    const rat = room.enemySpawns?.[0]?.tile ?? room.floorTiles.at(-1);
    expect(spawn).toBeDefined();
    expect(rat).toBeDefined();
    const path = findRatPath(room, rat!, spawn!);
    const walls = new Set((room.internalWallTiles ?? []).map(coordinateKey));
    expect(path).not.toBeNull();
    expect(path?.some((tile) => walls.has(coordinateKey(tile)))).toBe(false);
    expect(playerStaticEscapeTiles(room, spawn!).length).toBeGreaterThanOrEqual(2);
  });

  it('places at most one deterministic solid Fountain without breaking routes', () => {
    const input = request({
      runSeed: 'forced-fountain',
      recovery: {
        currentHealth: 1,
        maximumHealth: 4,
        recentGeneratedDamage: [1, 1],
        damageStreak: 2,
        roomsSinceLastGeneratedSpawn: 5,
        roomsSinceLastUse: 5,
        previousSkipped: false,
        recentCombatPressure: 2,
        cooldownRemaining: 0,
        placementOverride: 'force',
        placementPreference: 'safe',
      },
    });
    const generated = generateArchetypeRoomV3(input, 'pillar-hall');
    const repeat = generateArchetypeRoomV3(input, 'pillar-hall');
    const fountains = getRestorationFountains(generated.roomSnapshot);
    expect(generated).toEqual(repeat);
    expect(fountains).toHaveLength(1);
    expect(fountains[0]?.blocking).toBe(true);
    expect(fountains[0]?.interactionTiles.length).toBeGreaterThan(0);
    expect(validateGeneratedRoomV3(generated.roomSnapshot).valid).toBe(true);
    expect(generated.roomSnapshot.topology?.safeRouteExists).toBe(true);
    expect(isWalkableCoordinate(generated.roomSnapshot, fountains[0]!.tile)).toBe(false);
    const spawn = generated.roomSnapshot.spawnPoints?.[input.entranceDirection];
    expect(spawn).toBeDefined();
    for (const rat of generated.roomSnapshot.enemySpawns ?? []) {
      const path = findRatPath(generated.roomSnapshot, rat.tile, spawn!);
      expect(path).not.toBeNull();
      expect(path?.some((tile) => coordinateKey(tile) === coordinateKey(fountains[0]!.tile))).toBe(
        false,
      );
    }
  });

  it('selects from one or two candidates without fallback and records reduced diversity', () => {
    let calls = 0;
    const generated = generateDungeonRoomV3(request(), () => {
      calls += 1;
      return calls <= 2
        ? { valid: true, errors: [] }
        : { valid: false, errors: ['forced-rejection'] };
    });
    expect(calls).toBe(TOPOLOGY_CONFIG.maximumGenerationAttempts);
    expect(generated.details.validCandidateCount).toBe(2);
    expect(generated.details.reducedDiversity).toBe(true);
    expect(generated.details.fallbackUsed).toBe(false);
    expect(generated.details.topCandidates).toHaveLength(2);
  });

  it('uses fallback only when no candidate validates', () => {
    const generated = generateDungeonRoomV3(request(), () => ({
      valid: false,
      errors: ['forced'],
    }));
    expect(generated.details.validCandidateCount).toBe(0);
    expect(generated.details.fallbackUsed).toBe(true);
    expect(generated.roomSnapshot.archetype).toBe('safe-fallback');
    expect(validateGeneratedRoomV3(generated.roomSnapshot).valid).toBe(true);
  });

  it('keeps rules-2 scoring independent of depth after content is unlocked', () => {
    const room = generateArchetypeRoomV3(request(), 'ring-route');
    const feature = {
      ...room.details.topCandidates?.[0]?.featureVector,
      schemaVersion: 1 as const,
      archetype: 'ring-route' as const,
      boundaryFamily: room.roomSnapshot.boundaryFamily!,
      width: room.roomSnapshot.width,
      height: room.roomSnapshot.height,
      floorArea: room.roomSnapshot.topology!.floorArea,
      floorRatio: room.roomSnapshot.topology!.floorRatio,
      internalWallCoverage: room.roomSnapshot.topology!.internalWallCoverage,
      openFloorPercentage: room.roomSnapshot.topology!.openFloorPercentage,
      shortestExitDistance: 10,
      safePathDistance: 10,
      directnessRatio: 1,
      exitCount: room.roomSnapshot.exits.length,
      directionalExitCount: new Set(room.roomSnapshot.exits.map((exit) => exit.direction)).size,
      loopCount: room.roomSnapshot.topology!.loopCount,
      branchCount: room.roomSnapshot.topology!.branchCount,
      articulationPointCount: room.roomSnapshot.topology!.articulationPointCount,
      oneTileChokepointCount: room.roomSnapshot.topology!.oneTileChokepointCount,
      deadEndCount: room.roomSnapshot.topology!.deadEndCount,
      maximumDeadEndLength: room.roomSnapshot.topology!.maximumDeadEndLength,
      largestCombatArea: room.roomSnapshot.topology!.largestCombatArea,
      entranceClearArea: room.roomSnapshot.topology!.entranceClearArea,
      runeCount: 1,
      runeDensity: 0.01,
      ratCount: 1,
      averageRatSpawnDistance: 8,
      contentUnlockLevel: 6,
      fallbackUsed: false,
    };
    const scoreAtDepth10 = scoreRoomFeatureVector(feature, NEUTRAL_ADAPTIVE_PROFILE);
    const scoreAtDepth100 = scoreRoomFeatureVector(
      { ...feature, contentUnlockLevel: feature.contentUnlockLevel },
      NEUTRAL_ADAPTIVE_PROFILE,
    );
    expect(scoreAtDepth100).toBe(scoreAtDepth10);
  });

  it('applies bounded seeded poke contrast to one or two traits', () => {
    const input = {
      pace: 0.9,
      caution: 0.1,
      aggression: 0.8,
      hazardTolerance: 0.2,
      exploration: 0.7,
    };
    const result = createRules2Profile(input, 'poke', 'poke-seed');
    expect(result.challengedTraits.length).toBeGreaterThanOrEqual(1);
    expect(result.challengedTraits.length).toBeLessThanOrEqual(2);
    for (const trait of result.challengedTraits) {
      expect(Math.abs(result.profile[trait] - input[trait])).toBeLessThanOrEqual(0.4);
    }
    expect(result).toEqual(createRules2Profile(input, 'poke', 'poke-seed'));
  });
});
