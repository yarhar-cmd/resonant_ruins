import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import type { TopologyMetrics } from '../types/topology';
import {
  coordinateKey,
  coordinatesMatch,
  getBlockingFeatureLookup,
  getWallLookup,
} from './roomGeometry';

export const cardinalNeighbors = ({ x, y }: TileCoordinate): TileCoordinate[] => [
  { x: x + 1, y },
  { x: x - 1, y },
  { x, y: y + 1 },
  { x, y: y - 1 },
];

export function shortestPath(
  room: RoomDefinition,
  start: TileCoordinate,
  target: TileCoordinate,
  blocked: ReadonlySet<string> = new Set(),
): TileCoordinate[] | null {
  const floor = new Set(room.floorTiles.map(coordinateKey));
  const walls = getWallLookup(room);
  const features = getBlockingFeatureLookup(room);
  const occupied = new Set([...blocked, ...features]);
  const queue = [start];
  const visited = new Set([coordinateKey(start)]);
  const previous = new Map<string, TileCoordinate>();
  let index = 0;
  while (index < queue.length) {
    const current = queue[index++]!;
    if (coordinatesMatch(current, target)) {
      const path = [current];
      let cursor = current;
      while (!coordinatesMatch(cursor, start)) {
        cursor = previous.get(coordinateKey(cursor))!;
        path.unshift(cursor);
      }
      return path;
    }
    for (const next of cardinalNeighbors(current)) {
      const key = coordinateKey(next);
      if (visited.has(key) || occupied.has(key) || walls.has(key) || !floor.has(key)) continue;
      visited.add(key);
      previous.set(key, current);
      queue.push(next);
    }
  }
  return null;
}

function connectedRegions(room: RoomDefinition): TileCoordinate[][] {
  const floor = new Map(room.floorTiles.map((tile) => [coordinateKey(tile), tile]));
  const walls = getWallLookup(room);
  const features = getBlockingFeatureLookup(room);
  const unseen = new Set([...floor.keys()].filter((key) => !walls.has(key) && !features.has(key)));
  const regions: TileCoordinate[][] = [];
  while (unseen.size) {
    const first = unseen.values().next().value as string;
    const queue = [floor.get(first)!];
    const region: TileCoordinate[] = [];
    unseen.delete(first);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]!;
      region.push(current);
      for (const next of cardinalNeighbors(current)) {
        const key = coordinateKey(next);
        if (!unseen.delete(key)) continue;
        queue.push(floor.get(key)!);
      }
    }
    regions.push(region);
  }
  return regions;
}

export function findArticulationPoints(room: RoomDefinition): TileCoordinate[] {
  const floor = new Map(room.floorTiles.map((tile) => [coordinateKey(tile), tile]));
  const walls = getWallLookup(room);
  for (const key of walls) floor.delete(key);
  for (const key of getBlockingFeatureLookup(room)) floor.delete(key);
  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const result = new Set<string>();
  let time = 0;

  function visit(key: string) {
    discovery.set(key, ++time);
    low.set(key, time);
    let children = 0;
    const tile = floor.get(key)!;
    for (const neighbor of cardinalNeighbors(tile)) {
      const next = coordinateKey(neighbor);
      if (!floor.has(next)) continue;
      if (!discovery.has(next)) {
        parent.set(next, key);
        children += 1;
        visit(next);
        low.set(key, Math.min(low.get(key)!, low.get(next)!));
        if (parent.get(key) === null && children > 1) result.add(key);
        if (parent.get(key) !== null && low.get(next)! >= discovery.get(key)!) result.add(key);
      } else if (next !== parent.get(key)) {
        low.set(key, Math.min(low.get(key)!, discovery.get(next)!));
      }
    }
  }

  for (const key of floor.keys()) {
    if (!discovery.has(key)) {
      parent.set(key, null);
      visit(key);
    }
  }
  return [...result].map((key) => floor.get(key)!);
}

