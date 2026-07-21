import { ARCHETYPE_IDS, ARCHETYPE_UNLOCK_ROOM, TOPOLOGY_CONFIG } from '../config/topology';
import { VERSION_INFO } from '../config/version';
import type {
  DirectionalExitDecision,
  GeneratedRoomSave,
  GenerationRequest,
  RoomCandidateSummary,
} from '../types/generation';
import type { AdaptiveProfile } from '../types/adaptation';
import type { GeneratorVersion } from '../config/version';
import type { ExitDirection, RoomDefinition, RoomExit, TileCoordinate } from '../types/rooms';
import {
  ROOM_FEATURE_SCHEMA_VERSION,
  ROOM_FEATURE_VECTOR_SCHEMA_VERSION,
  type BoundaryFamily,
  type RoomArchetype,
  type RoomFeatureVector,
  type RestorationFountainFeature,
} from '../types/topology';
import { pathDistance, selectGeneratedRatSpawns } from './enemySystem';
import { coordinateKey, getWallLookup } from './roomGeometry';
import { createRecoveryDecision } from './recoverySelection';
import { createRules2Profile, scoreRoomFeatureVector, selectRankedCandidate } from './roomSelector';
import { createSeededRandom, randomInteger, shuffleSeeded } from './seededRandom';
import {
  analyzeRoomTopology,
  cardinalNeighbors,
  deriveOuterWalls,
  shortestPath,
} from './topologyAnalysis';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';

const offsets: Record<ExitDirection, TileCoordinate> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

export function oppositeExitDirectionV3(direction: ExitDirection): ExitDirection {
  return { north: 'south', south: 'north', east: 'west', west: 'east' }[direction] as ExitDirection;
}

export function deriveRoomSeedV3(request: GenerationRequest): string {
  return `${request.runSeed}:${request.dungeonRoomNumber}:${request.chosenExitId}:${request.adaptationVersion ?? 'rules-2'}:generator-3`;
}

function rectangle(width: number, height: number): TileCoordinate[] {
  const result: TileCoordinate[] = [];
  for (let y = 1; y < height - 1; y += 1)
    for (let x = 1; x < width - 1; x += 1) result.push({ x, y });
  return result;
}

function floorForArchetype(
  archetype: RoomArchetype,
  width: number,
  height: number,
): { floor: TileCoordinate[]; internal: TileCoordinate[]; boundary: BoundaryFamily } {
  let floor = rectangle(width, height);
  let internal: TileCoordinate[] = [];
  let boundary: BoundaryFamily = 'rectangle';
  if (archetype === 'true-l-ruin') {
    const cutX = Math.floor(width * 0.55);
    const cutY = Math.floor(height * 0.45);
    floor = floor.filter((tile) => !(tile.x >= cutX && tile.y <= cutY));
    boundary = 'true-l';
  } else if (archetype === 'twin-chambers') {
    const middle = Math.floor(width / 2);
    const passageY = Math.floor(height / 2);
    floor = floor.filter(
      (tile) => tile.x <= middle - 2 || tile.x >= middle + 2 || Math.abs(tile.y - passageY) <= 1,
    );
    boundary = 'connected-chambers';
  } else if (archetype === 'split-chamber') {
    const x = Math.floor(width / 2);
    const gaps = new Set([Math.floor(height / 3), Math.floor((height * 2) / 3)]);
    internal = floor.filter((tile) => tile.x === x && !gaps.has(tile.y));
  } else if (archetype === 'pillar-hall') {
    const y1 = Math.max(3, Math.floor(height / 3));
    const y2 = Math.min(height - 4, Math.floor((height * 2) / 3));
    internal = [
      { x: Math.floor(width / 3), y: y1 },
      { x: Math.floor((width * 2) / 3), y: y1 },
      { x: Math.floor(width / 3), y: y2 },
      { x: Math.floor((width * 2) / 3), y: y2 },
    ];
  } else if (archetype === 'ring-route') {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    internal = rectangle(5, 5).map((tile) => ({ x: cx + tile.x - 2, y: cy + tile.y - 2 }));
  } else if (archetype === 'open-arena' && width >= 15) {
    floor = floor.filter((tile) => !(tile.x >= width - 4 && tile.y <= 2));
    boundary = 'cut-corner';
  }
  const internalKeys = new Set(internal.map(coordinateKey));
  floor = floor.filter((tile) => !internalKeys.has(coordinateKey(tile)));
  return { floor, internal, boundary };
}

