import type { TileCoordinate } from './rooms';

export const ROOM_FEATURE_SCHEMA_VERSION = 1 as const;
export const ROOM_FEATURE_VECTOR_SCHEMA_VERSION = 1 as const;

export type RoomArchetype =
  | 'open-arena'
  | 'true-l-ruin'
  | 'split-chamber'
  | 'pillar-hall'
  | 'ring-route'
  | 'twin-chambers'
  | 'safe-fallback';

export type BoundaryFamily =
  | 'rectangle'
  | 'cut-corner'
  | 'notched'
  | 'true-l'
  | 't-shape'
  | 'connected-chambers'
  | 'asymmetrical-wing';

export interface BlockingRoomFeature {
  id: string;
  kind: string;
  tile: TileCoordinate;
  blocking: true;
}

export interface DecorativeRoomFeature {
  id: string;
  kind: string;
  tile: TileCoordinate;
  blocking: false;
}

export type RoomFeature = BlockingRoomFeature | DecorativeRoomFeature;

export interface TopologyMetrics {
  floorArea: number;
  boundingBoxArea: number;
  floorRatio: number;
  internalWallCount: number;
  internalWallCoverage: number;
  openFloorPercentage: number;
  connectedRegionCount: number;
  loopCount: number;
  branchCount: number;
  articulationPointCount: number;
  articulationPoints: TileCoordinate[];
  deadEndCount: number;
  maximumDeadEndLength: number;
  oneTileChokepointCount: number;
  largestCombatArea: number;
  entranceClearArea: number;
  entranceToExitDistances: number[];
  safePathDistance: number | null;
  safeRouteExists: boolean;
}

export interface RoomFeatureVector {
  schemaVersion: typeof ROOM_FEATURE_VECTOR_SCHEMA_VERSION;
  archetype: RoomArchetype;
  boundaryFamily: BoundaryFamily;
  width: number;
  height: number;
  floorArea: number;
  floorRatio: number;
  internalWallCoverage: number;
  openFloorPercentage: number;
  shortestExitDistance: number;
  safePathDistance: number;
  directnessRatio: number;
  exitCount: number;
  directionalExitCount: number;
  loopCount: number;
  branchCount: number;
  articulationPointCount: number;
  oneTileChokepointCount: number;
  deadEndCount: number;
  maximumDeadEndLength: number;
  largestCombatArea: number;
  entranceClearArea: number;
  runeCount: number;
  runeDensity: number;
  ratCount: number;
  averageRatSpawnDistance: number;
  contentUnlockLevel: number;
  fallbackUsed: boolean;
}
