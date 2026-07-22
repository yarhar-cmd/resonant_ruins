import { RESONANCE_REWARD_CONFIG } from '../config/rewards';
import { VERSION_INFO } from '../config/version';
import type { GeneratedRoomSave } from '../types/generation';
import type {
  CachePlacementCategory,
  RewardDecision,
  RewardGenerationOverride,
  RewardPlacementCandidate,
} from '../types/rewards';
import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import type { ResonanceCacheFeature } from '../types/topology';
import { pathDistance } from './enemySystem';
import { coordinateKey, getBlockingFeatureLookup, getWallLookup } from './roomGeometry';
import { createSeededRandom, hashSeed } from './seededRandom';
import { cardinalNeighbors, findArticulationPoints, shortestPath } from './topologyAnalysis';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';

export interface RewardLayerOptions {
  enabled?: boolean;
  override?: RewardGenerationOverride;
  validator?: typeof validateGeneratedRoomV3;
}

function emptyDecision(reason: RewardDecision['spawnReason'], enabled: boolean): RewardDecision {
  return {
    rewardSystemVersion: VERSION_INFO.rewardSystemVersion,
    enabled,
    eligible: false,
    eligiblePlacementCount: 0,
    eligibilityReasons: [],
    bestPlacementScore: null,
    spawnChance: RESONANCE_REWARD_CONFIG.cacheSpawnChance,
    spawnRoll: null,
    spawned: false,
    spawnReason: reason,
    cacheId: null,
    coordinate: null,
    placementCategory: null,
    optionalRouteScore: null,
    interactionTiles: [],
  };
}

function distance(left: TileCoordinate, right: TileCoordinate): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function pathLength(
  room: RoomDefinition,
  from: TileCoordinate,
  to: TileCoordinate,
  blocked: ReadonlySet<string> = new Set(),
): number | null {
  const path = shortestPath(room, from, to, blocked);
  return path ? path.length - 1 : null;
}

function directSafeRoute(room: RoomDefinition, spawn: TileCoordinate): TileCoordinate[] | null {
  const hazards = new Set((room.hazards ?? []).map(coordinateKey));
  return (
    room.exits
      .map((exit) => shortestPath(room, spawn, exit.tile, hazards))
      .filter((path): path is TileCoordinate[] => Boolean(path))
      .sort(
        (left, right) =>
          left.length - right.length ||
          left.map(coordinateKey).join('|').localeCompare(right.map(coordinateKey).join('|')),
      )[0] ?? null
  );
}

function placementCategory(input: {
  room: RoomDefinition;
  degree: number;
  distanceFromDirectRoute: number;
  distanceFromEntrance: number;
}): CachePlacementCategory | null {
  if (input.degree <= 1) return 'optional-dead-end';
  if (
    (input.room.archetype === 'twin-chambers' || input.room.archetype === 'split-chamber') &&
    input.distanceFromDirectRoute >= 2
  )
    return 'side-chamber';
  if (
    input.degree === 2 &&
    input.distanceFromDirectRoute >= RESONANCE_REWARD_CONFIG.minimumDirectRouteDistance + 1
  )
    return 'optional-branch';
  if (input.degree === 2 && input.distanceFromDirectRoute >= 2) return 'alcove';
  if (input.room.archetype === 'open-arena') return null;
  if (input.distanceFromDirectRoute >= RESONANCE_REWARD_CONFIG.minimumDirectRouteDistance + 1)
    return 'longer-alternate-route';
  if (
    input.degree <= 2 &&
    input.distanceFromDirectRoute === RESONANCE_REWARD_CONFIG.minimumDirectRouteDistance - 1 &&
    input.distanceFromEntrance >= 7
  )
    return 'visible-detour';
  return null;
}

function candidateScore(input: {
  category: CachePlacementCategory;
  distanceFromEntrance: number;
  distanceFromDirectRoute: number;
  distanceFromNearestExit: number;
  interactionTileCount: number;
  roomSeed: string;
  coordinate: TileCoordinate;
}): number {
  const weight = RESONANCE_REWARD_CONFIG.categoryWeights[input.category];
  const stableTieBreak =
    (hashSeed(`${input.roomSeed}:reward-placement:${coordinateKey(input.coordinate)}`) % 1000) /
    1_000_000;
  return (
    weight +
    input.distanceFromDirectRoute * 4 +
    Math.min(12, input.distanceFromEntrance) +
    Math.min(8, input.distanceFromNearestExit) +
    Math.min(2, input.interactionTileCount) * 3 +
    stableTieBreak
  );
}

