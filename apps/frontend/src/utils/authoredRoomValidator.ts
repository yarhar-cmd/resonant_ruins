import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import {
  coordinateKey,
  coordinatesMatch,
  getFloorLookup,
  getWallLookup,
  isCoordinateInRoom,
} from './roomGeometry';
import { hasSafePath, validateEnemySpawns } from './generatedRoomValidator';
import { getRestorationFountains } from './interactions';
import {
  EVALUATION_ROOM_1_ID,
  EVALUATION_ROOM_2_ID,
  EVALUATION_ROOM_3_ID,
  EVALUATION_ROOM_4_ID,
  EVALUATION_ROOM_5_ID,
} from '../data/rooms/evaluationRooms';

export interface AuthoredRoomValidationResult {
  valid: boolean;
  errors: string[];
}

function duplicateCoordinates(items: TileCoordinate[]): boolean {
  return new Set(items.map(coordinateKey)).size !== items.length;
}

function directionalBoundary(room: RoomDefinition, tile: TileCoordinate, direction: string) {
  if (direction === 'north') return tile.y === 0;
  if (direction === 'south') return tile.y === room.height - 1;
  if (direction === 'west') return tile.x === 0;
  return tile.x === room.width - 1;
}

function isFloorConnected(room: RoomDefinition): boolean {
  const floor = getFloorLookup(room);
  const first = room.floorTiles[0];
  if (!first) return false;
  const visited = new Set([coordinateKey(first)]);
  const queue = [first];
  let index = 0;
  while (index < queue.length) {
    const current = queue[index++]!;
    for (const next of [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]) {
      const key = coordinateKey(next);
      if (!visited.has(key) && floor.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return visited.size === floor.size;
}

function featureCount(room: RoomDefinition, kind: string): number {
  return room.features?.filter((feature) => feature.kind === kind).length ?? 0;
}

export function validateAuthoredRoom(
  room: RoomDefinition,
  officialRooms: readonly RoomDefinition[] = [],
): AuthoredRoomValidationResult {
  const errors: string[] = [];
  if (
    room.phase !== 'evaluation' ||
    !Number.isSafeInteger(room.width) ||
    !Number.isSafeInteger(room.height) ||
    room.width < 9 ||
    room.width > 21 ||
    room.height < 9 ||
    room.height > 15
  )
    errors.push('Room dimensions must be integers within 9–21 by 9–15.');
  const floor = getFloorLookup(room);
  const walls = getWallLookup(room);
  if (room.floorTiles.some((tile) => !isCoordinateInRoom(room, tile)))
    errors.push('Every floor tile must be inside the room.');
  if ((room.wallTiles ?? []).some((tile) => !isCoordinateInRoom(room, tile)))
    errors.push('Every wall tile must be inside the room.');
  if (duplicateCoordinates(room.floorTiles)) errors.push('Floor coordinates must be unique.');
  if (duplicateCoordinates(room.wallTiles ?? [])) errors.push('Wall coordinates must be unique.');
  if (room.floorTiles.some((tile) => walls.has(coordinateKey(tile))))
    errors.push('Floor and wall tiles cannot overlap.');
  if (!isFloorConnected(room)) errors.push('All floor tiles must form one connected area.');
  const spawn = room.spawnPoints?.west;
  if (!spawn || !floor.has(coordinateKey(spawn)) || walls.has(coordinateKey(spawn)))
    errors.push('A valid west player spawn is required on walkable floor.');
  for (const exit of room.exits) {
    if (
      !isCoordinateInRoom(room, exit.tile) ||
      !directionalBoundary(room, exit.tile, exit.direction) ||
      !floor.has(coordinateKey(exit.tile)) ||
      walls.has(coordinateKey(exit.tile))
    )
      errors.push(`Exit ${exit.id} must be on its matching walkable boundary.`);
    if (exit.kind === 'shortcut' && exit.condition.type !== 'always')
      errors.push('Shortcut exits must use the always condition.');
    if (spawn && !hasSafePath(room, spawn, exit.tile))
      errors.push(`Exit ${exit.id} must be structurally reachable from the spawn.`);
  }
  if (new Set(room.exits.map((exit) => exit.id)).size !== room.exits.length)
    errors.push('Exit IDs must be unique.');
  if (duplicateCoordinates(room.exits.map((exit) => exit.tile)))
    errors.push('Exit coordinates must be unique.');
  if (duplicateCoordinates(room.hazards ?? [])) errors.push('Hazard coordinates must be unique.');
  for (const hazard of room.hazards ?? []) {
    if (!floor.has(coordinateKey(hazard)) || walls.has(coordinateKey(hazard)))
      errors.push('Hazards must be on walkable floor.');
    if (spawn && coordinatesMatch(spawn, hazard)) errors.push('Hazards cannot overlap the spawn.');
    if (room.exits.some((exit) => coordinatesMatch(exit.tile, hazard)))
      errors.push('Hazards cannot overlap exits.');
  }
  const hazardLookup = new Set((room.hazards ?? []).map(coordinateKey));
  for (const fountain of getRestorationFountains(room)) {
    const fountainKey = coordinateKey(fountain.tile);
    if (!floor.has(fountainKey) || walls.has(fountainKey) || hazardLookup.has(fountainKey))
      errors.push(`Fountain ${fountain.id} must occupy clear walkable floor.`);
    if (
      room.exits.some((exit) => coordinatesMatch(exit.tile, fountain.tile)) ||
      (room.enemySpawns ?? []).some((enemy) => coordinatesMatch(enemy.tile, fountain.tile))
    )
      errors.push(`Fountain ${fountain.id} cannot overlap an exit or Rat spawn.`);
    const accessibleTiles = fountain.interactionTiles.filter((tile) => {
      const key = coordinateKey(tile);
      return (
        floor.has(key) &&
        !walls.has(key) &&
        !hazardLookup.has(key) &&
        Math.abs(tile.x - fountain.tile.x) + Math.abs(tile.y - fountain.tile.y) === 1
      );
    });
    if (
      accessibleTiles.length === 0 ||
      (spawn && !accessibleTiles.some((tile) => hasSafePath(room, spawn, tile)))
    )
      errors.push(`Fountain ${fountain.id} requires a reachable rune-free interaction tile.`);
  }
  errors.push(...validateEnemySpawns(room).map((error) => `Enemy spawn: ${error}.`));
  if (featureCount(room, 'resonance-cache') > 0)
    errors.push('Awakening Chambers cannot contain Resonance Caches.');
  if (room.id === EVALUATION_ROOM_1_ID) {
    if (
      (room.hazards?.length ?? 0) > 0 ||
      (room.enemySpawns?.length ?? 0) > 0 ||
      featureCount(room, 'restoration-fountain') > 0
    )
      errors.push('Chamber 1 must contain only movement and exit mechanics.');
    if (!room.exits.some((exit) => exit.kind === 'standard' && exit.enabled))
      errors.push('Chamber 1 requires a clear enabled standard exit.');
    if (!room.exits.some((exit) => exit.kind === 'shortcut' && !exit.enabled))
      errors.push('Chamber 1 requires its future shortcut to begin inactive.');
  }
  if (room.id === EVALUATION_ROOM_2_ID) {
    if ((room.hazards?.length ?? 0) < 2 || (room.hazards?.length ?? 0) > 3)
      errors.push('Chamber 2 requires two or three rune hazards.');
    if ((room.enemySpawns?.length ?? 0) > 0 || featureCount(room, 'restoration-fountain') > 0)
      errors.push('Chamber 2 must remain a Rune-only route lesson.');
  }
  if (room.id === EVALUATION_ROOM_3_ID) {
    if ((room.hazards?.length ?? 0) < 1 || (room.hazards?.length ?? 0) > 2)
      errors.push('Chamber 3 requires one or two optional rune hazards.');
    if ((room.enemySpawns?.length ?? 0) > 0 || featureCount(room, 'restoration-fountain') !== 1)
      errors.push('Chamber 3 requires exactly one Fountain and no Rats.');
  }
  if (room.id === EVALUATION_ROOM_4_ID) {
    if ((room.enemySpawns?.length ?? 0) < 2)
      errors.push('Chamber 4 requires two ordered Rat spawns for preset scaling.');
    if ((room.hazards?.length ?? 0) > 0 || featureCount(room, 'restoration-fountain') > 0)
      errors.push('Chamber 4 must remain a clear combat lesson without Runes or a Fountain.');
  }
  if (room.id === EVALUATION_ROOM_5_ID) {
    if ((room.enemySpawns?.length ?? 0) < 2)
      errors.push('Chamber 5 requires two ordered Rat spawns for preset scaling.');
    if ((room.hazards?.length ?? 0) !== 2)
      errors.push('Chamber 5 requires exactly two rune hazards.');
    if (featureCount(room, 'restoration-fountain') !== 1)
      errors.push('Chamber 5 requires one optional Restoration Fountain.');
    const chamber4 = officialRooms.find((candidate) => candidate.id === EVALUATION_ROOM_4_ID);
    if (chamber4 && room.width * room.height <= chamber4.width * chamber4.height)
      errors.push('Chamber 5 must be larger than Chamber 4.');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
