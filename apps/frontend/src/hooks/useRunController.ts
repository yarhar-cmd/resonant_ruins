import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ACTIVE_RUN_POSITION_REPAIRED_WARNING,
  ACTIVE_RUN_STORAGE_WARNING,
  RUN_STORAGE_INVALID_WARNING,
  RUN_STORAGE_WARNING,
} from '../components/mirrorvault/StorageWarning';
import { getPlayableCharacterId } from '../data/characterAvailability';
import { getRoomDefinition } from '../data/rooms';
import { EVALUATION_ROOM_1_ID, getEvaluationRoom } from '../data/rooms/evaluationRooms';
import {
  clearActiveRun,
  createActiveRunRecord,
  saveActiveRun,
  toRestorableGameplayRun,
  type ActiveRunRecord,
  type ActiveRunStorageIssue,
} from '../services/activeRunStorage';
import { characters } from '../services/mockAdventureService';
import { createPlayerProfile, savePlayerProfile } from '../services/playerProfileStorage';
import { archiveCompletedRun, createCompletedRunRecord } from '../services/runArchive';
import { getStorageDiagnostics } from '../services/storageDiagnostics';
import type { AdaptiveProfile, PlayerProfileRecord } from '../types/adaptation';
import type { GridPosition } from '../types/player';
import type { RoomDefinition, RoomExit } from '../types/rooms';
import type {
  PendingRoomFeedback,
  ResearchCondition,
  ResearchRoomStartSnapshot,
  ResearchRun,
  ResearchSession,
  RoomFeedback,
  RoomResearchRecord,
} from '../types/research';
import { getRunExecutionPolicy, type RunMode } from '../types/runMode';
import {
  getEffectiveProfileV1,
  getEffectiveProfileV2,
  updateLongTermProfile,
} from '../utils/adaptiveProfile';
import { generateDungeonRoom, oppositeExitDirection } from '../utils/generatedRoomGenerator';
import { chooseGeneratedRoomMode } from '../utils/generatedRoomParameters';
import {
  formatSurvivalTime,
  gameplayReducer,
  getTimeSurvived,
  restoreGameplayState,
  type GameplayAction,
  type GameplayState,
} from '../utils/gameplayState';
import {
  canCrossRoomExit,
  coordinateToGridPosition,
  findSafeSpawn,
  getCollapsedEntrance,
} from '../utils/roomGeometry';
import { formatRoomIndicator, getNextRoom } from '../utils/roomProgression';
import { createFreshRun } from '../utils/runLifecycle';
import { useActiveRunPersistence } from './useActiveRunPersistence';
import { useAdventure } from './useAdventure';
import { useCharacterControls } from './useCharacterControls';
import { useDefeatControls } from './useDefeatControls';
import { useInvulnerabilityTimer } from './useInvulnerabilityTimer';
import { useEnemyClock } from './useEnemyClock';
import { useRoomTransition } from './useRoomTransition';
import { createRoomEnemyState, livingRats } from '../utils/enemySystem';
import { getAvailableInteraction, getFacingRestorationFountain } from '../utils/interactions';
import {
  buildRoomResearchRecord,
  createPendingRoomFeedback,
  createResearchRoomStart,
} from '../research/roomRecord';
import { shouldRequestResearchFeedback } from '../research/roomCompletion';
import {
  RESEARCH_ACTIVE_RUN_KEY,
  RESEARCH_SCHEMA_VERSION,
  FEEDBACK_SCHEMA_VERSION,
} from '../config/research';
import { PLAYTEST_DIAGNOSTICS_ENABLED } from '../config/environment';

function rememberRoom(cache: Map<string, RoomDefinition>, room: RoomDefinition) {
  cache.delete(room.id);
  cache.set(room.id, room);
  while (cache.size > 3) cache.delete(cache.keys().next().value!);
}

function countTrailingDamagedRooms(
  snapshots: readonly { signals: { damageTaken: number } }[],
): number {
  let count = 0;
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    if (snapshots[index]!.signals.damageTaken <= 0) break;
    count += 1;
  }
  return count;
}

export interface RunControllerOptions {
  mode?: RunMode;
  researchCondition?: ResearchCondition;
  researchSessionProfile?: AdaptiveProfile;
  researchSession?: ResearchSession;
  researchRun?: ResearchRun;
  pendingResearchFeedback?: PendingRoomFeedback | null;
  researchRoomStart?: ResearchRoomStartSnapshot | null;
  onResearchSessionProfileChange?: (profile: AdaptiveProfile) => void;
  onResearchRoomStart?: (snapshot: ResearchRoomStartSnapshot) => boolean;
  onResearchPendingChange?: (pending: PendingRoomFeedback | null) => boolean;
  onFinalizeResearchRecord?: (record: RoomResearchRecord) => boolean;
  saveActiveRecord?: (record: ActiveRunRecord) => ActiveRunStorageIssue | null;
  clearActiveRecord?: () => void;
  returnPath?: string;
  researchStorageDiagnostics?: {
    recordCount: number;
    invalidRecordCount: number;
    storageSizeBytes: number;
  };
}