function createCacheFeature(
  save: GeneratedRoomSave,
  candidate: RewardPlacementCandidate,
  spawnRoll: number,
  forced: boolean,
): ResonanceCacheFeature {
  return {
    id: `${save.roomSnapshot.id}-resonance-cache`,
    kind: 'resonance-cache',
    tile: candidate.coordinate,
    blocking: true,
    rewardSystemVersion: VERSION_INFO.rewardSystemVersion,
    placementCategory: candidate.placementCategory,
    spawnedReason: forced ? 'sandbox-forced' : 'spawned',
    spawnRoll,
    interactionTiles: candidate.interactionTiles,
    optionalRouteScore: candidate.optionalRouteScore,
    visualVariant: 'ruined-stone-coffer',
  };
}

function trialRoom(
  save: GeneratedRoomSave,
  candidate: RewardPlacementCandidate,
  spawnRoll: number,
  forced: boolean,
): RoomDefinition {
  return {
    ...save.roomSnapshot,
    features: [
      ...(save.roomSnapshot.features ?? []),
      createCacheFeature(save, candidate, spawnRoll, forced),
    ],
  };
}

export function findRewardPlacementCandidates(save: GeneratedRoomSave): {
  meaningfulCount: number;
  candidates: RewardPlacementCandidate[];
} {
  const room = save.roomSnapshot;
  const entrance = room.entrance;
  const spawn = entrance ? room.spawnPoints?.[entrance.direction] : undefined;
  const directRoute = spawn ? directSafeRoute(room, spawn) : null;
  if (!spawn || !directRoute || room.archetype === 'safe-fallback')
    return { meaningfulCount: 0, candidates: [] };

  const floor = new Set(room.floorTiles.map(coordinateKey));
  const walls = getWallLookup(room);
  const blocking = getBlockingFeatureLookup(room);
  const hazards = new Set((room.hazards ?? []).map(coordinateKey));
  const rats = new Set((room.enemySpawns ?? []).map((rat) => coordinateKey(rat.tile)));
  const exits = new Set(room.exits.map((exit) => coordinateKey(exit.tile)));
  const direct = new Set(directRoute.map(coordinateKey));
  const articulationPoints = new Set(findArticulationPoints(room).map(coordinateKey));
  const occupied = new Set([...walls, ...blocking, ...hazards, ...rats, ...exits]);
  occupied.add(coordinateKey(spawn));
  if (entrance) occupied.add(coordinateKey(entrance.tile));

  const meaningful: RewardPlacementCandidate[] = [];
  for (const coordinate of room.floorTiles) {
    const key = coordinateKey(coordinate);
    if (occupied.has(key) || direct.has(key) || articulationPoints.has(key)) continue;
    const distanceFromEntrance = pathLength(room, spawn, coordinate);
    if (
      distanceFromEntrance === null ||
      distanceFromEntrance < RESONANCE_REWARD_CONFIG.minimumEntranceDistance
    )
      continue;
    const exitDistances = room.exits
      .map((exit) => pathLength(room, coordinate, exit.tile))
      .filter((value): value is number => value !== null);
    const distanceFromNearestExit = exitDistances.length ? Math.min(...exitDistances) : 0;
    if (distanceFromNearestExit < RESONANCE_REWARD_CONFIG.minimumExitDistance) continue;
    const distanceFromDirectRoute = Math.min(
      ...directRoute.map((tile) => distance(tile, coordinate)),
    );
    const openNeighbors = cardinalNeighbors(coordinate).filter((tile) => {
      const neighborKey = coordinateKey(tile);
      return floor.has(neighborKey) && !walls.has(neighborKey) && !blocking.has(neighborKey);
    });
    const category = placementCategory({
      room,
      degree: openNeighbors.length,
      distanceFromDirectRoute,
      distanceFromEntrance,
    });
    if (!category) continue;
    const blockedForApproach = new Set([...hazards, key]);
    const interactionTiles = openNeighbors
      .filter((tile) => !hazards.has(coordinateKey(tile)))
      .filter((tile) => shortestPath(room, spawn, tile, blockedForApproach))
      .sort((left, right) => {
        const leftLength = pathLength(room, spawn, left, blockedForApproach) ?? Infinity;
        const rightLength = pathLength(room, spawn, right, blockedForApproach) ?? Infinity;
        return leftLength - rightLength || left.y - right.y || left.x - right.x;
      });
    if (!interactionTiles.length) continue;
    const optionalRouteScore = candidateScore({
      category,
      distanceFromEntrance,
      distanceFromDirectRoute,
      distanceFromNearestExit,
      interactionTileCount: interactionTiles.length,
      roomSeed: save.roomSeed,
      coordinate,
    });
    meaningful.push({
      coordinate,
      placementCategory: category,
      optionalRouteScore,
      distanceFromEntrance,
      distanceFromDirectRoute,
      distanceFromNearestExit,
      interactionTiles: interactionTiles.slice(
        0,
        RESONANCE_REWARD_CONFIG.preferredInteractionTileCount,
      ),
    });
  }

  const spawnRoll = createSeededRandom(
    `${save.runSeed}:${save.dungeonRoomNumber}:${save.details.selectedCandidateId ?? room.id}:${VERSION_INFO.rewardSystemVersion}`,
  )();
  const valid = meaningful.filter((candidate) => {
    const trial = trialRoom(save, candidate, spawnRoll, false);
    const safeBlocked = new Set((trial.hazards ?? []).map(coordinateKey));
    if (!trial.exits.every((exit) => shortestPath(trial, spawn, exit.tile, safeBlocked)))
      return false;
    return (trial.enemySpawns ?? []).every((rat) => pathDistance(trial, rat.tile, spawn) !== null);
  });
  return {
    meaningfulCount: meaningful.length,
    candidates: valid.sort(
      (left, right) =>
        right.optionalRouteScore - left.optionalRouteScore ||
        left.coordinate.y - right.coordinate.y ||
        left.coordinate.x - right.coordinate.x,
    ),
  };
}

