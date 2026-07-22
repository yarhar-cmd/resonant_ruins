import { z } from 'zod';
import { FEEDBACK_SCHEMA_VERSION, RESEARCH_SCHEMA_VERSION } from '../config/research';

const finite = z.number().finite();
const nonnegative = finite.nonnegative();
const normalized = finite.min(0).max(1);
const timestamp = z.string().datetime();
const participantCode = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,32}$/)
  .nullable();
const condition = z.enum(['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL']);
const exitDirection = z.enum(['north', 'east', 'south', 'west']);
const profile = z.object({
  pace: normalized,
  caution: normalized,
  aggression: normalized,
  hazardTolerance: normalized,
  exploration: normalized,
});
const featureVector = z.object({
  schemaVersion: z.number().int().positive(),
  archetype: z.enum([
    'open-arena',
    'true-l-ruin',
    'split-chamber',
    'pillar-hall',
    'ring-route',
    'twin-chambers',
    'safe-fallback',
  ]),
  boundaryFamily: z.string().min(1),
  width: nonnegative,
  height: nonnegative,
  floorArea: nonnegative,
  floorRatio: normalized,
  internalWallCoverage: normalized,
  openFloorPercentage: normalized,
  shortestExitDistance: nonnegative,
  safePathDistance: nonnegative,
  directnessRatio: nonnegative,
  exitCount: nonnegative,
  directionalExitCount: nonnegative,
  loopCount: nonnegative,
  branchCount: nonnegative,
  articulationPointCount: nonnegative,
  oneTileChokepointCount: nonnegative,
  deadEndCount: nonnegative,
  maximumDeadEndLength: nonnegative,
  largestCombatArea: nonnegative,
  entranceClearArea: nonnegative,
  runeCount: nonnegative,
  runeDensity: nonnegative,
  ratCount: nonnegative,
  averageRatSpawnDistance: nonnegative,
  contentUnlockLevel: nonnegative,
  fallbackUsed: z.boolean(),
});
const candidateSummary = z.object({
  id: z.string().min(1),
  rank: z.number().int().nonnegative(),
  score: finite,
  archetype: featureVector.shape.archetype,
  featureVector,
});

export const RoomFeedbackSchema = z
  .object({
    schemaVersion: z.literal(FEEDBACK_SCHEMA_VERSION),
    status: z.enum(['pending', 'submitted', 'skipped', 'not_requested_due_to_defeat']),
    difficulty: z.enum(['too_easy', 'about_right', 'too_hard']).nullable(),
    fairness: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .nullable(),
    enjoyment: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
      .nullable(),
    skippedFields: z.array(z.enum(['fairness', 'enjoyment'])),
    fullDialogSkipped: z.boolean(),
    submittedAt: timestamp.nullable(),
    responseDurationMs: nonnegative.nullable(),
    notRequestedReason: z.literal('defeat').nullable(),
  })
  .superRefine((feedback, context) => {
    if (feedback.status === 'submitted' && feedback.difficulty === null)
      context.addIssue({ code: 'custom', message: 'Submitted feedback requires difficulty.' });
    if (feedback.status === 'skipped' && !feedback.fullDialogSkipped)
      context.addIssue({
        code: 'custom',
        message: 'Skipped feedback must mark the full dialog skipped.',
      });
  });

export const RoomResearchRecordSchema = z.object({
  researchSchemaVersion: z.literal(RESEARCH_SCHEMA_VERSION),
  feedbackSchemaVersion: z.literal(FEEDBACK_SCHEMA_VERSION),
  researchSessionId: z.string().min(1),
  pilot: z.boolean(),
  participantCode,
  runId: z.string().min(1),
  roomId: z.string().min(1),
  roomDecisionId: z.string().min(1),
  roomSequence: z.number().int().positive(),
  capturedAt: timestamp,
  condition,
  assignmentMethodId: z.literal('balanced-two-run-blocks-1'),
  gameVersion: z.enum(['mvp-0.4', 'mvp-0.5']),
  generatorVersion: z.literal('generator-4'),
  adaptationVersion: z.literal('rules-2'),
  selectorId: z.enum(['rules-adaptive', 'neutral-procedural']),
  selectorVersion: z.enum(['rules-selector-1', 'neutral-selector-1']),
  featureSchemaVersion: z.number().int().positive(),
  healthBefore: nonnegative,
  maximumHealth: finite.positive(),
  experiencePreset: z.enum(['new-delver', 'seasoned-adventurer', 'dungeon-veteran']),
  profileBefore: profile,
  profileAfter: profile,
  startingProfileSource: z.literal('neutral-session-baseline'),
  performance: z.object({
    recentDamage: nonnegative,
    damageStreak: nonnegative,
    recentCombatPressure: nonnegative,
    fountainCooldown: nonnegative,
    roomsSinceFountainSpawn: nonnegative,
    roomsSinceFountainUse: nonnegative,
  }),
  roomsClearedBefore: nonnegative,
  incomingEntranceDirection: exitDirection,
  sharedPoolId: z.string().min(1),
  requestedCandidateCount: nonnegative,
  validCandidateCount: nonnegative,
  rejectedCandidateCount: nonnegative,
  rejectionCounts: z.record(z.string(), nonnegative),
  reducedDiversity: z.boolean(),
  fallbackUsed: z.boolean(),
  topCandidates: z.array(candidateSummary),
  selectedCandidateId: z.string().min(1),
  selectedRank: z.number().int().positive(),
  selectedScore: finite.nullable(),
  selectedFeatureVector: featureVector,
  deterministicRoll: finite.min(0).max(1),
  explanationTokens: z.array(z.string()),
  selectorProfileConsumed: z.boolean(),
  archetype: featureVector.shape.archetype,
  boundaryFamily: z.string().min(1),
  exitDirections: z.array(exitDirection),
  fountainSpawned: z.boolean(),
  fountainPlacement: z.enum(['safe', 'risky']).nullable(),
  safeRouteExists: z.boolean(),
  outcome: z.object({
    status: z.enum(['completed', 'defeated', 'interrupted']),
    durationMs: nonnegative,
    damageTaken: nonnegative,
    runeContacts: nonnegative,
    ratsDefeated: nonnegative,
    swordAttacks: nonnegative,
    blocks: nonnegative,
    perfectBlocks: nonnegative,
    shieldTimeMs: nonnegative,
    movementSteps: nonnegative,
    blockedMovement: nonnegative,
    floorTilesVisited: nonnegative,
    directionChanges: nonnegative,
    chosenExitId: z.string().min(1).nullable(),
    outgoingDirection: exitDirection.nullable(),
    healthAfter: nonnegative,
    fountainEncountered: z.boolean(),
    fountainUsed: z.boolean(),
    fountainSkipped: z.boolean(),
    fountainHealthBefore: nonnegative.nullable(),
    fountainHealthAfter: nonnegative.nullable(),
  }),
  feedback: RoomFeedbackSchema,
});

