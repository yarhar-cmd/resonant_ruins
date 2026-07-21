import type { AdaptationVersion, GameVersion, GeneratorVersion } from '../config/version';
import type { AdaptiveProfile, ExperiencePreset } from './adaptation';
import type { ExitDirection, RoomDefinition, TileCoordinate } from './rooms';
import type { EnemyCountPlan } from './enemies';
import type { RoomArchetype, RoomFeatureVector } from './topology';

export const GENERATED_ROOM_SAVE_SCHEMA_VERSION = 1;

export type GeneratedRoomMode = 'reinforce' | 'poke' | 'fallback';
export type GeneratedRoomShape = 'rectangle' | 'l-shape';
export type HazardPattern = 'scattered' | 'clustered';

export interface GeneratedRoomParameters {
  mode: Exclude<GeneratedRoomMode, 'fallback'>;
  shapeWeights: { rectangle: number; lShape: number };
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  exitCountWeights: Record<1 | 2 | 3, number>;
  hazardCountRange: { min: number; max: number };
  hazardPatternWeights: { scattered: number; clustered: number };
  safePathPreference: 'wide' | 'neutral' | 'narrow';
}

export interface GeneratedRoomDetails {
  roomSeed: string;
  generatorVersion: GeneratorVersion;
  shape: GeneratedRoomShape;
  entranceDirection: ExitDirection;
  hazardPattern: HazardPattern;
  mode: GeneratedRoomMode;
  retryCount: number;
  validationErrors: string[];
  reasons: string[];
  enemyCountPlan?: EnemyCountPlan;
  archetype?: RoomArchetype;
  boundaryFamily?: string;
  requestedCandidateCount?: number;
  validCandidateCount?: number;
  rejectedCandidateCount?: number;
  reducedDiversity?: boolean;
  fallbackUsed?: boolean;
  challengedTraits?: (keyof AdaptiveProfile)[];
  selectedCandidateId?: string;
  selectedCandidateRank?: number;
  selectedCandidateScore?: number;
  seededSelectionRoll?: number;
  topCandidates?: RoomCandidateSummary[];
  rejectionCounts?: Record<string, number>;
  featureSchemaVersion?: number;
  exitDecisions?: DirectionalExitDecision[];
}

export interface DirectionalExitDecision {
  exitId: string;
  direction: ExitDirection;
  pathDistance: number;
  safePathDistance: number | null;
  route: 'direct' | 'optional';
}

export interface RoomCandidateSummary {
  id: string;
  rank: number;
  score: number;
  archetype: RoomArchetype;
  featureVector: RoomFeatureVector;
}

export interface GeneratedRoomSave {
  schemaVersion: number;
  generatorVersion: GeneratorVersion;
  gameVersion?: GameVersion | 'mvp-0.2' | 'unknown';
  adaptationVersion?: AdaptationVersion;
  runSeed: string;
  roomSeed: string;
  dungeonRoomNumber: number;
  adaptiveInput: GeneratedRoomParameters;
  roomSnapshot: RoomDefinition;
  details: GeneratedRoomDetails;
}

export interface GenerationRequest {
  runSeed: string;
  dungeonRoomNumber: number;
  chosenExitId: string;
  entranceDirection: ExitDirection;
  experiencePreset: ExperiencePreset;
  effectiveProfile: AdaptiveProfile;
  mode: Exclude<GeneratedRoomMode, 'fallback'>;
  generatorVersion?: GeneratorVersion;
  adaptationVersion?: AdaptationVersion;
  gameVersion?: GameVersion | 'mvp-0.2';
}

export interface RoomValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DungeonProgress {
  runSeed: string;
  dungeonRoomNumber: number;
  currentRoom: GeneratedRoomSave | null;
  enteredFrom: ExitDirection | null;
  chosenExitIds: string[];
  pokeCooldown: number;
  previousMode: Exclude<GeneratedRoomMode, 'fallback'> | null;
  provenance?: RunGenerationProvenance;
  lastChosenExitId?: string | null;
  lastChosenExitDirection?: ExitDirection | null;
  previousEntranceDirection?: ExitDirection | null;
  nextEntranceDirection?: ExitDirection | null;
  recentDecisionRecords?: RoomDecisionRecord[];
  completedDecisionCount?: number;
}

export interface RoomDecisionRecord {
  roomNumber: number;
  roomId: string;
  gameVersion: string;
  generatorVersion: GeneratorVersion;
  adaptationVersion: AdaptationVersion;
  archetype: RoomArchetype | 'legacy';
  featureSchemaVersion: number;
  selectedCandidateId: string | null;
  selectedRank: number | null;
  selectedScore: number | null;
  seededSelectionRoll: number | null;
  topCandidates: RoomCandidateSummary[];
  rejectionCounts: Record<string, number>;
  validCandidateCount: number;
  reducedDiversity: boolean;
  availableExitIds: string[];
  availableExitDirections: ExitDirection[];
  chosenExitId: string;
  chosenExitDirection: ExitDirection;
  previousEntranceDirection: ExitDirection;
  nextEntranceDirection: ExitDirection;
  exitDecisions: DirectionalExitDecision[];
}

export interface GeneratorTransitionRecord {
  roomNumber: number;
  from: GeneratorVersion;
  to: GeneratorVersion;
  reason: 'generator-1-continuation' | 'version-migration';
}

export interface RunGenerationProvenance {
  gameVersion: GameVersion | 'mvp-0.2' | 'unknown';
  adaptationVersion: AdaptationVersion;
  startingGeneratorVersion: GeneratorVersion;
  activeGeneratorVersion: GeneratorVersion;
  mixed: boolean;
  transitions: GeneratorTransitionRecord[];
}

export interface GeneratedExitDestination {
  type: 'next-generated-room';
}

export interface GeneratedEntrance {
  direction: ExitDirection;
  tile: TileCoordinate;
}
