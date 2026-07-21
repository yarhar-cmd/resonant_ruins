import { TOPOLOGY_CONFIG } from '../config/topology';
import type { RoomValidationResult } from '../types/generation';
import type { ExitDirection, RoomDefinition, TileCoordinate } from '../types/rooms';
import type { RestorationFountainFeature } from '../types/topology';
import { pathDistance } from './enemySystem';
import {
  coordinateKey,
  coordinatesMatch,
  getBlockingFeatureLookup,
  getWallLookup,
  isCoordinateInRoom,
} from './roomGeometry';
import {
  analyzeRoomTopology,
  cardinalNeighbors,
  deriveOuterWalls,
  shortestPath,
} from './topologyAnalysis';

const inwardOffset: Record<ExitDirection, TileCoordinate> = {
  north: { x: 0, y: 1 },
  south: { x: 0, y: -1 },
  east: { x: -1, y: 0 },
  west: { x: 1, y: 0 },
};

export function validateGeneratedRoomV3(room: RoomDefinition): RoomValidationResult {
  const errors: string[] = [];
  const floor = new Set(room.floorTiles.map(coordinateKey));
  const walls = getWallLookup(room);
  const blockingFeatures = getBlockingFeatureLookup(room);
  const hazards = new Set((room.hazards ?? []).map(coordinateKey));
  const entrance = room.entrance;
  const spawn = entrance ? room.spawnPoints?.[entrance.direction] : undefined;

  if (room.phase !== 'dungeon' || room.featureSchemaVersion !== 1) errors.push('invalid-v3-room');
  if (!room.archetype || !room.boundaryFamily) errors.push('missing-topology-identity');
  if (room.width > 21 || room.height > 15 || room.width < 9 || room.height < 9)
    errors.push('dimensions-out-of-bounds');
  if (room.floorTiles.some((tile) => !isCoordinateInRoom(room, tile)))
    errors.push('floor-out-of-bounds');
  if ([...walls].some((key) => floor.has(key))) errors.push('floor-wall-conflict');
  if (!entrance || !spawn || !floor.has(coordinateKey(spawn)))
    errors.push('invalid-entrance-spawn');
  if (entrance && walls.has(coordinateKey(entrance.tile))) errors.push('entrance-wall-conflict');

  const expectedOuter = new Set(
    deriveOuterWalls(
      room.floorTiles,
      room.width,
      room.height,
      [...(entrance ? [entrance.tile] : [])],
      room.internalWallTiles,
    ).map(coordinateKey),
  );
  const actualOuter = new Set((room.outerWallTiles ?? []).map(coordinateKey));
  if (
    expectedOuter.size !== actualOuter.size ||
    [...expectedOuter].some((key) => !actualOuter.has(key))
  )
    errors.push('outer-wall-not-floor-derived');

  if (room.exits.length < 1 || room.exits.length > 3) errors.push('invalid-exit-count');
  if (new Set(room.exits.map((exit) => exit.direction)).size !== room.exits.length)
    errors.push('duplicate-exit-direction');
  for (const exit of room.exits) {
    const key = coordinateKey(exit.tile);
    const offset = inwardOffset[exit.direction];
    const approach = { x: exit.tile.x + offset.x, y: exit.tile.y + offset.y };
    const outward = { x: exit.tile.x - offset.x, y: exit.tile.y - offset.y };
    if (!floor.has(key) || walls.has(key) || hazards.has(key) || blockingFeatures.has(key))
      errors.push('invalid-exit-coordinate');
    if (!floor.has(coordinateKey(approach))) errors.push('exit-not-on-actual-boundary');
    if (floor.has(coordinateKey(outward))) errors.push('exit-not-on-actual-boundary');
    if (!spawn || !shortestPath(room, spawn, exit.tile)) errors.push('unreachable-exit');
    if (cardinalNeighbors(approach).filter((tile) => floor.has(coordinateKey(tile))).length < 2)
      errors.push('exit-approach-trap');
  }

  const topology = analyzeRoomTopology(room);
  if (topology.connectedRegionCount !== 1) errors.push('disconnected-floor');
  if (!topology.safeRouteExists) errors.push('unsafe-exit-path');
  for (const hazard of room.hazards ?? []) {
    const key = coordinateKey(hazard);
    if (!floor.has(key) || walls.has(key) || blockingFeatures.has(key)) errors.push('invalid-rune');
    if (spawn && coordinatesMatch(spawn, hazard)) errors.push('rune-spawn-overlap');
    if (room.exits.some((exit) => coordinatesMatch(exit.tile, hazard)))
      errors.push('rune-exit-overlap');
  }
  for (const rat of room.enemySpawns ?? []) {
    const key = coordinateKey(rat.tile);
    if (!floor.has(key) || walls.has(key) || hazards.has(key) || blockingFeatures.has(key))
      errors.push('invalid-enemy-spawn');
    if (spawn) {
      const distance = pathDistance(room, rat.tile, spawn);
      if (distance === null) errors.push('enemy-spawn-no-player-path');
      if (distance !== null && distance < TOPOLOGY_CONFIG.minimumGeneratedRatPathDistance)
        errors.push('enemy-spawn-too-close-to-player');
    }
  }
  const fountains = (room.features ?? []).filter(
    (feature): feature is RestorationFountainFeature =>
      feature.kind === 'restoration-fountain' && feature.blocking,
  );
  if (fountains.length > 1) errors.push('too-many-restoration-fountains');
  for (const fountain of fountains) {
    const key = coordinateKey(fountain.tile);
    if (!floor.has(key) || walls.has(key) || hazards.has(key)) errors.push('invalid-fountain-tile');
    if (room.exits.some((exit) => coordinatesMatch(exit.tile, fountain.tile)))
      errors.push('fountain-exit-overlap');
    if (spawn && coordinatesMatch(spawn, fountain.tile)) errors.push('fountain-entrance-overlap');
    if ((room.enemySpawns ?? []).some((rat) => coordinatesMatch(rat.tile, fountain.tile)))
      errors.push('fountain-rat-overlap');
    const validInteractionTiles = fountain.interactionTiles.filter(
      (tile) =>
        floor.has(coordinateKey(tile)) &&
        !walls.has(coordinateKey(tile)) &&
        !blockingFeatures.has(coordinateKey(tile)) &&
        (!spawn || shortestPath(room, spawn, tile)),
    );
    if (!validInteractionTiles.length) errors.push('fountain-no-reachable-interaction-tile');
    if (
      fountain.variant === 'wall-integrated' &&
      (!fountain.orientation ||
        !walls.has(
          coordinateKey({
            x:
              fountain.tile.x +
              (fountain.orientation === 'east' ? -1 : fountain.orientation === 'west' ? 1 : 0),
            y:
              fountain.tile.y +
              (fountain.orientation === 'south' ? -1 : fountain.orientation === 'north' ? 1 : 0),
          }),
        ))
    )
      errors.push('invalid-wall-fountain-orientation');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