export const PendingRoomFeedbackSchema = z.object({
  researchSchemaVersion: z.literal(RESEARCH_SCHEMA_VERSION),
  researchSessionId: z.string().min(1),
  runId: z.string().min(1),
  roomDecisionId: z.string().min(1),
  createdAt: timestamp,
  answersUpdatedAt: timestamp,
  record: RoomResearchRecordSchema,
});

export const ResearchRoomStartSnapshotSchema = z.object({
  researchSchemaVersion: z.literal(RESEARCH_SCHEMA_VERSION),
  roomId: z.string().min(1),
  roomDecisionId: z.string().min(1),
  roomSequence: z.number().int().positive(),
  enteredAtMs: nonnegative,
  capturedAt: timestamp,
  healthBefore: nonnegative,
  profileBefore: profile,
  performance: z.object({
    recentDamage: nonnegative,
    damageStreak: nonnegative,
    recentCombatPressure: nonnegative,
    fountainCooldown: nonnegative,
    roomsSinceFountainSpawn: nonnegative,
    roomsSinceFountainUse: nonnegative,
  }),
  roomsClearedBefore: nonnegative,
});

export const ResearchConditionAssignmentSchema = z.object({
  unit: z.enum(['per-run', 'per-session']),
  methodId: z.literal('balanced-two-run-blocks-1'),
  sessionSeed: z.string().min(1),
  runIndex: z.number().int().nonnegative(),
  blockIndex: z.number().int().nonnegative(),
  roll: finite.min(0).max(1),
  condition,
});

export const ResearchRunSchema = z.object({
  researchSchemaVersion: z.literal(RESEARCH_SCHEMA_VERSION),
  id: z.string().min(1),
  runIndex: z.number().int().nonnegative(),
  pilot: z.boolean(),
  condition,
  assignment: ResearchConditionAssignmentSchema,
  startedAt: timestamp,
  endedAt: timestamp.nullable(),
  status: z.enum(['active', 'completed', 'defeated', 'interrupted']),
  characterId: z.string().min(1),
  experiencePreset: z.enum(['new-delver', 'seasoned-adventurer', 'dungeon-veteran']),
  rooms: z.array(RoomResearchRecordSchema),
});

export const ResearchSessionSchema = z
  .object({
    researchSchemaVersion: z.literal(RESEARCH_SCHEMA_VERSION),
    id: z.string().min(1),
    pilot: z.boolean(),
    participantCode,
    sessionSeed: z.string().min(1),
    assignmentUnit: z.enum(['per-run', 'per-session']),
    assignmentMethodId: z.literal('balanced-two-run-blocks-1'),
    startedAt: timestamp,
    endedAt: timestamp.nullable(),
    status: z.enum(['active', 'ended']),
    startingProfileSource: z.literal('neutral-session-baseline'),
    sessionProfile: profile,
    runs: z.array(ResearchRunSchema),
  })
  .superRefine((session, context) => {
    const ids = session.runs.flatMap((run) => run.rooms.map((room) => room.roomDecisionId));
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: 'custom',
        message: 'Duplicate roomDecisionId in research session.',
      });
  });

export const ResearchStorageEnvelopeSchema = z.object({
  researchSchemaVersion: z.literal(RESEARCH_SCHEMA_VERSION),
  activeSessionId: z.string().min(1).nullable(),
  sessions: z.array(ResearchSessionSchema),
});

export const ResearchExportSchema = z.object({
  researchSchemaVersion: z.literal(RESEARCH_SCHEMA_VERSION),
  exportedAt: timestamp,
  scope: z.enum(['session', 'all-sessions']),
  sessions: z.array(ResearchSessionSchema),
});