function boundaryDoor(
  floor: readonly TileCoordinate[],
  direction: ExitDirection,
  width: number,
  height: number,
): { approach: TileCoordinate; door: TileCoordinate } | null {
  const lookup = new Set(floor.map(coordinateKey));
  const offset = offsets[direction];
  const center = { x: width / 2, y: height / 2 };
  const options = floor
    .map((approach) => ({
      approach,
      door: { x: approach.x + offset.x, y: approach.y + offset.y },
    }))
    .filter(
      ({ door }) =>
        door.x >= 0 &&
        door.y >= 0 &&
        door.x < width &&
        door.y < height &&
        !lookup.has(coordinateKey(door)),
    )
    .sort((a, b) => {
      const axisA =
        direction === 'north' || direction === 'south'
          ? Math.abs(a.approach.x - center.x)
          : Math.abs(a.approach.y - center.y);
      const axisB =
        direction === 'north' || direction === 'south'
          ? Math.abs(b.approach.x - center.x)
          : Math.abs(b.approach.y - center.y);
      const outwardA =
        direction === 'north'
          ? a.approach.y
          : direction === 'south'
            ? height - a.approach.y
            : direction === 'west'
              ? a.approach.x
              : width - a.approach.x;
      const outwardB =
        direction === 'north'
          ? b.approach.y
          : direction === 'south'
            ? height - b.approach.y
            : direction === 'west'
              ? b.approach.x
              : width - b.approach.x;
      return outwardA - outwardB || axisA - axisB;
    });
  return options[0] ?? null;
}

export function extractRoomFeatureVectorV3(
  room: RoomDefinition,
  contentUnlockLevel: number,
  fallbackUsed = false,
): RoomFeatureVector {
  const topology = room.topology ?? analyzeRoomTopology(room);
  const distances = topology.entranceToExitDistances.filter((distance) => distance >= 0);
  const shortest = distances.length ? Math.min(...distances) : 0;
  const safe = topology.safePathDistance ?? shortest;
  const spawn = room.entrance ? room.spawnPoints?.[room.entrance.direction] : undefined;
  const ratDistances = spawn
    ? (room.enemySpawns ?? []).map((rat) => shortestPath(room, spawn, rat.tile)?.length ?? 0)
    : [];
  return {
    schemaVersion: ROOM_FEATURE_VECTOR_SCHEMA_VERSION,
    archetype: room.archetype!,
    boundaryFamily: room.boundaryFamily!,
    width: room.width,
    height: room.height,
    floorArea: topology.floorArea,
    floorRatio: topology.floorRatio,
    internalWallCoverage: topology.internalWallCoverage,
    openFloorPercentage: topology.openFloorPercentage,
    shortestExitDistance: shortest,
    safePathDistance: safe,
    directnessRatio: shortest ? safe / shortest : 1,
    exitCount: room.exits.length,
    directionalExitCount: new Set(room.exits.map((exit) => exit.direction)).size,
    loopCount: topology.loopCount,
    branchCount: topology.branchCount,
    articulationPointCount: topology.articulationPointCount,
    oneTileChokepointCount: topology.oneTileChokepointCount,
    deadEndCount: topology.deadEndCount,
    maximumDeadEndLength: topology.maximumDeadEndLength,
    largestCombatArea: topology.largestCombatArea,
    entranceClearArea: topology.entranceClearArea,
    runeCount: room.hazards?.length ?? 0,
    runeDensity: (room.hazards?.length ?? 0) / Math.max(1, topology.floorArea),
    ratCount: room.enemySpawns?.length ?? 0,
    averageRatSpawnDistance: ratDistances.length
      ? ratDistances.reduce((sum, value) => sum + value, 0) / ratDistances.length
      : 0,
    contentUnlockLevel,
    fallbackUsed,
  };
}

