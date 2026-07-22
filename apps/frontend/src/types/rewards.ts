import type { RewardSystemVersion } from '../config/version';
import type { TileCoordinate } from './rooms';

export type CachePlacementCategory =
  | 'optional-dead-end'
  | 'optional-branch'
  | 'side-chamber'
  | 'alcove'
  | 'longer-alternate-route'
  | 'visible-detour';

export type CacheSpawnReason =
  | 'spawned'
  | 'ineligible-no-optional-route'
  | 'roll-failed'
  | 'no-valid-placement'
  | 'authored-room'
  | 'fallback-suppressed'
  | 'sandbox-forced'
  | 'sandbox-disabled'
  | 'invalid-after-validation';

export type RewardGenerationOverride = 'force' | 'disable';

export interface RewardPlacementCandidate {
  coordinate: TileCoordinate;
  placementCategory: CachePlacementCategory;
  optionalRouteScore: number;
  distanceFromEntrance: number;
  distanceFromDirectRoute: number;
  distanceFromNearestExit: number;
  interactionTiles: TileCoordinate[];
}

export interface RewardDecision {
  rewardSystemVersion: RewardSystemVersion;
  enabled: boolean;
  eligible: boolean;
  eligiblePlacementCount: number;
  eligibilityReasons: string[];
  bestPlacementScore: number | null;
  spawnChance: number;
  spawnRoll: number | null;
  spawned: boolean;
  spawnReason: CacheSpawnReason;
  cacheId: string | null;
  coordinate: TileCoordinate | null;
  placementCategory: CachePlacementCategory | null;
  optionalRouteScore: number | null;
  interactionTiles: TileCoordinate[];
}