export function applyRewardLayer(
  selected: GeneratedRoomSave,
  options: RewardLayerOptions = {},
): GeneratedRoomSave {
  const enabled = options.enabled ?? true;
  if (!enabled || options.override === 'disable') {
    return {
      ...selected,
      schemaVersion: 3,
      details: {
        ...selected.details,
        rewardDecision: emptyDecision('sandbox-disabled', false),
      },
    };
  }
  if (selected.generatorVersion !== 'generator-4') return selected;
  if (selected.roomSnapshot.phase !== 'dungeon') {
    return {
      ...selected,
      schemaVersion: 3,
      details: { ...selected.details, rewardDecision: emptyDecision('authored-room', true) },
    };
  }
  if (selected.details.fallbackUsed || selected.roomSnapshot.archetype === 'safe-fallback') {
    return {
      ...selected,
      schemaVersion: 3,
      details: {
        ...selected.details,
        rewardDecision: emptyDecision('fallback-suppressed', true),
      },
    };
  }

  const rewardSeed = `${selected.runSeed}:${selected.dungeonRoomNumber}:${selected.details.selectedCandidateId ?? selected.roomSnapshot.id}:${VERSION_INFO.rewardSystemVersion}`;
  const spawnRoll = createSeededRandom(rewardSeed)();
  const placements = findRewardPlacementCandidates(selected);
  if (!placements.meaningfulCount) {
    return {
      ...selected,
      schemaVersion: 3,
      details: {
        ...selected.details,
        rewardDecision: {
          ...emptyDecision('ineligible-no-optional-route', true),
          eligibilityReasons: ['no-meaningful-optional-route'],
        },
      },
    };
  }
  if (!placements.candidates.length) {
    return {
      ...selected,
      schemaVersion: 3,
      details: {
        ...selected.details,
        rewardDecision: {
          ...emptyDecision('no-valid-placement', true),
          eligibilityReasons: ['optional-route-found', 'placement-validation-failed'],
        },
      },
    };
  }

  const eligibleDecision: RewardDecision = {
    ...emptyDecision('roll-failed', true),
    eligible: true,
    eligiblePlacementCount: placements.candidates.length,
    eligibilityReasons: ['meaningful-optional-route', 'validated-solid-placement'],
    bestPlacementScore: placements.candidates[0]!.optionalRouteScore,
    spawnRoll,
  };
  const forced = options.override === 'force';
  if (!forced && spawnRoll >= RESONANCE_REWARD_CONFIG.cacheSpawnChance) {
    return {
      ...selected,
      schemaVersion: 3,
      details: { ...selected.details, rewardDecision: eligibleDecision },
    };
  }

  const chosen = placements.candidates[0]!;
  const cache = createCacheFeature(selected, chosen, spawnRoll, forced);
  const roomSnapshot: RoomDefinition = {
    ...selected.roomSnapshot,
    features: [...(selected.roomSnapshot.features ?? []), cache],
  };
  const validation = (options.validator ?? validateGeneratedRoomV3)(roomSnapshot);
  if (!validation.valid) {
    return {
      ...selected,
      schemaVersion: 3,
      details: {
        ...selected.details,
        rewardDecision: { ...eligibleDecision, spawnReason: 'invalid-after-validation' },
      },
    };
  }
  return {
    ...selected,
    schemaVersion: 3,
    roomSnapshot,
    details: {
      ...selected.details,
      rewardDecision: {
        ...eligibleDecision,
        spawned: true,
        spawnReason: forced ? 'sandbox-forced' : 'spawned',
        cacheId: cache.id,
        coordinate: cache.tile,
        placementCategory: cache.placementCategory,
        optionalRouteScore: cache.optionalRouteScore,
        interactionTiles: cache.interactionTiles,
      },
    },
  };
}