function placeRestorationFountain(
  room: RoomDefinition,
  request: GenerationRequest,
  seed: string,
): NonNullable<GeneratedRoomSave['details']['recoveryDecision']> {
  const occupied = new Set([
    ...(room.hazards ?? []).map(coordinateKey),
    ...(room.enemySpawns ?? []).map((spawn) => coordinateKey(spawn.tile)),
    ...room.exits.map((exit) => coordinateKey(exit.tile)),
    ...(room.entrance ? [coordinateKey(room.entrance.tile)] : []),
    ...Object.values(room.spawnPoints ?? {})
      .filter(Boolean)
      .map((tile) => coordinateKey(tile!)),
    ...(room.topology?.articulationPoints ?? []).map(coordinateKey),
  ]);
  const walls = getWallLookup(room);
  const floor = new Set(room.floorTiles.map(coordinateKey));
  const candidates = shuffleSeeded(
    createSeededRandom(`${seed}:fountain-placements`),
    room.floorTiles,
  )
    .filter((tile) => !occupied.has(coordinateKey(tile)))
    .map((tile) => {
      const interactionTiles = cardinalNeighbors(tile).filter(
        (neighbor) => floor.has(coordinateKey(neighbor)) && !occupied.has(coordinateKey(neighbor)),
      );
      const wallDirection = (Object.entries(offsets) as [ExitDirection, TileCoordinate][]).find(
        ([, offset]) => walls.has(coordinateKey({ x: tile.x + offset.x, y: tile.y + offset.y })),
      )?.[0];
      const feature: RestorationFountainFeature = {
        id: `${room.id}-restoration-fountain`,
        kind: 'restoration-fountain',
        tile,
        blocking: true,
        source: 'generated',
        placementStyle: 'safe',
        variant: wallDirection ? 'wall-integrated' : 'freestanding',
        ...(wallDirection ? { orientation: oppositeExitDirectionV3(wallDirection) } : {}),
        interactionTiles,
      };
      const spawn = room.entrance ? room.spawnPoints?.[room.entrance.direction] : undefined;
      const runeDistance = Math.min(
        99,
        ...(room.hazards ?? []).map(
          (hazard) => Math.abs(hazard.x - tile.x) + Math.abs(hazard.y - tile.y),
        ),
      );
      const ratDistance = Math.min(
        99,
        ...(room.enemySpawns ?? []).map(
          (rat) => Math.abs(rat.tile.x - tile.x) + Math.abs(rat.tile.y - tile.y),
        ),
      );
      const entranceDistance = spawn ? Math.abs(spawn.x - tile.x) + Math.abs(spawn.y - tile.y) : 0;
      return {
        feature,
        valid: interactionTiles.length > 0 && entranceDistance > 1 && ratDistance > 1,
        safeScore:
          runeDistance * 2 + ratDistance + interactionTiles.length * 3 - entranceDistance * 0.15,
        riskyScore: entranceDistance + (99 - Math.min(99, runeDistance)) * 0.25,
      };
    })
    .filter((candidate) => candidate.valid);
  const decision = createRecoveryDecision({
    seed,
    preset: request.experiencePreset,
    profile: request.effectiveProfile,
    recovery: request.recovery,
    validPlacementCount: candidates.length,
  });
  if (!decision.spawned) return decision;
  const lowHealth = decision.inputs.healthDeficit >= 0.5 || decision.inputs.recentDamage >= 0.5;
  const requestedStyle = request.recovery?.placementPreference;
  const style =
    requestedStyle ?? (lowHealth || request.effectiveProfile.exploration < 0.55 ? 'safe' : 'risky');
  const ranked = [...candidates].sort((left, right) => {
    const score =
      style === 'safe' ? right.safeScore - left.safeScore : right.riskyScore - left.riskyScore;
    return (
      score ||
      left.feature.tile.y - right.feature.tile.y ||
      left.feature.tile.x - right.feature.tile.x
    );
  });
  const selected = ranked.find(
    (candidate) => validateGeneratedRoomV3({ ...room, features: [candidate.feature] }).valid,
  );
  if (!selected)
    return {
      ...decision,
      placementPossible: false,
      spawned: false,
      reasons: [...decision.reasons, 'no-valid-placement'],
      validPlacementCount: 0,
    };
  selected.feature.placementStyle = style;
  room.features = [selected.feature];
  return {
    ...decision,
    placementStyle: style,
    selectedCoordinate: selected.feature.tile,
    visualVariant: selected.feature.variant,
  };
}

