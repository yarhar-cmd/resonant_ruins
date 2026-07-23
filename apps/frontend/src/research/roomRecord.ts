import { FEEDBACK_SCHEMA_VERSION, RESEARCH_SCHEMA_VERSION } from '../config/research';
import type { GeneratedRoomSave } from '../types/generation';
import type {
  PendingRoomFeedback,
  ResearchCondition,
  ResearchRoomStartSnapshot,
  ResearchSession,
  ResearchRun,
  RoomFeedback,
  RoomOutcomeStatus,
  RoomResearchRecord,
  ShadowRoomEvidence,
} from '../types/research';
import type { RoomExit } from '../types/rooms';
import type { GameplayState } from '../utils/gameplayState';
import { getResonanceCaches, getRestorationFountains } from '../utils/interactions';

function trailingDamage(snapshots: GameplayState['adaptation']['generatedRoomSignals']): number {
  let count = 0;
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    if (snapshots[index]!.signals.damageTaken <= 0) break;
    count += 1;
  }
  return count;
}

export function roomDecisionId(runId: string, generated: GeneratedRoomSave): string {
  return `${runId}:${generated.dungeonRoomNumber}:${generated.details.selectedCandidateId ?? generated.roomSnapshot.id}`;
}

export function createResearchRoomStart(input: {
  gameplay: GameplayState;
  generated: GeneratedRoomSave;
  sessionProfile: ResearchSession['sessionProfile'];
  capturedAt?: string;
}): ResearchRoomStartSnapshot {
  const dungeon = input.gameplay.dungeonProgress!;
  return {
    researchSchemaVersion: RESEARCH_SCHEMA_VERSION,
    roomId: input.generated.roomSnapshot.id,
    roomDecisionId: roomDecisionId(input.gameplay.runStats.runId!, input.generated),
    roomSequence: input.generated.dungeonRoomNumber,
    enteredAtMs: input.gameplay.evaluationProgress?.roomEnteredAtMs ?? 0,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    healthBefore: input.gameplay.currentHealth,
    resonanceBefore: input.gameplay.resonance,
    profileBefore: { ...input.sessionProfile },
    performance: {
      recentDamage: input.gameplay.adaptation.generatedRoomSignals
        .slice(-3)
        .reduce((sum, snapshot) => sum + snapshot.signals.damageTaken, 0),
      damageStreak: trailingDamage(input.gameplay.adaptation.generatedRoomSignals),
      recentCombatPressure: input.gameplay.enemies.combatMetrics.playerDamageTaken,
      fountainCooldown: dungeon.recovery?.cooldownRemaining ?? 0,
      roomsSinceFountainSpawn: dungeon.recovery?.roomsSinceLastGeneratedSpawn ?? 0,
      roomsSinceFountainUse: dungeon.recovery?.roomsSinceLastUse ?? 0,
    },
    roomsClearedBefore: input.gameplay.runStats.dungeonRoomsCleared,
  };
}

export function pendingFeedback(): RoomFeedback {
  return {
    schemaVersion: FEEDBACK_SCHEMA_VERSION,
    status: 'pending',
    difficulty: null,
    fairness: null,
    enjoyment: null,
    skippedFields: [],
    fullDialogSkipped: false,
    submittedAt: null,
    responseDurationMs: null,
    notRequestedReason: null,
  };
}

export function snapshotTerminalRoomSignals(
  gameplay: GameplayState,
  terminalTimestampMs: number,
): GameplayState['adaptation']['signals'] {
  const shieldTimeMs =
    gameplay.adaptation.shieldStartedAt === null
      ? gameplay.adaptation.signals.shieldTimeMs
      : gameplay.adaptation.signals.shieldTimeMs +
        Math.max(0, terminalTimestampMs - gameplay.adaptation.shieldStartedAt);
  return { ...gameplay.adaptation.signals, shieldTimeMs };
}