export function useRunController(
  initialRecord: ActiveRunRecord,
  options: RunControllerOptions = {},
) {
  const navigate = useNavigate();
  const runMode = options.mode ?? 'normal';
  const policy = getRunExecutionPolicy(runMode);
  const { settings, playerProfile, setPlayerProfile } = useAdventure();
  const playableCharacterId = getPlayableCharacterId(initialRecord.characterId);
  const character = characters.find((item) => item.id === playableCharacterId) ?? characters[0]!;
  const [gameplay, dispatchGameplay] = useReducer(gameplayReducer, undefined, () =>
    restoreGameplayState(
      toRestorableGameplayRun(initialRecord),
      initialRecord.maximumHealth,
      Date.now(),
    ),
  );
  const [hiddenResultsRunId, setHiddenResultsRunId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState(
    initialRecord.positionRepaired ? ACTIVE_RUN_POSITION_REPAIRED_WARNING : '',
  );
  const [showAwakeningComplete, setShowAwakeningComplete] = useState(false);
  const [debugProfileOverride, setDebugProfileOverride] = useState<AdaptiveProfile | null>(null);
  const [clockNow, setClockNow] = useState(Date.now);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [debugInterfaceOpen, setDebugInterfaceOpenState] = useState(false);
  const [pendingResearchFeedback, setPendingResearchFeedback] = useState(
    options.pendingResearchFeedback ?? null,
  );
  const [researchRoomStart, setResearchRoomStart] = useState(options.researchRoomStart ?? null);
  const [finalizedResearchRecordCount, setFinalizedResearchRecordCount] = useState(0);
  const [lastFinalizedResearchRecordId, setLastFinalizedResearchRecordId] = useState<string | null>(
    null,
  );
  const debugOpenedAtRef = useRef<number | null>(null);
  const actionSequence = useRef(0);
  const gameRegionRef = useRef<HTMLDivElement>(null);
  const archivedRunIdsRef = useRef(new Set<string>());
  const defeatedResearchRoomIdsRef = useRef(new Set<string>());
  const researchProfileRef = useRef(options.researchSessionProfile);
  const roomSnapshotsRef = useRef(new Map<string, RoomDefinition>());
  const setDebugInterfaceOpen = useCallback(
    (open: boolean) => {
      const now = Date.now();
      if (open && debugOpenedAtRef.current === null) debugOpenedAtRef.current = now;
      if (!open && debugOpenedAtRef.current !== null) {
        dispatchGameplay({
          type: 'shift-enemy-timers',
          duration: Math.max(0, now - debugOpenedAtRef.current),
        });
        debugOpenedAtRef.current = null;
      }
      setDebugInterfaceOpenState(open);
    },
    [dispatchGameplay],
  );

  const progress = gameplay.evaluationProgress;
  const generatedSave = gameplay.dungeonProgress?.currentRoom ?? null;
  const currentRoomId =
    generatedSave?.roomSnapshot.id ?? progress?.currentRoomId ?? EVALUATION_ROOM_1_ID;
  const currentRoom =
    generatedSave?.roomSnapshot ??
    getEvaluationRoom(currentRoomId, playerProfile?.shortcutUnlocked) ??
    getRoomDefinition(EVALUATION_ROOM_1_ID)!;
  rememberRoom(roomSnapshotsRef.current, currentRoom);
  const inGeneratedDungeon = Boolean(generatedSave);
  const roomLabel = inGeneratedDungeon
    ? `Dungeon Room ${generatedSave!.dungeonRoomNumber}`
    : formatRoomIndicator(currentRoom.id, progress?.currentRoomIndex ?? 0);
  const defeated = gameplay.status === 'defeated';
  const resultsVisible = defeated && hiddenResultsRunId !== gameplay.runStats.runId;
  const roomTransition = useRoomTransition({
    currentRoomId,
    runId: gameplay.runStats.runId,
    reducedMotion: settings.reducedMotion,
  });
  const renderedRoom = roomSnapshotsRef.current.get(roomTransition.renderedRoomId) ?? currentRoom;
  const livingEnemyCount = livingRats(gameplay.enemies).length;
  const availableInteraction = useMemo(
    () =>
      getAvailableInteraction({
        room: currentRoom,
        player: gameplay.player,
        currentHealth: gameplay.currentHealth,
        maximumHealth: gameplay.maximumHealth,
        enemies: gameplay.enemies,
        runtime: gameplay.interactables,
      }),
    [
      currentRoom,
      gameplay.currentHealth,
      gameplay.enemies,
      gameplay.interactables,
      gameplay.maximumHealth,
      gameplay.player,
    ],
  );

  useEffect(() => {
    if (
      runMode !== 'research' ||
      !generatedSave ||
      !options.researchSession ||
      !researchProfileRef.current ||
      researchRoomStart?.roomId === generatedSave.roomSnapshot.id
    )
      return;
    const snapshot = createResearchRoomStart({
      gameplay,
      generated: generatedSave,
      sessionProfile: researchProfileRef.current,
    });
    if (options.onResearchRoomStart?.(snapshot)) setResearchRoomStart(snapshot);
  }, [gameplay, generatedSave, options, researchRoomStart?.roomId, runMode]);

  useEffect(() => {
    if (
      runMode !== 'research' ||
      gameplay.status !== 'defeated' ||
      !generatedSave ||
      !researchRoomStart ||
      !options.researchSession ||
      !options.researchRun ||
      defeatedResearchRoomIdsRef.current.has(researchRoomStart.roomDecisionId)
    )
      return;
    const record = buildRoomResearchRecord({
      session: options.researchSession,
      run: options.researchRun,
      condition: options.researchRun.condition,
      gameplay,
      generated: generatedSave,
      roomStart: researchRoomStart,
      profileAfter: gameplay.adaptation.currentRunProfile,
      status: 'defeated',
      capturedAt: new Date(
        (gameplay.runStats.startedAt ?? 0) + (gameplay.runStats.timeSurvived ?? 0),
      ).toISOString(),
    });
    if (options.onFinalizeResearchRecord?.(record)) {
      defeatedResearchRoomIdsRef.current.add(researchRoomStart.roomDecisionId);
      setFinalizedResearchRecordCount((count) => count + 1);
      setLastFinalizedResearchRecordId(record.roomDecisionId);
      options.onResearchPendingChange?.(null);
    }
  }, [gameplay, generatedSave, options, researchRoomStart, runMode]);

  useEnemyClock({
    enabled: Boolean(
      gameplay.status === 'active' &&
      gameplay.enemies.rats.length > 0 &&
      !gameplay.pause.isPaused &&
      !roomTransition.isTransitioning &&
      !debugInterfaceOpen,
    ),
    room: currentRoom,
    onTick: (timestamp, room) => dispatchGameplay({ type: 'enemy-tick', timestamp, room }),
  });

  useEffect(() => {
    if (
      gameplay.interaction.status !== 'channeling' ||
      gameplay.pause.isPaused ||
      gameplay.status !== 'active' ||
      roomTransition.isTransitioning ||
      debugInterfaceOpen
    )
      return;
    const tick = () =>
      dispatchGameplay({ type: 'interaction-tick', timestamp: Date.now(), room: currentRoom });
    tick();
    const timer = window.setInterval(tick, 50);
    return () => window.clearInterval(timer);
  }, [
    currentRoom,
    gameplay.interaction.status,
    gameplay.pause.isPaused,
    gameplay.status,
    roomTransition.isTransitioning,
    debugInterfaceOpen,
  ]);

  useEffect(() => {
    if (policy.writePermanentProfile && !playerProfile) {
      const recovered = createPlayerProfile(
        initialRecord.experiencePreset ?? 'seasoned-adventurer',
      );
      setPlayerProfile(recovered);
      savePlayerProfile(recovered);
    }
  }, [
    initialRecord.experiencePreset,
    playerProfile,
    policy.writePermanentProfile,
    setPlayerProfile,
  ]);

  useEffect(() => {
    if (!storageWarning) return;
    const timer = window.setTimeout(() => setStorageWarning(''), 5_000);
    return () => window.clearTimeout(timer);
  }, [storageWarning]);

  useEffect(() => {
    if (gameplay.status !== 'active' || gameplay.pause.isPaused) return;
    setClockNow(Date.now());
    const timer = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [gameplay.pause.isPaused, gameplay.status]);

  useEffect(() => {
    const { runId, startedAt, timeSurvived, dungeonRoomsCleared, enemiesDefeated } =
      gameplay.runStats;
    if (
      !policy.writeNormalHistory ||
      gameplay.status !== 'defeated' ||
      !runId ||
      startedAt === null ||
      timeSurvived === null ||
      archivedRunIdsRef.current.has(runId)
    )
      return;
    archivedRunIdsRef.current.add(runId);
    const result = archiveCompletedRun(
      createCompletedRunRecord({
        id: runId,
        characterId: playableCharacterId,
        experiencePreset: gameplay.experiencePreset ?? 'unknown',
        endedAt: new Date(startedAt + timeSurvived + gameplay.pause.totalPausedMs).toISOString(),
        timeSurvivedMs: timeSurvived,
        dungeonRoomsCleared,
        enemiesDefeated,
        gameVersion: gameplay.dungeonProgress?.provenance?.gameVersion ?? 'unknown',
        generatorVersions: gameplay.dungeonProgress?.provenance
          ? [
              gameplay.dungeonProgress.provenance.startingGeneratorVersion,
              gameplay.dungeonProgress.provenance.activeGeneratorVersion,
            ]
          : [],
        adaptationVersions: gameplay.dungeonProgress?.provenance
          ? [gameplay.dungeonProgress.provenance.adaptationVersion]
          : [],
        mixedGeneratorProvenance: gameplay.dungeonProgress?.provenance?.mixed ?? false,
      }),
    );
    if (result.issue === 'invalid') setStorageWarning(RUN_STORAGE_INVALID_WARNING);
    if (result.issue === 'unavailable' || result.issue === 'write-failed')
      setStorageWarning(RUN_STORAGE_WARNING);
  }, [
    gameplay.dungeonProgress,
    gameplay.experiencePreset,
    gameplay.pause.totalPausedMs,
    gameplay.runStats,
    gameplay.status,
    playableCharacterId,
    policy.writeNormalHistory,
  ]);

  useInvulnerabilityTimer({
    status: roomTransition.isTransitioning || gameplay.pause.isPaused ? 'idle' : gameplay.status,
    expiresAt: gameplay.invulnerability.expiresAt,
    runId: gameplay.runStats.runId,
    onExpire: ({ runId, expectedExpiresAt, timestamp }) =>
      dispatchGameplay({ type: 'invulnerability-expired', runId, expectedExpiresAt, timestamp }),
  });

  const handleActiveRunIssue = useCallback(() => setStorageWarning(ACTIVE_RUN_STORAGE_WARNING), []);
  const saveNow = useActiveRunPersistence({
    gameplay,
    characterId: playableCharacterId,
    enabled: policy.writeNormalActiveRun || policy.writeResearchActiveRun,
    saveRecord: options.saveActiveRecord,
    onIssue: handleActiveRunIssue,
    onSaved: setLastSavedAt,
  });
  const persistGameplayState = useCallback(
    (next: GameplayState, now: number) => {
      const record = createActiveRunRecord(next, playableCharacterId, now);
      if (!record) return false;
      const issue = options.saveActiveRecord
        ? options.saveActiveRecord(record)
        : policy.writeNormalActiveRun
          ? saveActiveRun(record)
          : null;
      if (issue) {
        setStorageWarning(ACTIVE_RUN_STORAGE_WARNING);
        return false;
      }
      setLastSavedAt(now);
      return true;
    },
    [options, playableCharacterId, policy.writeNormalActiveRun],
  );

  function nextActionId(prefix: 'move' | 'attack') {
    actionSequence.current += 1;
    return `${prefix}-${actionSequence.current}`;
  }

  function saveProfile(next: PlayerProfileRecord) {
    if (!policy.writePermanentProfile) {
      if (policy.writeResearchSessionProfile)
        options.onResearchSessionProfileChange?.(next.longTermProfile);
      return;
    }
    setPlayerProfile(next);
    if (savePlayerProfile(next)) setStorageWarning(ACTIVE_RUN_STORAGE_WARNING);
  }

  function generateDestination(
    exit: RoomExit,
    dungeonRoomNumber: number,
    profile: AdaptiveProfile,
    longTermProfile = (runMode === 'research'
      ? researchProfileRef.current
      : playerProfile?.longTermProfile) ?? profile,
  ) {
    const dungeon = gameplay.dungeonProgress!;
    const scheduled = chooseGeneratedRoomMode({
      runSeed: dungeon.runSeed,
      dungeonRoomNumber,
      experiencePreset: gameplay.experiencePreset!,
      previousMode: dungeon.previousMode,
      pokeCooldown: dungeon.pokeCooldown,
    });
    const pinnedGenerator = dungeon.provenance?.activeGeneratorVersion ?? 'generator-2';
    const generatorVersion = pinnedGenerator === 'generator-1' ? 'generator-2' : pinnedGenerator;
    const adaptationVersion =
      generatorVersion === 'generator-3' || generatorVersion === 'generator-4'
        ? 'rules-2'
        : 'rules-1';
    const effectiveProfile =
      adaptationVersion === 'rules-2'
        ? getEffectiveProfileV2(longTermProfile, profile)
        : getEffectiveProfileV1(longTermProfile, profile, dungeonRoomNumber);
    const entranceDirection = oppositeExitDirection(exit.direction);
    const generatedRoom = generateDungeonRoom({
      runSeed: dungeon.runSeed,
      dungeonRoomNumber,
      chosenExitId: exit.id,
      entranceDirection,
      experiencePreset: gameplay.experiencePreset!,
      effectiveProfile,
      mode: scheduled.mode,
      generatorVersion,
      adaptationVersion,
      gameVersion:
        generatorVersion === 'generator-4'
          ? 'mvp-0.4'
          : generatorVersion === 'generator-3'
            ? 'mvp-0.3'
            : 'mvp-0.2',
      selectorId:
        runMode === 'research' && options.researchCondition === 'NEUTRAL_PROCEDURAL'
          ? 'neutral-procedural'
          : 'rules-adaptive',
      recentArchetypes: (dungeon.recentDecisionRecords ?? [])
        .map((record) => record.archetype)
        .filter((archetype) => archetype !== 'legacy'),
      recovery:
        generatorVersion === 'generator-3' || generatorVersion === 'generator-4'
          ? {
              currentHealth: gameplay.currentHealth,
              maximumHealth: gameplay.maximumHealth,
              recentGeneratedDamage: gameplay.adaptation.generatedRoomSignals
                .slice(-3)
                .map((snapshot) => snapshot.signals.damageTaken),
              damageStreak: countTrailingDamagedRooms(gameplay.adaptation.generatedRoomSignals),
              roomsSinceLastGeneratedSpawn: dungeon.recovery?.roomsSinceLastGeneratedSpawn ?? 3,
              roomsSinceLastUse: dungeon.recovery?.roomsSinceLastUse ?? 3,
              previousSkipped: dungeon.recovery?.previousSkipped ?? false,
              recentCombatPressure: gameplay.enemies.combatMetrics.playerDamageTaken,
              cooldownRemaining: dungeon.recovery?.cooldownRemaining ?? 0,
            }
          : undefined,
    });
    rememberRoom(roomSnapshotsRef.current, generatedRoom.roomSnapshot);
    return { generatedRoom, entranceDirection, scheduled, effectiveProfile };
  }

  function commitExitTransition(exit: RoomExit, feedbackFinalized = false) {
    if (
      !progress ||
      !gameplay.dungeonProgress ||
      gameplay.status !== 'active' ||
      gameplay.pause.isPaused ||
      roomTransition.isTransitioning
    )
      return;
    const now = Date.now();
    const exitedAtMs = getTimeSurvived(gameplay.runStats, now, gameplay.pause);
    if (
      shouldRequestResearchFeedback({
        runMode,
        roomPhase: currentRoom.phase,
        feedbackFinalized,
        pendingFeedback: Boolean(pendingResearchFeedback),
        livingEnemyCount,
        hasGeneratedSave: Boolean(generatedSave),
        hasRoomStart: Boolean(researchRoomStart),
        hasResearchContext: Boolean(options.researchSession && options.researchRun),
      }) &&
      generatedSave &&
      researchRoomStart &&
      options.researchSession &&
      options.researchRun
    ) {
      const preview = gameplayReducer(gameplay, {
        type: 'commit-room-transition',
        destinationRoomId: currentRoom.id,
        destinationRoomIndex: progress.currentRoomIndex,
        destinationSpawn: gameplay.player.position,
        enteredFrom: progress.enteredFrom ?? 'west',
        exitedAtMs,
        exitChoice: null,
        evaluationComplete: progress.evaluationComplete,
        exitDirection: exit.direction,
      });
      const record = buildRoomResearchRecord({
        session: options.researchSession,
        run: options.researchRun,
        condition: options.researchRun.condition,
        gameplay,
        generated: generatedSave,
        roomStart: researchRoomStart,
        profileAfter: preview.adaptation.currentRunProfile,
        status: 'completed',
        exit,
      });
      const pending = createPendingRoomFeedback(record);
      if (options.onResearchPendingChange?.(pending)) setPendingResearchFeedback(pending);
      return;
    }
    const exitChoice =
      currentRoom.phase === 'evaluation'
        ? {
            roomId: currentRoom.id,
            roomIndex: progress.currentRoomIndex + 1,
            exitId: exit.id,
            direction: exit.direction,
            enteredAtMs: progress.roomEnteredAtMs,
            exitedAtMs,
            timeSpentMs: Math.max(0, exitedAtMs - progress.roomEnteredAtMs),
          }
        : null;
    const shortcut = exit.kind === 'shortcut';
    const completingChambers =
      currentRoom.phase === 'evaluation' && progress.currentRoomIndex === 4;

    let action: GameplayAction;
    if (currentRoom.phase === 'dungeon' || shortcut || completingChambers) {
      const nextNumber =
        currentRoom.phase === 'dungeon' ? gameplay.dungeonProgress.dungeonRoomNumber + 1 : 1;
      const profilePreviewAction: GameplayAction = {
        type: 'commit-room-transition',
        destinationRoomId: currentRoom.id,
        destinationRoomIndex: progress.currentRoomIndex,
        destinationSpawn: gameplay.player.position,
        enteredFrom: progress.enteredFrom ?? 'west',
        exitedAtMs,
        exitChoice,
        evaluationComplete: progress.evaluationComplete,
        exitDirection: exit.direction,
      };
      const profileForRoom =
        debugProfileOverride ??
        gameplayReducer(gameplay, profilePreviewAction).adaptation.currentRunProfile;
      const profileSource =
        runMode === 'research' ? researchProfileRef.current : playerProfile?.longTermProfile;
      const updatedLongTerm = profileSource
        ? updateLongTermProfile(profileSource, profileForRoom)
        : playerProfile
          ? updateLongTermProfile(playerProfile.longTermProfile, profileForRoom)
          : profileForRoom;
      const { generatedRoom, entranceDirection, scheduled, effectiveProfile } = generateDestination(
        exit,
        nextNumber,
        profileForRoom,
        updatedLongTerm,
      );
      action = {
        type: 'commit-room-transition',
        destinationRoomId: generatedRoom.roomSnapshot.id,
        destinationRoomIndex: 5,
        destinationSpawn: coordinateToGridPosition(
          findSafeSpawn(generatedRoom.roomSnapshot, entranceDirection),
        ),
        enteredFrom: entranceDirection,
        exitedAtMs,
        exitChoice,
        evaluationComplete: true,
        generatedRoom,
        incrementDungeonRooms: currentRoom.phase === 'dungeon',
        chosenExitId: exit.id,
        nextPokeCooldown: scheduled.nextPokeCooldown,
        nextMode: scheduled.mode,
        exitDirection: exit.direction,
        effectiveProfile,
        enemies: createRoomEnemyState(
          generatedRoom.roomSnapshot,
          gameplay.experiencePreset!,
          now,
          generatedRoom.details.enemyCountPlan ?? null,
        ),
        destinationRoom: generatedRoom.roomSnapshot,
      };
    } else {
      const next = getNextRoom(progress.roomOrder, progress.currentRoomIndex);
      if (!next || next.evaluationComplete) return;
      const destination = getEvaluationRoom(next.roomId, playerProfile?.shortcutUnlocked);
      if (!destination) return;
      rememberRoom(roomSnapshotsRef.current, destination);
      action = {
        type: 'commit-room-transition',
        destinationRoomId: destination.id,
        destinationRoomIndex: next.roomIndex,
        destinationSpawn: coordinateToGridPosition(findSafeSpawn(destination, 'west')),
        enteredFrom: 'west',
        exitedAtMs,
        exitChoice,
        evaluationComplete: false,
        exitDirection: exit.direction,
        enemies: createRoomEnemyState(destination, gameplay.experiencePreset!, now),
        destinationRoom: destination,
      };
    }

    const nextGameplay = gameplayReducer(gameplay, action);
    if (policy.writePermanentProfile && completingChambers && playerProfile) {
      saveProfile({
        ...playerProfile,
        shortcutUnlocked: true,
        longTermProfile: updateLongTermProfile(
          playerProfile.longTermProfile,
          nextGameplay.adaptation.currentRunProfile,
        ),
        metadata: {
          completedAdaptiveRooms: playerProfile.metadata.completedAdaptiveRooms,
          updatedAt: new Date().toISOString(),
        },
      });
    } else if (policy.writePermanentProfile && currentRoom.phase === 'dungeon' && playerProfile) {
      saveProfile({
        ...playerProfile,
        longTermProfile: updateLongTermProfile(
          playerProfile.longTermProfile,
          nextGameplay.adaptation.currentRunProfile,
        ),
        metadata: {
          completedAdaptiveRooms: playerProfile.metadata.completedAdaptiveRooms + 1,
          updatedAt: new Date().toISOString(),
        },
      });
    } else if (
      policy.writeResearchSessionProfile &&
      (currentRoom.phase === 'dungeon' || completingChambers)
    ) {
      researchProfileRef.current = nextGameplay.adaptation.currentRunProfile;
      options.onResearchSessionProfileChange?.(nextGameplay.adaptation.currentRunProfile);
    }
    roomTransition.beginTransition({
      destinationRoomId: action.destinationRoomId,
      commit: () => {
        dispatchGameplay(action);
        persistGameplayState(nextGameplay, now);
        if (completingChambers) setShowAwakeningComplete(true);
      },
    });
  }

  const controls = useCharacterControls({
    enabled: Boolean(
      gameplay.status === 'active' &&
      !gameplay.pause.isPaused &&
      !roomTransition.isTransitioning &&
      !pendingResearchFeedback &&
      !debugInterfaceOpen,
    ),
    onMove: (direction, trigger) => {
      const exit = canCrossRoomExit(
        currentRoom,
        gameplay.player.position,
        direction,
        livingEnemyCount,
      );
      if (exit) commitExitTransition(exit);
      else
        dispatchGameplay({
          type: 'move',
          direction,
          trigger,
          id: nextActionId('move'),
          timestamp: Date.now(),
          room: currentRoom,
        });
    },
    onTurn: (direction, trigger) =>
      dispatchGameplay({ type: 'turn', direction, trigger, timestamp: Date.now() }),
    onAttack: () => {
      const timestamp = Date.now();
      if (gameplay.attackCooldown.readyAt !== null && timestamp < gameplay.attackCooldown.readyAt)
        return false;
      dispatchGameplay({
        type: 'attack',
        id: nextActionId('attack'),
        timestamp,
        room: currentRoom,
      });
      return true;
    },
    onShieldChange: (isShielding) =>
      dispatchGameplay({ type: 'shield', isShielding, timestamp: Date.now() }),
    onInteract: () => {
      if (!availableInteraction) {
        const facingFountain = getFacingRestorationFountain(currentRoom, gameplay.player);
        if (
          facingFountain &&
          gameplay.currentHealth >= gameplay.maximumHealth &&
          !gameplay.interactables[facingFountain.id]?.depleted
        ) {
          dispatchGameplay({
            type: 'interaction-unavailable-feedback',
            timestamp: Date.now(),
            targetId: facingFountain.id,
          });
          return true;
        }
        return false;
      }
      dispatchGameplay({
        type: 'start-interaction',
        timestamp: Date.now(),
        room: currentRoom,
        targetId: availableInteraction.id,
      });
      return true;
    },
  });

  const restartRun = useCallback(() => {
    if (runMode === 'research') {
      options.clearActiveRecord?.();
      navigate(options.returnPath ?? '/research', { replace: true });
      return;
    }
    const preset = gameplay.experiencePreset ?? playerProfile?.experiencePreset;
    if (!preset) {
      clearActiveRun();
      navigate('/dungeon', { replace: true });
      return;
    }
    const now = Date.now();
    const next = createFreshRun({
      maximumHealth: character.health,
      experiencePreset: preset,
      longTermProfile: playerProfile?.longTermProfile,
      shortcutUnlocked: playerProfile?.shortcutUnlocked,
      startedAt: now,
    });
    actionSequence.current = 0;
    setHiddenResultsRunId(null);
    setShowAwakeningComplete(false);
    setDebugProfileOverride(null);
    dispatchGameplay({
      type: 'start-run',
      maximumHealth: next.maximumHealth,
      startedAt: next.runStats.startedAt!,
      runId: next.runStats.runId!,
      runSeed: next.dungeonProgress!.runSeed,
      experiencePreset: preset,
      longTermProfile: playerProfile?.longTermProfile,
      roomOrder: next.evaluationProgress!.roomOrder,
      currentRoomId: next.evaluationProgress!.currentRoomId,
      spawn: next.player.position,
      room: getEvaluationRoom(
        next.evaluationProgress!.currentRoomId,
        playerProfile?.shortcutUnlocked,
      )!,
    });
    persistGameplayState(next, now);
  }, [
    character.health,
    gameplay.experiencePreset,
    navigate,
    options,
    persistGameplayState,
    playerProfile,
    runMode,
  ]);

  const toggleResults = useCallback(
    () =>
      setHiddenResultsRunId((current) =>
        current === gameplay.runStats.runId ? null : gameplay.runStats.runId,
      ),
    [gameplay.runStats.runId],
  );
  useDefeatControls({
    defeated,
    gameRegionRef,
    onRestart: restartRun,
    onToggleResults: toggleResults,
  });

  const pauseRun = useCallback(() => {
    if (gameplay.status !== 'active' || gameplay.pause.isPaused || roomTransition.isTransitioning)
      return false;
    const now = Date.now();
    const action: GameplayAction = { type: 'pause-run', timestamp: now, reason: 'pause-menu' };
    const next = gameplayReducer(gameplay, action);
    dispatchGameplay(action);
    persistGameplayState(next, now);
    setClockNow(now);
    return true;
  }, [gameplay, persistGameplayState, roomTransition.isTransitioning]);

  const resumeRun = useCallback(() => {
    if (gameplay.status !== 'active' || !gameplay.pause.isPaused) return false;
    const now = Date.now();
    const action: GameplayAction = { type: 'resume-run', timestamp: now };
    const next = gameplayReducer(gameplay, action);
    dispatchGameplay(action);
    persistGameplayState(next, now);
    setClockNow(now);
    return true;
  }, [gameplay, persistGameplayState]);

  const openSettings = useCallback(() => {
    saveNow();
    navigate('/settings');
  }, [navigate, saveNow]);

  const returnToMainMenuPreservingRun = useCallback(() => {
    saveNow();
    navigate(runMode === 'research' ? (options.returnPath ?? '/research') : '/');
  }, [navigate, options.returnPath, runMode, saveNow]);

  const returnToMainMenuAfterDefeat = useCallback(() => {
    if (runMode === 'research') options.clearActiveRecord?.();
    else clearActiveRun();
    navigate(runMode === 'research' ? (options.returnPath ?? '/research') : '/');
  }, [navigate, options, runMode]);

  function updateResearchFeedback(feedback: RoomFeedback) {
    if (!pendingResearchFeedback) return false;
    const pending: PendingRoomFeedback = {
      ...pendingResearchFeedback,
      answersUpdatedAt: new Date().toISOString(),
      record: { ...pendingResearchFeedback.record, feedback },
    };
    if (!options.onResearchPendingChange?.(pending)) return false;
    setPendingResearchFeedback(pending);
    return true;
  }

  function finalizeResearchFeedback(feedback: RoomFeedback) {
    if (!pendingResearchFeedback) return false;
    const record: RoomResearchRecord = { ...pendingResearchFeedback.record, feedback };
    if (!options.onFinalizeResearchRecord?.(record)) return false;
    if (!options.onResearchPendingChange?.(null)) return false;
    const exit = currentRoom.exits.find(
      (candidate) => candidate.id === record.outcome.chosenExitId,
    );
    if (!exit) return false;
    researchProfileRef.current = record.profileAfter;
    setFinalizedResearchRecordCount((count) => count + 1);
    setLastFinalizedResearchRecordId(record.roomDecisionId);
    setPendingResearchFeedback(null);
    setResearchRoomStart(null);
    commitExitTransition(exit, true);
    return true;
  }

  const frozenTime = formatSurvivalTime(
    getTimeSurvived(gameplay.runStats, clockNow, gameplay.pause),
  );
  const renderedHazards: GridPosition[] = (renderedRoom.hazards ?? []).map(
    coordinateToGridPosition,
  );
  const collapsedEntrance = getCollapsedEntrance(
    renderedRoom,
    generatedSave?.details.entranceDirection ?? progress?.enteredFrom ?? 'west',
  );

  return {
    gameplay,
    runMode,
    runPolicy: policy,
    researchDiagnostics:
      PLAYTEST_DIAGNOSTICS_ENABLED &&
      runMode === 'research' &&
      options.researchSession &&
      options.researchRun
        ? {
            runMode,
            pilot: options.researchSession.pilot,
            sessionId: options.researchSession.id,
            participantCodePresent: Boolean(options.researchSession.participantCode),
            condition: options.researchRun.condition,
            assignmentMethod: options.researchRun.assignment.methodId,
            selectorId: generatedSave?.details.selectorId ?? 'not-generated',
            selectorVersion: generatedSave?.details.selectorVersion ?? 'not-generated',
            profileConsumed: generatedSave?.details.selectorProfileConsumed ?? false,
            sharedPoolId: generatedSave?.details.sharedPoolId ?? 'not-generated',
            requestedCandidateCount: generatedSave?.details.requestedCandidateCount ?? 0,
            validCandidateCount: generatedSave?.details.validCandidateCount ?? 0,
            rejectedCandidateCount: generatedSave?.details.rejectedCandidateCount ?? 0,
            pendingFeedbackRoom: pendingResearchFeedback?.record.roomId ?? null,
            pendingOutcomeStatus: pendingResearchFeedback?.record.outcome.status ?? null,
            finalizedRecordStatus:
              pendingResearchFeedback !== null
                ? ('pending' as const)
                : lastFinalizedResearchRecordId
                  ? ('finalized' as const)
                  : ('none' as const),
            recordCount:
              (options.researchStorageDiagnostics?.recordCount ?? 0) + finalizedResearchRecordCount,
            invalidRecordCount: options.researchStorageDiagnostics?.invalidRecordCount ?? 0,
            researchSchema: RESEARCH_SCHEMA_VERSION,
            feedbackSchema: FEEDBACK_SCHEMA_VERSION,
            storageSizeBytes: options.researchStorageDiagnostics?.storageSizeBytes ?? 0,
            activePersistenceKey: RESEARCH_ACTIVE_RUN_KEY,
            writePolicy: policy,
          }
        : null,
    pendingResearchFeedback,
    updateResearchFeedback,
    finalizeResearchFeedback,
    character,
    currentRoom,
    renderedRoom,
    renderedHazards,
    collapsedEntrance,
    roomLabel,
    inGeneratedDungeon,
    defeated,
    resultsVisible,
    roomTransition,
    controls,
    availableInteraction,
    visualEffects: settings.visualEffects,
    reducedMotion: settings.reducedMotion,
    gameRegionRef,
    storageWarning,
    clearStorageWarning: () => setStorageWarning(''),
    setDebugInterfaceOpen,
    showAwakeningComplete,
    hideAwakeningComplete: () => setShowAwakeningComplete(false),
    frozenTime,
    lastSavedMessage: lastSavedAt !== null && !storageWarning ? 'Run saved' : undefined,
    pauseRun,
    resumeRun,
    openSettings,
    returnToMainMenuPreservingRun,
    restartRun,
    gameOverProps: {
      characterName: character.role.replace(/^The /, ''),
      timeSurvived: frozenTime,
      roomsCleared: gameplay.runStats.dungeonRoomsCleared,
      enemiesDefeated: gameplay.runStats.enemiesDefeated,
      onHide: () => setHiddenResultsRunId(gameplay.runStats.runId),
      onReopen: () => setHiddenResultsRunId(null),
      onRestart: restartRun,
      onMainMenu: returnToMainMenuAfterDefeat,
    },
    debug: playerProfile && {
      longTermProfile: playerProfile.longTermProfile,
      storageDiagnostics: getStorageDiagnostics(gameplay, playableCharacterId, clockNow),
      onAdvance: () => {
        if (livingEnemyCount > 0) return;
        const exit = currentRoom.exits.find((candidate) => candidate.enabled);
        if (exit) commitExitTransition(exit);
      },
      livingEnemyCount,
      enemies: gameplay.enemies,
      room: currentRoom,
      onSpawnRat: () =>
        dispatchGameplay({ type: 'debug-spawn-rat', timestamp: Date.now(), room: currentRoom }),
      onDefeatAllEnemies: () =>
        dispatchGameplay({ type: 'debug-defeat-all-enemies', timestamp: Date.now() }),
      onFreezeEnemyAi: (frozen: boolean) =>
        dispatchGameplay({ type: 'debug-freeze-enemy-ai', frozen }),
      onTemporaryOverride: (profile: AdaptiveProfile) => {
        setDebugProfileOverride(profile);
        dispatchGameplay({ type: 'apply-debug-profile', profile });
      },
      onClearOverrides: () => {
        setDebugProfileOverride(null);
        dispatchGameplay({
          type: 'apply-debug-profile',
          profile: gameplay.adaptation.currentRunProfile,
        });
      },
      onApplyOverrides: (profile: AdaptiveProfile) =>
        saveProfile({
          ...playerProfile,
          longTermProfile: profile,
          metadata: { ...playerProfile.metadata, updatedAt: new Date().toISOString() },
        }),
    },
  };
}