function placeDecorativeTorches(room: RoomDefinition, seed: string): void {
  const floor = new Set(room.floorTiles.map(coordinateKey));
  const excluded = new Set([
    ...room.exits.map((exit) => coordinateKey(exit.tile)),
    ...(room.entrance ? [coordinateKey(room.entrance.tile)] : []),
  ]);
  const wallTiles = [...(room.outerWallTiles ?? []), ...(room.internalWallTiles ?? [])].filter(
    (wall) =>
      !excluded.has(coordinateKey(wall)) &&
      cardinalNeighbors(wall).some((neighbor) => floor.has(coordinateKey(neighbor))),
  );
  const torchCount = Math.min(5, Math.max(2, Math.floor(room.floorTiles.length / 45)));
  const torches = shuffleSeeded(createSeededRandom(`${seed}:torches`), wallTiles)
    .filter((tile, index, all) =>
      all
        .slice(0, index)
        .every((other) => Math.abs(other.x - tile.x) + Math.abs(other.y - tile.y) > 3),
    )
    .slice(0, torchCount)
    .map((tile, index) => ({
      id: `${room.id}-torch-${index + 1}`,
      kind: 'ruin-torch',
      tile,
      blocking: false as const,
      source: 'generated' as const,
    }));
  room.features = [...(room.features ?? []), ...torches];
}

export interface TopologyCandidateOptions {
  roomSeed?: string;
  generatorVersion?: Extract<GeneratorVersion, 'generator-3' | 'generator-4'>;
  gameVersion?: 'mvp-0.3' | 'mvp-0.4';
  constructionProfile?: AdaptiveProfile;
  constructionMode?: 'reinforce' | 'poke';
  fountainPlacementPreference?: 'safe' | 'risky';
}

