export interface TileCoordinate {
  x: number;
  y: number;
}

export type ExitDirection = 'north' | 'south' | 'east' | 'west';

export type ExitCondition =
  | { type: 'always' }
  | { type: 'enemies-defeated' }
  | { type: 'switch-activated'; switchId: string }
  | { type: 'item-collected'; itemId: string };

export interface RoomExit {
  id: string;
  direction: ExitDirection;
  tile: TileCoordinate;
  kind: 'standard' | 'shortcut';
  condition: ExitCondition;
  enabled: boolean;
  destination?: { type: 'next-generated-room' };
}

export interface EnemySpawnDefinition {
  id: string;
  type: 'rat';
  tile: TileCoordinate;
  order: number;
  source: 'authored' | 'generated';
  reason: string;
}

export interface RoomDefinition {
  id: string;
  phase: 'evaluation' | 'dungeon';
  width: number;
  height: number;
  floorTiles: TileCoordinate[];
  wallTiles?: TileCoordinate[];
  /** Canonical generator-3 outer boundary. Legacy rooms use wallTiles. */
  outerWallTiles?: TileCoordinate[];
  /** Canonical generator-3 permanent structures. */
  internalWallTiles?: TileCoordinate[];
  exits: RoomExit[];
  spawnPoints?: Partial<Record<ExitDirection, TileCoordinate>>;
  hazards?: TileCoordinate[];
  entrance?: { direction: ExitDirection; tile: TileCoordinate };
  shape?: 'rectangle' | 'l-shape' | 'irregular';
  enemySpawns?: EnemySpawnDefinition[];
  featureSchemaVersion?: 1;
  features?: RoomFeature[];
  archetype?: RoomArchetype;
  boundaryFamily?: BoundaryFamily;
  boundaryModifiers?: string[];
  topology?: TopologyMetrics;
}

export interface EvaluationExitChoice {
  roomId: string;
  roomIndex: number;
  exitId: string;
  direction: ExitDirection;
  enteredAtMs: number;
  exitedAtMs: number;
  timeSpentMs: number;
}

export interface EvaluationProgress {
  roomOrder: string[];
  currentRoomIndex: number;
  currentRoomId: string;
  enteredFrom: ExitDirection | null;
  roomEnteredAtMs: number;
  exitChoices: EvaluationExitChoice[];
  evaluationComplete: boolean;
}
import type { BoundaryFamily, RoomArchetype, RoomFeature, TopologyMetrics } from './topology';