export function buildRoomResearchRecord(input: {
  session: ResearchSession;
  run: ResearchRun;
  condition: ResearchCondition;
  gameplay: GameplayState;
  generated: GeneratedRoomSave;
  roomStart: ResearchRoomStartSnapshot;
  profileAfter: ResearchSession['sessionProfile'];
  status: RoomOutcomeStatus;
  exit?: RoomExit;
  terminalElapsedMs: number;
  terminalTimestampMs: number;
  capturedAt?: string;
  feedback?: RoomFeedback;
  shadow?: ShadowRoomEvidence | null;
}): RoomResearchRecord {
  const { generated, gameplay, roomStart } = input;
  const details = generated.details;
  const feature = details.selectedFeatureVector;
  if (!feature) throw new Error('Generated research room is missing its selected feature vector.');
  const fountain = getRestorationFountains(generated.roomSnapshot)[0];
  const fountainRuntime = fountain ? gameplay.interactables[fountain.id] : undefined;
  const cache = getResonanceCaches(generated.roomSnapshot)[0];
  const cacheRuntime = cache ? gameplay.interactables[cache.id] : undefined;
  const reward = details.rewardDecision;
  const signals = snapshotTerminalRoomSignals(gameplay, input.terminalTimestampMs);
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const feedback = input.feedback ?? pendingFeedback();
  return {
    researchSchemaVersion: RESEARCH_SCHEMA_VERSION,
    feedbackSchemaVersion: FEEDBACK_SCHEMA_VERSION,
    researchSessionId: input.session.id,
    pilot: input.session.pilot,
    participantCode: input.session.participantCode,
    runId: input.run.id,
    roomId: generated.roomSnapshot.id,
    roomDecisionId: roomStart.roomDecisionId,
    roomSequence: generated.dungeonRoomNumber,
    capturedAt,
    condition: input.condition,
    assignmentMethodId: input.run.assignment.methodId,
    gameVersion: 'mvp-0.5',
    generatorVersion: 'generator-4',
    adaptationVersion: 'rules-2',
    selectorId: details.selectorId!,
    selectorVersion: details.selectorVersion!,
    featureSchemaVersion: details.featureSchemaVersion ?? feature.schemaVersion,
    healthBefore: roomStart.healthBefore,
    maximumHealth: gameplay.maximumHealth,
    experiencePreset: gameplay.experiencePreset!,
    profileBefore: { ...roomStart.profileBefore },
    profileAfter: { ...input.profileAfter },
    startingProfileSource: input.session.startingProfileSource,
    performance: roomStart.performance,
    roomsClearedBefore: roomStart.roomsClearedBefore,
    incomingEntranceDirection: details.entranceDirection,
    sharedPoolId: details.sharedPoolId!,
    requestedCandidateCount: details.requestedCandidateCount ?? 0,
    validCandidateCount: details.validCandidateCount ?? 0,
    rejectedCandidateCount: details.rejectedCandidateCount ?? 0,
    rejectionCounts: details.rejectionCounts ?? {},
    reducedDiversity: details.reducedDiversity ?? false,
    fallbackUsed: details.fallbackUsed ?? false,
    topCandidates: details.topCandidates ?? [],
    selectedCandidateId: details.selectedCandidateId!,
    selectedRank: details.selectedCandidateRank!,
    selectedScore: details.selectedCandidateScore ?? null,
    selectedFeatureVector: feature,
    deterministicRoll: details.seededSelectionRoll ?? 0,
    explanationTokens: details.selectorExplanation ?? [],
    selectorProfileConsumed: details.selectorProfileConsumed ?? false,
    archetype: feature.archetype,
    boundaryFamily: feature.boundaryFamily,
    exitDirections: generated.roomSnapshot.exits.map((exit) => exit.direction),
    fountainSpawned: Boolean(fountain),
    fountainPlacement: fountain?.placementStyle ?? null,
    safeRouteExists: generated.roomSnapshot.topology?.safeRouteExists ?? true,
    ...(reward
      ? {
          rewardSystemVersion: reward.rewardSystemVersion,
          cacheEligible: reward.eligible,
          eligiblePlacementCount: reward.eligiblePlacementCount,
          cacheSpawnRoll: reward.spawnRoll,
          cacheSpawned: reward.spawned,
          cacheSpawnReason: reward.spawnReason,
          cacheCoordinate: reward.coordinate,
          cachePlacementCategory: reward.placementCategory,
          cacheOptionalRouteScore: reward.optionalRouteScore,
          cacheInteractionTileCount: reward.interactionTiles.length,
        }
      : {}),
    ...(input.shadow ? { shadow: input.shadow } : {}),
    outcome: {
      status: input.status,
      durationMs: Math.max(0, input.terminalElapsedMs - roomStart.enteredAtMs),
      damageTaken: signals.damageTaken,
      runeContacts: signals.runeContacts,
      ratsDefeated: signals.ratsDefeated,
      swordAttacks: signals.swordSwings,
      blocks: gameplay.enemies.combatMetrics.regularBlocks,
      perfectBlocks: gameplay.enemies.combatMetrics.perfectBlocks,
      shieldActivations: signals.shieldActivations,
      shieldTimeMs: signals.shieldTimeMs,
      movementSteps: signals.movementSteps,
      blockedMovement: signals.blockedMovementAttempts,
      floorTilesVisited: new Set(signals.floorTilesVisited).size,
      directionChanges: signals.directionChanges,
      chosenExitId: input.exit?.id ?? null,
      outgoingDirection: input.exit?.direction ?? null,
      healthAfter: gameplay.currentHealth,
      fountainEncountered: fountainRuntime?.encounteredAt != null,
      fountainUsed: fountainRuntime?.depleted ?? false,
      fountainSkipped: Boolean(fountain && !fountainRuntime?.depleted),
      fountainHealthBefore: fountainRuntime?.encounteredAt != null ? roomStart.healthBefore : null,
      fountainHealthAfter: fountainRuntime?.depleted ? gameplay.currentHealth : null,
      ...(reward
        ? {
            cacheEncountered: cacheRuntime?.encounteredAt != null,
            cacheOpened: cacheRuntime?.depleted ?? false,
            cacheSkipped: Boolean(cache && !cacheRuntime?.depleted),
            timeFromRoomStartToOpeningMs:
              cacheRuntime?.usedAt != null
                ? Math.max(
                    0,
                    cacheRuntime.usedAt -
                      ((gameplay.runStats.startedAt ?? cacheRuntime.usedAt) +
                        roomStart.enteredAtMs +
                        gameplay.pause.totalPausedMs),
                  )
                : null,
            healthWhenCacheOpened: cacheRuntime?.healthWhenUsed ?? null,
            resonanceBefore: roomStart.resonanceBefore ?? 0,
            resonanceAfter: gameplay.resonance,
            resonanceEarned: Math.max(0, gameplay.resonance - (roomStart.resonanceBefore ?? 0)),
            cacheChannelCancellationReasons: cacheRuntime?.cancellationReasons ?? [],
          }
        : {}),
    },
    feedback,
  };
}

export function createPendingRoomFeedback(
  record: RoomResearchRecord,
  createdAt = new Date().toISOString(),
): PendingRoomFeedback {
  return {
    researchSchemaVersion: RESEARCH_SCHEMA_VERSION,
    researchSessionId: record.researchSessionId,
    runId: record.runId,
    roomDecisionId: record.roomDecisionId,
    createdAt,
    answersUpdatedAt: createdAt,
    record,
  };
}