export function generateTopologyCandidate(
  request: GenerationRequest,
  archetype: RoomArchetype,
  attempt: number,
  options: TopologyCandidateOptions = {},
): { save: GeneratedRoomSave; feature: RoomFeatureVector } {
  const roomSeed = options.roomSeed ?? deriveRoomSeedV3(request);
  const generatorVersion = options.generatorVersion ?? 'generator-3';
  const candidateRequest: GenerationRequest = {
    ...request,
    effectiveProfile: options.constructionProfile ?? request.effectiveProfile,
    mode: options.constructionMode ?? request.mode,
    recovery:
      options.fountainPlacementPreference && request.recovery
        ? { ...request.recovery, placementPreference: options.fountainPlacementPreference }
        : request.recovery,
  };
  const random = createSeededRandom(`${roomSeed}:candidate:${attempt}:${archetype}`);
  const width = randomInteger(random, archetype === 'true-l-ruin' ? 15 : 13, 21);
  const height = randomInteger(random, archetype === 'true-l-ruin' ? 11 : 9, 15);
  const generated = floorForArchetype(archetype, width, height);
  const entranceDoor = boundaryDoor(
    generated.floor,
    candidateRequest.entranceDirection,
    width,
    height,
  );
  if (!entranceDoor) throw new Error('no-valid-entrance-boundary');
  const floor = [...generated.floor];
  const availableDirections = shuffleSeeded(
    random,
    (['north', 'east', 'south', 'west'] as ExitDirection[]).filter(
      (direction) =>
        direction !== candidateRequest.entranceDirection &&
        boundaryDoor(floor, direction, width, height),
    ),
  );
  const exploration = candidateRequest.effectiveProfile.exploration;
  const pace = candidateRequest.effectiveProfile.pace;
  const archetypeOptions =
    archetype === 'open-arena' || archetype === 'ring-route' || archetype === 'twin-chambers'
      ? 0.08
      : 0;
  const presetOptions =
    candidateRequest.experiencePreset === 'dungeon-veteran'
      ? 0.06
      : candidateRequest.experiencePreset === 'new-delver'
        ? -0.06
        : 0;
  const directionalOptions = exploration + archetypeOptions + presetOptions - pace * 0.08;
  const desiredExits = Math.max(
    1,
    Math.min(3, 1 + (directionalOptions > 0.42 ? 1 : 0) + (directionalOptions > 0.76 ? 1 : 0)),
  );
  const chosenDirections = availableDirections.slice(0, desiredExits);
  const exits: RoomExit[] = [];
  for (const direction of chosenDirections) {
    const candidate = boundaryDoor(floor, direction, width, height);
    if (!candidate) continue;
    floor.push(candidate.door);
    exits.push({
      id: `dungeon-${request.dungeonRoomNumber}-${attempt}-${direction}`,
      direction,
      tile: candidate.door,
      kind: 'standard',
      condition: { type: 'enemies-defeated' },
      enabled: true,
      destination: { type: 'next-generated-room' },
    });
  }
  const room: RoomDefinition = {
    id: `generated-dungeon-room-${request.dungeonRoomNumber}`,
    phase: 'dungeon',
    width,
    height,
    shape:
      archetype === 'true-l-ruin'
        ? 'l-shape'
        : generated.boundary === 'rectangle'
          ? 'rectangle'
          : 'irregular',
    floorTiles: floor,
    outerWallTiles: [],
    internalWallTiles: generated.internal,
    exits,
    entrance: { direction: candidateRequest.entranceDirection, tile: entranceDoor.door },
    spawnPoints: { [candidateRequest.entranceDirection]: entranceDoor.approach },
    hazards: [],
    enemySpawns: [],
    featureSchemaVersion: ROOM_FEATURE_SCHEMA_VERSION,
    features: [],
    archetype,
    boundaryFamily: generated.boundary,
    boundaryModifiers: generated.boundary === 'rectangle' ? [] : [generated.boundary],
  };
  room.outerWallTiles = deriveOuterWalls(
    room.floorTiles,
    width,
    height,
    [entranceDoor.door],
    room.internalWallTiles,
  );
  const preliminary = analyzeRoomTopology(room);
  const spawn = entranceDoor.approach;
  const directExit = exits[0];
  const reservedSafePath = directExit ? (shortestPath(room, spawn, directExit.tile) ?? []) : [];
  const reserved = new Set([
    ...reservedSafePath.map(coordinateKey),
    coordinateKey(spawn),
    ...exits.map((exit) => coordinateKey(exit.tile)),
    ...preliminary.articulationPoints.map(coordinateKey),
  ]);
  const maximumRunes =
    archetype === 'safe-fallback'
      ? 0
      : Math.min(5, Math.max(0, Math.round(candidateRequest.effectiveProfile.hazardTolerance * 4)));
  room.hazards = shuffleSeeded(random, room.floorTiles)
    .filter((tile) => !reserved.has(coordinateKey(tile)))
    .slice(0, maximumRunes);
  const enemySelection = selectGeneratedRatSpawns(room, {
    roomSeed: `${roomSeed}:candidate:${attempt}`,
    preset: candidateRequest.experiencePreset,
    profile: candidateRequest.effectiveProfile,
    mode: candidateRequest.mode,
    playerSpawn: spawn,
  });
  room.enemySpawns = enemySelection.spawns
    .filter(
      (rat) =>
        (pathDistance(room, rat.tile, spawn) ?? 0) >=
        TOPOLOGY_CONFIG.minimumGeneratedRatPathDistance,
    )
    .map((rat, index) => ({ ...rat, order: index + 1 }));
  const enemyCountPlan = {
    ...enemySelection.plan,
    selectedCount: room.enemySpawns.length,
  };
  room.topology = analyzeRoomTopology(room);
  const recoveryDecision = placeRestorationFountain(
    room,
    candidateRequest,
    `${roomSeed}:candidate:${attempt}`,
  );
  placeDecorativeTorches(room, `${roomSeed}:candidate:${attempt}`);
  room.topology = analyzeRoomTopology(room);
  const exitDecisions: DirectionalExitDecision[] = exits.map((exit, index) => {
    const path = shortestPath(room, spawn, exit.tile);
    const safePath = shortestPath(
      room,
      spawn,
      exit.tile,
      new Set((room.hazards ?? []).map(coordinateKey)),
    );
    return {
      exitId: exit.id,
      direction: exit.direction,
      pathDistance: path ? path.length - 1 : -1,
      safePathDistance: safePath ? safePath.length - 1 : null,
      route: index === 0 ? 'direct' : 'optional',
    };
  });
  const contentUnlockLevel = ARCHETYPE_IDS.filter(
    (id) =>
      ARCHETYPE_UNLOCK_ROOM[candidateRequest.experiencePreset][id] <=
      candidateRequest.dungeonRoomNumber,
  ).length;
  const feature = extractRoomFeatureVectorV3(room, contentUnlockLevel);
  const save: GeneratedRoomSave = {
    schemaVersion: 2,
    generatorVersion,
    gameVersion:
      options.gameVersion ??
      request.gameVersion ??
      (generatorVersion === 'generator-4' ? VERSION_INFO.gameVersion : 'mvp-0.3'),
    adaptationVersion: candidateRequest.adaptationVersion ?? 'rules-2',
    runSeed: candidateRequest.runSeed,
    roomSeed,
    dungeonRoomNumber: candidateRequest.dungeonRoomNumber,
    adaptiveInput: {
      mode: candidateRequest.mode,
      shapeWeights: { rectangle: 0.42, lShape: 0.58 },
      minWidth: 13,
      maxWidth: 21,
      minHeight: 9,
      maxHeight: 15,
      exitCountWeights: { 1: 0.45, 2: 0.4, 3: 0.15 },
      hazardCountRange: { min: 0, max: maximumRunes },
      hazardPatternWeights: { scattered: 0.75, clustered: 0.25 },
      safePathPreference: 'neutral',
    },
    roomSnapshot: room,
    details: {
      roomSeed,
      generatorVersion,
      shape: room.shape === 'l-shape' ? 'l-shape' : 'rectangle',
      entranceDirection: candidateRequest.entranceDirection,
      hazardPattern: 'scattered',
      mode: candidateRequest.mode,
      retryCount: attempt,
      validationErrors: [],
      reasons: [
        `${archetype} topology candidate`,
        `Incoming from ${candidateRequest.entranceDirection}`,
      ],
      enemyCountPlan,
      archetype,
      boundaryFamily: generated.boundary,
      exitDecisions,
      featureSchemaVersion: ROOM_FEATURE_VECTOR_SCHEMA_VERSION,
      recoveryDecision,
    },
  };
  return { save, feature };
}