export function analyzeRoomTopology(room: RoomDefinition): TopologyMetrics {
  const walls = getWallLookup(room);
  const walkable = room.floorTiles.filter((tile) => !walls.has(coordinateKey(tile)));
  const walkableSet = new Set(walkable.map(coordinateKey));
  const regions = connectedRegions(room);
  const spawn = room.entrance ? room.spawnPoints?.[room.entrance.direction] : undefined;
  const articulationPoints = findArticulationPoints(room).filter(
    (tile) =>
      (!spawn || Math.abs(tile.x - spawn.x) + Math.abs(tile.y - spawn.y) > 1) &&
      room.exits.every(
        (exit) => Math.abs(tile.x - exit.tile.x) + Math.abs(tile.y - exit.tile.y) > 1,
      ),
  );
  const degrees = walkable.map(
    (tile) => cardinalNeighbors(tile).filter((next) => walkableSet.has(coordinateKey(next))).length,
  );
  const edges = degrees.reduce((sum, value) => sum + value, 0) / 2;
  const deadEnds = walkable.filter(
    (tile) =>
      cardinalNeighbors(tile).filter((next) => walkableSet.has(coordinateKey(next))).length === 1,
  );
  const paths = spawn
    ? room.exits.map((exit) => shortestPath(room, spawn, exit.tile))
    : room.exits.map(() => null);
  const hazards = new Set((room.hazards ?? []).map(coordinateKey));
  const safePaths = spawn
    ? room.exits.map((exit) => shortestPath(room, spawn, exit.tile, hazards))
    : room.exits.map(() => null);
  const clearTiles = walkable.filter(
    (tile) =>
      cardinalNeighbors(tile).filter((next) => walkableSet.has(coordinateKey(next))).length >= 3,
  );
  const entranceClearArea = spawn
    ? walkable.filter((tile) => Math.abs(tile.x - spawn.x) + Math.abs(tile.y - spawn.y) <= 2).length
    : 0;
  return {
    floorArea: walkable.length,
    boundingBoxArea: room.width * room.height,
    floorRatio: walkable.length / Math.max(1, room.width * room.height),
    internalWallCount: room.internalWallTiles?.length ?? 0,
    internalWallCoverage: (room.internalWallTiles?.length ?? 0) / Math.max(1, walkable.length),
    openFloorPercentage: clearTiles.length / Math.max(1, walkable.length),
    connectedRegionCount: regions.length,
    loopCount: Math.max(0, edges - walkable.length + regions.length),
    branchCount: degrees.filter((degree) => degree >= 3).length,
    articulationPointCount: articulationPoints.length,
    articulationPoints,
    deadEndCount: deadEnds.length,
    maximumDeadEndLength: deadEnds.length ? Math.min(5, Math.max(...deadEnds.map(() => 1))) : 0,
    oneTileChokepointCount: articulationPoints.length,
    largestCombatArea: clearTiles.length,
    entranceClearArea,
    entranceToExitDistances: paths.map((path) => (path ? path.length - 1 : -1)),
    safePathDistance: safePaths.find((path) => path)?.length
      ? Math.min(...safePaths.filter(Boolean).map((path) => path!.length - 1))
      : null,
    safeRouteExists: safePaths.some(Boolean),
  };
}

export function deriveOuterWalls(
  floorTiles: readonly TileCoordinate[],
  width: number,
  height: number,
  openings: readonly TileCoordinate[],
  internalWalls: readonly TileCoordinate[] = [],
): TileCoordinate[] {
  const floor = new Set(floorTiles.map(coordinateKey));
  const excluded = new Set(openings.map(coordinateKey));
  const internal = new Set(internalWalls.map(coordinateKey));
  const result = new Map<string, TileCoordinate>();
  for (const tile of floorTiles) {
    for (const next of cardinalNeighbors(tile)) {
      const key = coordinateKey(next);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= width ||
        next.y >= height ||
        floor.has(key) ||
        excluded.has(key) ||
        internal.has(key)
      )
        continue;
      result.set(key, next);
    }
  }
  return [...result.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}
