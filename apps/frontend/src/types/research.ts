import type { AdaptiveProfile, ExperiencePreset } from './adaptation';
import type { RoomCandidateSummary, RoomSelectorId, RoomSelectorVersion } from './generation';
import type { ExitDirection } from './rooms';
import type { RoomArchetype, RoomFeatureVector } from './topology';

export type ResearchCondition = 'RULES_ADAPTIVE' | 'NEUTRAL_PROCEDURAL';
export type ResearchAssignmentUnit = 'per-run' | 'per-session';
export type ResearchSessionStatus = 'active' | 'ended';
export type ResearchRunStatus = 'active' | 'completed' | 'defeated' | 'interrupted';
export type RoomOutcomeStatus = 'completed' | 'defeated' | 'interrupted';
export type DifficultyRating = 'too_easy' | 'about_right' | 'too_hard';
export type FeedbackStatus = 'pending' | 'submitted' | 'skipped' | 'not_requested_due_to_defeat';

export interface ResearchConditionAssignment {
  unit: ResearchAssignmentUnit;
  methodId: 'balanced-two-run-blocks-1';
  sessionSeed: string;
  runIndex: number;
  blockIndex: number;
  roll: number;
  condition: ResearchCondition;
}

export interface RoomFeedback {
  schemaVersion: 'feedback-1';
  status: FeedbackStatus;
  difficulty: DifficultyRating | null;
  fairness: 1 | 2 | 3 | 4 | 5 | null;
  enjoyment: 1 | 2 | 3 | 4 | 5 | null;
  skippedFields: ('fairness' | 'enjoyment')[];
  fullDialogSkipped: boolean;
  submittedAt: string | null;
  responseDurationMs: number | null;
  notRequestedReason: 'defeat' | null;
}

export interface ResearchPerformanceSummary {
  recentDamage: number;
  damageStreak: number;
  recentCombatPressure: number;
  fountainCooldown: number;
  roomsSinceFountainSpawn: number;
  roomsSinceFountainUse: number;
}

export interface RoomResearchOutcome {
  status: RoomOutcomeStatus;
  durationMs: number;
  damageTaken: number;
  runeContacts: number;
  ratsDefeated: number;
  swordAttacks: number;
  blocks: number;
  perfectBlocks: number;
  shieldTimeMs: number;
  movementSteps: number;
  blockedMovement: number;
  floorTilesVisited: number;
  directionChanges: number;
  chosenExitId: string | null;
  outgoingDirection: ExitDirection | null;
  healthAfter: number;
  fountainEncountered: boolean;
  fountainUsed: boolean;
  fountainSkipped: boolean;
  fountainHealthBefore: number | null;
  fountainHealthAfter: number | null;
}

export interface ResearchRoomStartSnapshot {
  researchSchemaVersion: 'research-1';
  roomId: string;
  roomDecisionId: string;
  roomSequence: number;
  enteredAtMs: number;
  capturedAt: string;
  healthBefore: number;
  profileBefore: AdaptiveProfile;
  performance: ResearchPerformanceSummary;
  roomsClearedBefore: number;
}

export interface RoomResearchRecord {
  researchSchemaVersion: 'research-1';
  feedbackSchemaVersion: 'feedback-1';
  researchSessionId: string;
  pilot: boolean;
  participantCode: string | null;
  runId: string;
  roomId: string;
  roomDecisionId: string;
  roomSequence: number;
  capturedAt: string;
  condition: ResearchCondition;
  assignmentMethodId: 'balanced-two-run-blocks-1';
  gameVersion: 'mvp-0.4';
  generatorVersion: 'generator-4';
  adaptationVersion: 'rules-2';
  selectorId: RoomSelectorId;
  selectorVersion: RoomSelectorVersion;
  featureSchemaVersion: number;
  healthBefore: number;
  maximumHealth: number;
  experiencePreset: ExperiencePreset;
  profileBefore: AdaptiveProfile;
  profileAfter: AdaptiveProfile;
  startingProfileSource: 'neutral-session-baseline';
  performance: ResearchPerformanceSummary;
  roomsClearedBefore: number;
  incomingEntranceDirection: ExitDirection;
  sharedPoolId: string;
  requestedCandidateCount: number;
  validCandidateCount: number;
  rejectedCandidateCount: number;
  rejectionCounts: Record<string, number>;
  reducedDiversity: boolean;
  fallbackUsed: boolean;
  topCandidates: RoomCandidateSummary[];
  selectedCandidateId: string;
  selectedRank: number;
  selectedScore: number | null;
  selectedFeatureVector: RoomFeatureVector;
  deterministicRoll: number;
  explanationTokens: string[];
  selectorProfileConsumed: boolean;
  archetype: RoomArchetype;
  boundaryFamily: string;
  exitDirections: ExitDirection[];
  fountainSpawned: boolean;
  fountainPlacement: 'safe' | 'risky' | null;
  safeRouteExists: boolean;
  outcome: RoomResearchOutcome;
  feedback: RoomFeedback;
}

export interface PendingRoomFeedback {
  researchSchemaVersion: 'research-1';
  researchSessionId: string;
  runId: string;
  roomDecisionId: string;
  createdAt: string;
  answersUpdatedAt: string;
  record: RoomResearchRecord;
}

export interface ResearchRun {
  researchSchemaVersion: 'research-1';
  id: string;
  runIndex: number;
  pilot: boolean;
  condition: ResearchCondition;
  assignment: ResearchConditionAssignment;
  startedAt: string;
  endedAt: string | null;
  status: ResearchRunStatus;
  characterId: string;
  experiencePreset: ExperiencePreset;
  rooms: RoomResearchRecord[];
}

export interface ResearchSession {
  researchSchemaVersion: 'research-1';
  id: string;
  pilot: boolean;
  participantCode: string | null;
  sessionSeed: string;
  assignmentUnit: ResearchAssignmentUnit;
  assignmentMethodId: 'balanced-two-run-blocks-1';
  startedAt: string;
  endedAt: string | null;
  status: ResearchSessionStatus;
  startingProfileSource: 'neutral-session-baseline';
  sessionProfile: AdaptiveProfile;
  runs: ResearchRun[];
}

export interface ResearchStorageEnvelope {
  researchSchemaVersion: 'research-1';
  activeSessionId: string | null;
  sessions: ResearchSession[];
}

export interface ResearchExport {
  researchSchemaVersion: 'research-1';
  exportedAt: string;
  scope: 'session' | 'all-sessions';
  sessions: ResearchSession[];
}

export interface ResearchSummaryGroup {
  roomCount: number;
  ratedRooms: number;
  aboutRightCount: number;
  aboutRightRate: number | null;
  tooEasyCount: number;
  tooEasyRate: number | null;
  tooHardCount: number;
  tooHardRate: number | null;
  averageFairness: number | null;
  averageEnjoyment: number | null;
}

export interface ResearchSummary extends ResearchSummaryGroup {
  sessionCount: number;
  runCount: number;
  skippedRooms: number;
  participantCodeCount: number;
  byCondition: Record<ResearchCondition, ResearchSummaryGroup>;
  versionBreakdown: Record<string, number>;
  archetypeDistribution: Record<string, number>;
}