export function generateArchetypeRoomV3(
  request: GenerationRequest,
  archetype: Exclude<RoomArchetype, 'safe-fallback'>,
  attempt = 0,
): GeneratedRoomSave {
  return generateTopologyCandidate(request, archetype, attempt).save;
}

export function generateDungeonRoomV3(
  request: GenerationRequest,
  validator: typeof validateGeneratedRoomV3 = validateGeneratedRoomV3,
): GeneratedRoomSave {
  const roomSeed = deriveRoomSeedV3(request);
  const adjusted = createRules2Profile(request.effectiveProfile, request.mode, roomSeed);
  const rules2Request = { ...request, effectiveProfile: adjusted.profile };
  const available = ARCHETYPE_IDS.filter(
    (archetype) =>
      ARCHETYPE_UNLOCK_ROOM[request.experiencePreset][archetype] <= request.dungeonRoomNumber,
  );
  const valid: { save: GeneratedRoomSave; summary: RoomCandidateSummary }[] = [];
  const rejectionCounts: Record<string, number> = {};
  let rejectedCandidateCount = 0;
  for (let attempt = 0; attempt < TOPOLOGY_CONFIG.maximumGenerationAttempts; attempt += 1) {
    if (valid.length >= TOPOLOGY_CONFIG.requestedCandidateCount) break;
    const archetype = available[attempt % available.length]!;
    try {
      const candidate = generateTopologyCandidate(rules2Request, archetype, attempt);
      const validation = validator(candidate.save.roomSnapshot);
      if (!validation.valid) {
        rejectedCandidateCount += 1;
        for (const reason of validation.errors)
          rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
        continue;
      }
      const score = scoreRoomFeatureVector(candidate.feature, adjusted.profile);
      valid.push({
        save: candidate.save,
        summary: {
          id: `${roomSeed}:candidate:${attempt}`,
          rank: 0,
          score,
          archetype,
          featureVector: candidate.feature,
        },
      });
    } catch (error) {
      rejectedCandidateCount += 1;
      const reason = error instanceof Error ? error.message : 'candidate-error';
      rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
    }
  }
  if (!valid.length) {
    const fallback = generateTopologyCandidate(rules2Request, 'safe-fallback', 10_000).save;
    fallback.details = {
      ...fallback.details,
      archetype: 'safe-fallback',
      mode: 'fallback',
      retryCount: TOPOLOGY_CONFIG.maximumGenerationAttempts,
      validationErrors: Object.keys(rejectionCounts),
      requestedCandidateCount: TOPOLOGY_CONFIG.requestedCandidateCount,
      validCandidateCount: 0,
      rejectedCandidateCount,
      reducedDiversity: true,
      fallbackUsed: true,
      challengedTraits: adjusted.challengedTraits,
      rejectionCounts,
      reasons: [...fallback.details.reasons, 'Deterministic safe fallback: no valid candidates'],
    };
    return fallback;
  }
  const decision = selectRankedCandidate(
    valid.map((item) => item.summary),
    roomSeed,
  );
  const chosen = valid.find((item) => item.summary.id === decision.selected.id)!;
  const top = decision.ranked.slice(0, 3);
  chosen.save.details = {
    ...chosen.save.details,
    requestedCandidateCount: TOPOLOGY_CONFIG.requestedCandidateCount,
    validCandidateCount: valid.length,
    rejectedCandidateCount,
    reducedDiversity: decision.reducedDiversity,
    fallbackUsed: false,
    challengedTraits: adjusted.challengedTraits,
    selectedCandidateId: decision.selected.id,
    selectedCandidateRank: decision.selected.rank,
    selectedCandidateScore: decision.selected.score,
    seededSelectionRoll: decision.roll,
    topCandidates: top,
    rejectionCounts,
    reasons: [
      ...chosen.save.details.reasons,
      `Selected rank ${decision.selected.rank} of ${valid.length} valid candidates`,
      ...(decision.reducedDiversity ? ['Candidate diversity reduced'] : []),
    ],
  };
  return chosen.save;
}
