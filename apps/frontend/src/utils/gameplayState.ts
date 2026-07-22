import { CURRENT_ROOM_LAYOUT, isHazardPosition } from '../data/roomLayout';
import type {
  AdaptiveProfile,
  AdaptiveRunState,
  ExperiencePreset,
  PlayerBehaviorSignals,
  RoomBehaviorSnapshot,
} from '../types/adaptation';
import type { DungeonProgress, GeneratedRoomSave } from '../types/generation';
import type { EnemyRoomState, RatEnemy, StoredEnemyRoomState } from '../types/enemies';
import type {
  InteractableRuntimeStates,
  InteractionCancellationReason,
  InteractionChannelState,
} from '../types/interactions';
import {
  PLAYER_DAMAGE_INVULNERABILITY_MS,
  RAT_ATTACK_DAMAGE,
  RAT_CORPSE_ABSORPTION_MS,
  RAT_MOVEMENT_INTERVAL_MS,
} from '../types/enemies';
import { RAT_COMBAT_CONFIG } from '../config/combat';
import type {
  AttackAction,
  CardinalDirection,
  GridPosition,
  MoveResult,
  MoveTrigger,
  PlayerState,
} from '../types/player';
import type {
  EvaluationExitChoice,
  EvaluationProgress,
  ExitDirection,
  RoomDefinition,
} from '../types/rooms';
import {
  createAdaptiveRunState,
  addSignalsToSummary,
  createBehaviorSignals,
  updateCurrentRunProfile,
} from './adaptiveProfile';
import {
  coordinateToGridPosition,
  coordinatesMatch,
  getBlockingFeatureLookup,
  gridPositionToCoordinate,
  isWalkableCoordinate,
  roomBounds,
} from './roomGeometry';
import { attemptMove, createAttackAction, positionsMatch, turnPlayer } from './playerActions';
import {
  cardinalDistance,
  createRatFromSpawn,
  deterministicRatMoveCandidates,
  directionBetween,
  directionFromPlayerToRat,
  emptyEnemyRoomState,
  isLivingRat,
  isAnyLivingRatAlerted,
  livingRats,
  pathDistance,
  playerLegalEscapeTiles,
  playerStaticEscapeTiles,
} from './enemySystem';
import { coordinateKey } from './roomGeometry';
import { VERSION_INFO, type AdaptationVersion, type GeneratorVersion } from '../config/version';
import {
  createIdleInteractionState,
  createInteractableRuntimeStates,
  getAvailableInteraction,
  getResonanceCaches,
  getRestorationFountains,
  isInteractionTargetValid,
} from './interactions';
import { awardResonance, normalizeResonance } from './resonance';

export const INVULNERABILITY_DURATION_MS = PLAYER_DAMAGE_INVULNERABILITY_MS;
export const ATTACK_COOLDOWN_MS = 400;
const IDLE_THRESHOLD_MS = 1_000;

export type GameplayStatus = 'idle' | 'active' | 'defeated';
export type DamageSource = 'rune' | 'rat';

export interface DamageEvent {
  id: string;
  source: DamageSource;
  amount: number;
  timestamp: number;
  fatal: boolean;
}
export interface AvoidedDamageEvent {
  id: string;
  source: DamageSource;
  position: GridPosition;
  timestamp: number;
}
export interface InvulnerabilityState {
  expiresAt: number | null;
  pendingRune: GridPosition | null;
}
export type RunPauseState =
  | { isPaused: false; totalPausedMs: number }
  | {
      isPaused: true;
      reason: 'pause-menu';
      pausedAt: number;
      totalPausedMs: number;
    };
export interface AttackCooldownState {
  readyAt: number | null;
}
export interface ShieldTimingState {
  raisedAt: number | null;
  lastFacingChangedAt: number | null;
}
export interface RunStats {
  runId: string | null;
  startedAt: number | null;
  timeSurvived: number | null;
  dungeonRoomsCleared: number;
  /** Compatibility alias for older UI/tests; always equals dungeonRoomsCleared. */
  roomsCleared: number;
  enemiesDefeated: number;
}

export interface GameplayState {
  status: GameplayStatus;
  player: PlayerState;
  currentHealth: number;
  maximumHealth: number;
  resonance: number;
  invulnerability: InvulnerabilityState;
  pause: RunPauseState;
  attackCooldown: AttackCooldownState;
  shieldTiming: ShieldTimingState;
  runStats: RunStats;
  experiencePreset: ExperiencePreset | null;
  evaluationProgress: EvaluationProgress | null;
  dungeonProgress: DungeonProgress | null;
  adaptation: AdaptiveRunState;
  enemies: EnemyRoomState;
  interaction: InteractionChannelState;
  interactables: InteractableRuntimeStates;
  lastMove: MoveResult | null;
  blockedMove: MoveResult | null;
  lastAttack: AttackAction | null;
  lastDamage: DamageEvent | null;
  lastAvoidedDamage: AvoidedDamageEvent | null;
  announcement: string;
}

export type GameplayAction =
  | {
      type: 'start-run';
      maximumHealth: number;
      startedAt: number;
      runId: string;
      roomOrder?: string[];
      currentRoomId?: string;
      spawn?: GridPosition;
      experiencePreset?: ExperiencePreset;
      longTermProfile?: AdaptiveProfile;
      runSeed?: string;
      enemies?: EnemyRoomState;
      generatorVersion?: GeneratorVersion;
      adaptationVersion?: AdaptationVersion;
      room?: RoomDefinition;
    }
  | { type: 'reset-room' }
  | { type: 'reset-to-idle'; maximumHealth: number }
  | { type: 'pause-run'; timestamp: number; reason: 'pause-menu' }
  | { type: 'resume-run'; timestamp: number }
  | {
      type: 'move';
      direction: CardinalDirection;
      trigger: MoveTrigger;
      id: string;
      timestamp: number;
      hazards?: readonly GridPosition[];
      room?: RoomDefinition;
    }
  | { type: 'turn'; direction: CardinalDirection; trigger: MoveTrigger; timestamp?: number }
  | { type: 'attack'; id: string; timestamp: number; room?: RoomDefinition }
  | { type: 'shield'; isShielding: boolean; timestamp?: number }
  | {
      type: 'commit-room-transition';
      destinationRoomId: string;
      destinationRoomIndex: number;
      destinationSpawn: GridPosition;
      enteredFrom: ExitDirection;
      exitedAtMs: number;
      exitChoice: EvaluationExitChoice | null;
      evaluationComplete: boolean;
      generatedRoom?: GeneratedRoomSave;
      incrementDungeonRooms?: boolean;
      chosenExitId?: string;
      nextPokeCooldown?: number;
      nextMode?: 'reinforce' | 'poke';
      longTermProfile?: AdaptiveProfile;
      exitDirection?: ExitDirection;
      effectiveProfile?: AdaptiveProfile;
      enemies?: EnemyRoomState;
      destinationRoom?: RoomDefinition;
    }
  | { type: 'enemy-tick'; timestamp: number; room: RoomDefinition }
  | { type: 'debug-spawn-rat'; timestamp: number; room: RoomDefinition }
  | { type: 'debug-defeat-all-enemies'; timestamp: number }
  | { type: 'debug-freeze-enemy-ai'; frozen: boolean }
  | { type: 'shift-enemy-timers'; duration: number }
  | { type: 'mark-interaction-encountered'; timestamp: number; targetId: string }
  | { type: 'start-interaction'; timestamp: number; room: RoomDefinition; targetId: string }
  | { type: 'interaction-tick'; timestamp: number; room: RoomDefinition }
  | { type: 'interaction-unavailable-feedback'; timestamp: number; targetId: string }
  | { type: 'apply-debug-profile'; profile: AdaptiveProfile }
  | {
      type: 'invulnerability-expired';
      runId: string;
      expectedExpiresAt: number;
      timestamp: number;
    };

const legacyCollisionContext = { bounds: CURRENT_ROOM_LAYOUT.bounds, isBlocked: () => false };
function getCollisionContext(room?: RoomDefinition, enemies?: EnemyRoomState) {
  const living = enemies ? livingRats(enemies) : [];
  const occupied = new Set(living.map((rat) => coordinateKey(rat.position)));
  return room
    ? {
        bounds: roomBounds(room),
        isBlocked: (position: GridPosition) =>
          !isWalkableCoordinate(room, gridPositionToCoordinate(position), living.length) ||
          occupied.has(coordinateKey(gridPositionToCoordinate(position))),
      }
    : legacyCollisionContext;
}
function createPlayer(position: GridPosition = { row: 2, column: 0 }): PlayerState {
  return { position, facing: 'right', isShielding: false, shieldDirection: null };
}
function createRunStats(): RunStats {
  return {
    runId: null,
    startedAt: null,
    timeSurvived: null,
    dungeonRoomsCleared: 0,
    roomsCleared: 0,
    enemiesDefeated: 0,
  };
}
function createInvulnerabilityState(): InvulnerabilityState {
  return { expiresAt: null, pendingRune: null };
}
function createPauseState(): RunPauseState {
  return { isPaused: false, totalPausedMs: 0 };
}
function createAttackCooldownState(): AttackCooldownState {
  return { readyAt: null };
}
function createShieldTimingState(): ShieldTimingState {
  return { raisedAt: null, lastFacingChangedAt: null };
}
function cancelInteraction(
  state: GameplayState,
  reason: InteractionCancellationReason,
): GameplayState {
  if (state.interaction.status !== 'channeling') return state;
  const runtime = state.interaction.targetId
    ? state.interactables[state.interaction.targetId]
    : undefined;
  const announcement =
    state.interaction.type === 'resonance-cache'
      ? 'Resonance Cache opening interrupted.'
      : 'Restoration interrupted.';
  return {
    ...state,
    interactables:
      runtime && state.interaction.targetId
        ? {
            ...state.interactables,
            [state.interaction.targetId]: {
              ...runtime,
              cancellationReasons: [...(runtime.cancellationReasons ?? []), reason],
            },
          }
        : state.interactables,
    interaction: {
      ...createIdleInteractionState(),
      targetId: state.interaction.targetId,
      type: state.interaction.type,
      status: 'cancelled',
      cancellationReason: reason,
    },
    announcement,
  };
}
function clampHealth(health: number, maximumHealth: number): number {
  return Math.min(Math.max(0, health), maximumHealth);
}

export function createGameplayState(maximumHealth: number): GameplayState {
  const safeMaximumHealth = Math.max(0, Math.trunc(maximumHealth));
  return {
    status: 'idle',
    player: createPlayer(),
    currentHealth: safeMaximumHealth,
    maximumHealth: safeMaximumHealth,
    resonance: 0,
    invulnerability: createInvulnerabilityState(),
    pause: createPauseState(),
    attackCooldown: createAttackCooldownState(),
    shieldTiming: createShieldTimingState(),
    runStats: createRunStats(),
    experiencePreset: null,
    evaluationProgress: null,
    dungeonProgress: null,
    adaptation: createAdaptiveRunState(),
    enemies: emptyEnemyRoomState(),
    interaction: createIdleInteractionState(),
    interactables: {},
    lastMove: null,
    blockedMove: null,
    lastAttack: null,
    lastDamage: null,
    lastAvoidedDamage: null,
    announcement: '',
  };
}

function withMeaningfulAction(adaptation: AdaptiveRunState, timestamp: number): AdaptiveRunState {
  const previous = adaptation.lastMeaningfulActionAt;
  const idle = previous === null ? 0 : Math.max(0, timestamp - previous - IDLE_THRESHOLD_MS);
  return {
    ...adaptation,
    signals: { ...adaptation.signals, idleTimeMs: adaptation.signals.idleTimeMs + idle },
    lastMeaningfulActionAt: timestamp,
  };
}

export function applyPlayerDamage(
  state: GameplayState,
  event: Omit<DamageEvent, 'fatal'>,
): GameplayState {
  if (state.status !== 'active' || event.amount <= 0) return state;
  if (state.invulnerability.expiresAt !== null && event.timestamp < state.invulnerability.expiresAt)
    return state;
  const currentHealth = clampHealth(state.currentHealth - event.amount, state.maximumHealth);
  const fatal = currentHealth === 0;
  const timeSurvived = fatal
    ? getTimeSurvived(state.runStats, event.timestamp, state.pause)
    : state.runStats.timeSurvived;
  const interactionTarget = state.interaction.targetId
    ? state.interactables[state.interaction.targetId]
    : undefined;
  const cancellationReason: InteractionCancellationReason = fatal ? 'defeat' : 'damage';
  return {
    ...state,
    status: fatal ? 'defeated' : 'active',
    player: fatal ? { ...state.player, isShielding: false, shieldDirection: null } : state.player,
    currentHealth,
    invulnerability: fatal
      ? createInvulnerabilityState()
      : { expiresAt: event.timestamp + INVULNERABILITY_DURATION_MS, pendingRune: null },
    attackCooldown: fatal ? createAttackCooldownState() : state.attackCooldown,
    shieldTiming: fatal ? createShieldTimingState() : state.shieldTiming,
    runStats: fatal ? { ...state.runStats, timeSurvived } : state.runStats,
    adaptation: {
      ...state.adaptation,
      signals: {
        ...state.adaptation.signals,
        damageTaken: state.adaptation.signals.damageTaken + event.amount,
      },
    },
    enemies:
      event.source === 'rat'
        ? {
            ...state.enemies,
            combatMetrics: {
              ...state.enemies.combatMetrics,
              playerDamageTaken: state.enemies.combatMetrics.playerDamageTaken + event.amount,
            },
          }
        : state.enemies,
    interaction:
      state.interaction.status === 'channeling'
        ? {
            ...createIdleInteractionState(),
            targetId: state.interaction.targetId,
            type: state.interaction.type,
            status: 'cancelled',
            cancellationReason,
          }
        : state.interaction,
    interactables:
      state.interaction.status === 'channeling' && interactionTarget && state.interaction.targetId
        ? {
            ...state.interactables,
            [state.interaction.targetId]: {
              ...interactionTarget,
              cancellationReasons: [
                ...(interactionTarget.cancellationReasons ?? []),
                cancellationReason,
              ],
            },
          }
        : state.interactables,
    lastAttack: fatal ? null : state.lastAttack,
    lastDamage: { ...event, fatal },
    lastAvoidedDamage: null,
    announcement: fatal
      ? 'You were defeated.'
      : `${event.source === 'rat' ? 'Rat' : 'Rune'} damaged you. ${currentHealth} of ${state.maximumHealth} health remaining.`,
  };
}

function movePlayer(
  state: GameplayState,
  action: Extract<GameplayAction, { type: 'move' }>,
): GameplayState {
  const movement = attemptMove(
    state.player,
    action.direction,
    getCollisionContext(action.room, state.enemies),
    action.id,
  );
  const meaningful = action.trigger !== 'repeat';
  const shouldShowBlockedFeedback =
    movement.result.blockedReason !== null &&
    (meaningful ||
      state.lastMove?.blockedReason === null ||
      state.lastMove?.facing !== movement.result.facing);
  const invulnerabilityActive =
    state.invulnerability.expiresAt !== null && action.timestamp < state.invulnerability.expiresAt;
  let adaptation = meaningful
    ? withMeaningfulAction(state.adaptation, action.timestamp)
    : state.adaptation;
  const visited = new Set(adaptation.signals.floorTilesVisited);
  if (movement.result.moved)
    visited.add(
      `${action.room?.id ?? 'legacy'}:${movement.result.target.column}:${movement.result.target.row}`,
    );
  adaptation = {
    ...adaptation,
    signals: {
      ...adaptation.signals,
      movementSteps:
        adaptation.signals.movementSteps + (movement.result.moved && meaningful ? 1 : 0),
      blockedMovementAttempts:
        adaptation.signals.blockedMovementAttempts + (!movement.result.moved && meaningful ? 1 : 0),
      directionChanges:
        adaptation.signals.directionChanges +
        (state.player.facing !== action.direction && meaningful ? 1 : 0),
      floorTilesVisited: [...visited],
    },
  };
  let nextState: GameplayState = {
    ...state,
    player: movement.player,
    adaptation,
    invulnerability: invulnerabilityActive ? state.invulnerability : createInvulnerabilityState(),
    lastMove: movement.result,
    blockedMove: shouldShowBlockedFeedback ? movement.result : state.blockedMove,
    announcement:
      meaningful || shouldShowBlockedFeedback
        ? movement.result.moved
          ? `Moved ${movement.result.facing}.`
          : `Blocked moving ${movement.result.facing}.`
        : state.announcement,
  };
  if (!movement.result.moved) return nextState;
  const hazards = action.room
    ? (action.room.hazards ?? []).map(coordinateToGridPosition)
    : (action.hazards ?? CURRENT_ROOM_LAYOUT.hazards);
  if (!isHazardPosition(movement.result.target, hazards)) {
    return nextState.invulnerability.pendingRune === null
      ? nextState
      : { ...nextState, invulnerability: { ...nextState.invulnerability, pendingRune: null } };
  }
  nextState = {
    ...nextState,
    adaptation: {
      ...nextState.adaptation,
      signals: {
        ...nextState.adaptation.signals,
        runeContacts: nextState.adaptation.signals.runeContacts + 1,
      },
    },
  };
  if (invulnerabilityActive) {
    return {
      ...nextState,
      invulnerability: { ...nextState.invulnerability, pendingRune: movement.result.target },
      lastAvoidedDamage: {
        id: action.id,
        source: 'rune',
        position: movement.result.target,
        timestamp: action.timestamp,
      },
      announcement: 'Damage avoided while invulnerable.',
    };
  }
  return applyPlayerDamage(nextState, {
    id: action.id,
    source: 'rune',
    amount: 1,
    timestamp: action.timestamp,
  });
}

function shiftRatDeadline(value: number | null, duration: number): number | null {
  return value === null ? null : value + duration;
}

function shiftEnemyTimers(enemies: EnemyRoomState, duration: number): EnemyRoomState {
  return {
    ...enemies,
    lastTickAt: shiftRatDeadline(enemies.lastTickAt, duration),
    lastBlockAt: shiftRatDeadline(enemies.lastBlockAt, duration),
    rats: enemies.rats.map((rat) => ({
      ...rat,
      nextMovementAt: shiftRatDeadline(rat.nextMovementAt, duration),
      telegraphEndsAt: shiftRatDeadline(rat.telegraphEndsAt, duration),
      lungeEndsAt: shiftRatDeadline(rat.lungeEndsAt, duration),
      recoveryEndsAt: shiftRatDeadline(rat.recoveryEndsAt, duration),
      corpseEndsAt: shiftRatDeadline(rat.corpseEndsAt, duration),
      hitFlashUntil: shiftRatDeadline(rat.hitFlashUntil, duration),
    })),
    awarenessGraceEndsAt: shiftRatDeadline(enemies.awarenessGraceEndsAt, duration),
  };
}

function defeatRat(rat: RatEnemy, timestamp: number): RatEnemy {
  return {
    ...rat,
    health: 0,
    state: 'corpse',
    lockedTarget: null,
    nextMovementAt: null,
    telegraphEndsAt: null,
    lungeEndsAt: null,
    recoveryEndsAt: null,
    recoveryKind: null,
    attackOutcome: null,
    corpseEndsAt: timestamp + RAT_CORPSE_ABSORPTION_MS,
    hitFlashUntil: null,
    defeatCounted: true,
    nextPathStep: null,
  };
}

function applySwordToRats(
  state: GameplayState,
  attack: AttackAction,
  timestamp: number,
): {
  enemies: EnemyRoomState;
  defeated: number;
  damaged: number;
  hit: boolean;
  attackedRatIds: string[];
} {
  if (!attack.target || attack.blockedReason) {
    return {
      enemies: state.enemies,
      defeated: 0,
      damaged: 0,
      hit: false,
      attackedRatIds: [],
    };
  }
  const target = gridPositionToCoordinate(attack.target);
  let defeated = 0;
  let damaged = 0;
  const attackedRatIds: string[] = [];
  let cancelledAttacks = 0;
  const rats = state.enemies.rats.map((rat) => {
    if (!isLivingRat(rat) || !coordinatesMatch(rat.position, target)) return rat;
    attackedRatIds.push(rat.id);
    damaged += 1;
    if (rat.health <= attack.damage) {
      defeated += rat.defeatCounted ? 0 : 1;
      if (rat.state === 'telegraphing') cancelledAttacks += 1;
      return defeatRat(rat, timestamp);
    }
    return {
      ...rat,
      awareness: 'alerted' as const,
      state: rat.state === 'idle' ? ('chasing' as const) : rat.state,
      nextMovementAt:
        rat.state === 'idle' ? timestamp + RAT_MOVEMENT_INTERVAL_MS : rat.nextMovementAt,
      health: rat.health - attack.damage,
      hitFlashUntil: timestamp + RAT_COMBAT_CONFIG.hitFlashMs,
    };
  });
  return {
    enemies: {
      ...state.enemies,
      rats,
      combatMetrics: {
        ...state.enemies.combatMetrics,
        attacksCancelledByDefeat:
          state.enemies.combatMetrics.attacksCancelledByDefeat + cancelledAttacks,
        playerHitsLanded: state.enemies.combatMetrics.playerHitsLanded + damaged,
      },
    },
    defeated,
    damaged,
    hit: damaged > 0,
    attackedRatIds,
  };
}

function processEnemyTick(
  state: GameplayState,
  action: Extract<GameplayAction, { type: 'enemy-tick' }>,
): GameplayState {
  if (state.pause.isPaused || state.status !== 'active') return state;
  const timestamp = action.timestamp;
  if (state.enemies.aiFrozen) {
    const frozenDuration =
      state.enemies.lastTickAt === null ? 0 : Math.max(0, timestamp - state.enemies.lastTickAt);
    return {
      ...state,
      enemies: {
        ...shiftEnemyTimers(state.enemies, frozenDuration),
        lastTickAt: timestamp,
      },
    };
  }
  const priorLiving = livingRats(state.enemies).length;
  const priorAlerted = state.enemies.rats.some(
    (rat) => isLivingRat(rat) && rat.awareness === 'alerted',
  );
  const combatDelta =
    priorLiving > 0 && state.enemies.lastTickAt !== null
      ? Math.max(0, Math.min(1_000, timestamp - state.enemies.lastTickAt))
      : 0;
  const combatDebugDelta = priorAlerted ? combatDelta : 0;
  let nextState: GameplayState = {
    ...state,
    enemies: {
      ...state.enemies,
      lastTickAt: timestamp,
      rats: state.enemies.rats.filter(
        (rat) =>
          rat.state !== 'corpse' || rat.corpseEndsAt === null || timestamp < rat.corpseEndsAt,
      ),
    },
    adaptation: {
      ...state.adaptation,
      signals: {
        ...state.adaptation.signals,
        combatTimeMs: state.adaptation.signals.combatTimeMs + combatDelta,
      },
    },
  };
  const player = gridPositionToCoordinate(nextState.player.position);
  const graceComplete =
    nextState.enemies.awarenessGraceEndsAt === null ||
    timestamp >= nextState.enemies.awarenessGraceEndsAt;
  const ratsAfterAwareness = nextState.enemies.rats.map((rat) => {
    if (!isLivingRat(rat)) return rat;
    const distance = pathDistance(action.room, rat.position, player);
    if (
      rat.awareness === 'unaware' &&
      graceComplete &&
      distance !== null &&
      distance <= RAT_COMBAT_CONFIG.awarenessRangeTiles
    ) {
      return {
        ...rat,
        awareness: 'alerted' as const,
        state: 'chasing' as const,
        nextMovementAt: timestamp + RAT_MOVEMENT_INTERVAL_MS,
        pathDistanceToPlayer: distance,
      };
    }
    return { ...rat, pathDistanceToPlayer: distance };
  });
  const alertedCount = ratsAfterAwareness.filter(
    (rat) => isLivingRat(rat) && rat.awareness === 'alerted',
  ).length;
  const previousMetrics = nextState.enemies.combatMetrics;
  nextState = {
    ...nextState,
    enemies: {
      ...nextState.enemies,
      rats: ratsAfterAwareness,
      combatMetrics: {
        ...previousMetrics,
        combatDurationMs: previousMetrics.combatDurationMs + combatDebugDelta,
        maximumSimultaneouslyAlertedRats: Math.max(
          previousMetrics.maximumSimultaneouslyAlertedRats,
          alertedCount,
        ),
      },
    },
  };
  const occupied = new Set(livingRats(nextState.enemies).map((rat) => coordinateKey(rat.position)));
  const ordered = [...nextState.enemies.rats].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const updated = new Map<string, RatEnemy>();
  for (const original of ordered) {
    let rat =
      original.hitFlashUntil !== null && timestamp >= original.hitFlashUntil
        ? { ...original, hitFlashUntil: null }
        : original;
    if (!isLivingRat(rat)) {
      updated.set(rat.id, rat);
      continue;
    }
    if (
      rat.state === 'telegraphing' &&
      rat.telegraphEndsAt !== null &&
      timestamp >= rat.telegraphEndsAt
    ) {
      const impactAt = rat.telegraphEndsAt;
      const targetHit = rat.lockedTarget !== null && coordinatesMatch(rat.lockedTarget, player);
      const attackDirection = directionFromPlayerToRat(player, rat.position);
      const blocked =
        targetHit &&
        attackDirection !== null &&
        nextState.player.isShielding &&
        nextState.player.facing === attackDirection;
      const perfectWindowStartedAt = impactAt - RAT_COMBAT_CONFIG.perfectBlockWindowMs;
      const perfectInputAt = Math.max(
        nextState.shieldTiming.raisedAt ?? Number.NEGATIVE_INFINITY,
        nextState.shieldTiming.lastFacingChangedAt ?? Number.NEGATIVE_INFINITY,
      );
      const perfectBlock =
        blocked && perfectInputAt >= perfectWindowStartedAt && perfectInputAt <= impactAt;
      const outcome = !targetHit
        ? ('miss' as const)
        : !blocked
          ? ('hit' as const)
          : perfectBlock
            ? ('perfect-block' as const)
            : ('block' as const);
      let signals = nextState.adaptation.signals;
      signals = {
        ...signals,
        enemyAttacksLanded: signals.enemyAttacksLanded + (targetHit && !blocked ? 1 : 0),
        enemyAttacksMissed: signals.enemyAttacksMissed + (!targetHit ? 1 : 0),
        enemyAttacksBlocked: signals.enemyAttacksBlocked + (blocked ? 1 : 0),
      };
      nextState = {
        ...nextState,
        adaptation: { ...nextState.adaptation, signals },
        enemies: {
          ...nextState.enemies,
          lastBlockAt: blocked ? impactAt : nextState.enemies.lastBlockAt,
          lastBlockKind: blocked
            ? perfectBlock
              ? 'perfect'
              : 'regular'
            : nextState.enemies.lastBlockKind,
          combatMetrics: {
            ...nextState.enemies.combatMetrics,
            attacksLanded:
              nextState.enemies.combatMetrics.attacksLanded + (targetHit && !blocked ? 1 : 0),
            attacksDodged: nextState.enemies.combatMetrics.attacksDodged + (!targetHit ? 1 : 0),
            regularBlocks:
              nextState.enemies.combatMetrics.regularBlocks + (blocked && !perfectBlock ? 1 : 0),
            perfectBlocks: nextState.enemies.combatMetrics.perfectBlocks + (perfectBlock ? 1 : 0),
          },
        },
        announcement: blocked
          ? 'Rat attack blocked.'
          : !targetHit
            ? 'Rat attack missed.'
            : nextState.announcement,
      };
      if (targetHit && !blocked) {
        nextState = applyPlayerDamage(nextState, {
          id: `rat-attack-${rat.id}-${timestamp}`,
          source: 'rat',
          amount: RAT_ATTACK_DAMAGE,
          timestamp: impactAt,
        });
      }
      rat = {
        ...rat,
        state: 'lunging',
        telegraphEndsAt: null,
        lungeEndsAt: impactAt + RAT_COMBAT_CONFIG.lungeMs,
        recoveryEndsAt: null,
        recoveryKind: perfectBlock ? 'perfect-block' : 'standard',
        attackOutcome: outcome,
        nextMovementAt: null,
        nextPathStep: null,
      };
    }
    if (rat.state === 'lunging' && rat.lungeEndsAt !== null && timestamp >= rat.lungeEndsAt) {
      const recoveryStartedAt = rat.lungeEndsAt;
      const recoveryDuration =
        rat.recoveryKind === 'perfect-block'
          ? RAT_COMBAT_CONFIG.perfectBlockRecoveryMs
          : RAT_COMBAT_CONFIG.recoveryMs;
      rat = {
        ...rat,
        state: 'recovering',
        lungeEndsAt: null,
        recoveryEndsAt: recoveryStartedAt + recoveryDuration,
      };
    }
    if (
      rat.state === 'recovering' &&
      rat.recoveryEndsAt !== null &&
      timestamp >= rat.recoveryEndsAt
    ) {
      const recoveredAt = rat.recoveryEndsAt;
      rat = {
        ...rat,
        state: 'chasing',
        lockedTarget: null,
        recoveryEndsAt: null,
        recoveryKind: null,
        attackOutcome: null,
        nextMovementAt: recoveredAt,
      };
    }
    if (nextState.status !== 'active') {
      updated.set(rat.id, rat);
      continue;
    }
    if (rat.state === 'chasing') {
      if (cardinalDistance(rat.position, player) === 1) {
        const facing = directionBetween(rat.position, player) ?? rat.facing;
        rat = {
          ...rat,
          facing,
          state: 'telegraphing',
          lockedTarget: { ...player },
          telegraphEndsAt: timestamp + RAT_COMBAT_CONFIG.telegraphMs,
          lungeEndsAt: null,
          recoveryEndsAt: null,
          recoveryKind: null,
          attackOutcome: null,
          nextMovementAt: null,
          nextPathStep: null,
          pathBlocked: false,
        };
        nextState = {
          ...nextState,
          adaptation: {
            ...nextState.adaptation,
            signals: {
              ...nextState.adaptation.signals,
              enemyAttacksStarted: nextState.adaptation.signals.enemyAttacksStarted + 1,
            },
          },
          enemies: {
            ...nextState.enemies,
            combatMetrics: {
              ...nextState.enemies.combatMetrics,
              attacksStarted: nextState.enemies.combatMetrics.attacksStarted + 1,
            },
          },
        };
      } else if (rat.nextMovementAt !== null && timestamp >= rat.nextMovementAt) {
        const staticEscapes = playerStaticEscapeTiles(action.room, player);
        const legalEscapes = playerLegalEscapeTiles(action.room, player, occupied);
        const protectedEscape =
          staticEscapes.length >= 2 && legalEscapes.length === 1 ? legalEscapes[0]! : null;
        occupied.delete(coordinateKey(rat.position));
        const candidates = deterministicRatMoveCandidates(action.room, rat, player, occupied);
        const preferred = candidates[0] ?? null;
        const shouldPreventLock = Boolean(
          preferred && protectedEscape && coordinatesMatch(preferred, protectedEscape),
        );
        const step = shouldPreventLock
          ? (candidates.find((candidate) => !coordinatesMatch(candidate, protectedEscape!)) ?? null)
          : preferred;
        if (step) {
          rat = {
            ...rat,
            position: step,
            facing: directionBetween(rat.position, step) ?? rat.facing,
            nextPathStep: step,
            pathBlocked: false,
            bodyLockPreventionApplied: shouldPreventLock,
          };
          occupied.add(coordinateKey(step));
        } else {
          occupied.add(coordinateKey(rat.position));
          rat = {
            ...rat,
            nextPathStep: preferred,
            pathBlocked: true,
            bodyLockPreventionApplied: shouldPreventLock,
          };
        }
        if (shouldPreventLock) {
          nextState = {
            ...nextState,
            enemies: {
              ...nextState.enemies,
              combatMetrics: {
                ...nextState.enemies.combatMetrics,
                bodyLockPreventionActivations:
                  nextState.enemies.combatMetrics.bodyLockPreventionActivations + 1,
              },
            },
          };
        }
        rat = { ...rat, nextMovementAt: timestamp + RAT_MOVEMENT_INTERVAL_MS };
      }
    }
    updated.set(rat.id, rat);
  }
  return {
    ...nextState,
    enemies: {
      ...nextState.enemies,
      rats: nextState.enemies.rats.map((rat) => updated.get(rat.id) ?? rat),
    },
  };
}

function completeRoomSignals(
  state: GameplayState,
  action: Extract<GameplayAction, { type: 'commit-room-transition' }>,
): AdaptiveRunState {
  const signals: PlayerBehaviorSignals = {
    ...state.adaptation.signals,
    roomTimesMs: [
      ...state.adaptation.signals.roomTimesMs,
      Math.max(0, action.exitedAtMs - (state.evaluationProgress?.roomEnteredAtMs ?? 0)),
    ],
    exitsChosenByDirection: {
      ...state.adaptation.signals.exitsChosenByDirection,
      [action.exitDirection ?? action.enteredFrom]:
        state.adaptation.signals.exitsChosenByDirection[
          action.exitDirection ?? action.enteredFrom
        ] + 1,
    },
  };
  const completedGeneratedRoom = Boolean(state.dungeonProgress?.currentRoom);
  const roomSignals = signals;
  const generatedRoomSignals: RoomBehaviorSnapshot[] = completedGeneratedRoom
    ? [
        ...state.adaptation.generatedRoomSignals,
        {
          roomNumber: state.dungeonProgress!.dungeonRoomNumber,
          signals: roomSignals,
        },
      ].slice(-5)
    : state.adaptation.generatedRoomSignals;
  const completedSummary = addSignalsToSummary(state.adaptation.completedSummary, roomSignals);
  const currentRunProfile = updateCurrentRunProfile(completedSummary, generatedRoomSignals);
  return {
    ...state.adaptation,
    signals: createBehaviorSignals(),
    completedSummary,
    generatedRoomSignals,
    currentRunProfile,
    effectiveProfile: action.effectiveProfile ?? currentRunProfile,
    shieldStartedAt: null,
    lastMeaningfulActionAt: null,
  };
}

function updateGenerationProvenance(
  current: DungeonProgress['provenance'],
  nextGenerator: GeneratorVersion,
  nextAdaptation: AdaptationVersion,
  roomNumber: number,
): DungeonProgress['provenance'] {
  const existing = current ?? {
    gameVersion: 'unknown' as const,
    adaptationVersion: nextAdaptation,
    startingGeneratorVersion: nextGenerator,
    activeGeneratorVersion: nextGenerator,
    mixed: false,
    transitions: [],
  };
  if (existing.activeGeneratorVersion === nextGenerator) {
    return { ...existing, adaptationVersion: nextAdaptation };
  }
  return {
    ...existing,
    adaptationVersion: nextAdaptation,
    activeGeneratorVersion: nextGenerator,
    mixed: true,
    transitions: [
      ...existing.transitions,
      {
        roomNumber,
        from: existing.activeGeneratorVersion,
        to: nextGenerator,
        reason:
          existing.activeGeneratorVersion === 'generator-1'
            ? 'generator-1-continuation'
            : 'version-migration',
      },
    ],
  };
}

function createRoomDecisionRecord(
  room: GeneratedRoomSave,
  chosenExitId: string,
  chosenExitDirection: ExitDirection,
  nextEntranceDirection: ExitDirection,
  state: GameplayState,
): NonNullable<DungeonProgress['recentDecisionRecords']>[number] {
  const recovery = room.details.recoveryDecision;
  const fountain = getRestorationFountains(room.roomSnapshot)[0];
  const runtime = fountain ? state.interactables[fountain.id] : undefined;
  const reward = room.details.rewardDecision;
  const cache = getResonanceCaches(room.roomSnapshot)[0];
  const cacheRuntime = cache ? state.interactables[cache.id] : undefined;
  return {
    roomNumber: room.dungeonRoomNumber,
    roomId: room.roomSnapshot.id,
    gameVersion: room.gameVersion ?? 'unknown',
    generatorVersion: room.generatorVersion,
    adaptationVersion: room.adaptationVersion ?? 'rules-1',
    archetype: room.details.archetype ?? room.roomSnapshot.archetype ?? 'legacy',
    featureSchemaVersion: room.details.featureSchemaVersion ?? 0,
    selectedCandidateId: room.details.selectedCandidateId ?? null,
    selectedRank: room.details.selectedCandidateRank ?? null,
    selectedScore: room.details.selectedCandidateScore ?? null,
    seededSelectionRoll: room.details.seededSelectionRoll ?? null,
    topCandidates: room.details.topCandidates ?? [],
    rejectionCounts: room.details.rejectionCounts ?? {},
    validCandidateCount: room.details.validCandidateCount ?? 1,
    reducedDiversity: room.details.reducedDiversity ?? false,
    availableExitIds: room.roomSnapshot.exits.map((exit) => exit.id),
    availableExitDirections: room.roomSnapshot.exits.map((exit) => exit.direction),
    chosenExitId,
    chosenExitDirection,
    previousEntranceDirection: room.details.entranceDirection,
    nextEntranceDirection,
    exitDecisions: room.details.exitDecisions ?? [],
    ...(recovery || fountain
      ? {
          fountainOutcome: {
            requested: recovery?.requested ?? true,
            placementPossible: recovery?.placementPossible ?? true,
            spawned: Boolean(fountain),
            placementStyle: fountain?.placementStyle ?? recovery?.placementStyle ?? null,
            used: runtime?.depleted ?? false,
            skipped: Boolean(fountain && !runtime?.depleted),
            healthWhenEncountered: runtime?.encounteredAt !== null ? state.currentHealth : null,
            healthWhenUsed: runtime?.usedAt !== null ? state.currentHealth : null,
            encounterToUseMs:
              runtime?.encounteredAt !== null &&
              runtime?.encounteredAt !== undefined &&
              runtime.usedAt !== null
                ? Math.max(0, runtime.usedAt - runtime.encounteredAt)
                : null,
            combatDelayedUse: state.enemies.combatMetrics.maximumSimultaneouslyAlertedRats > 0,
            roomCompleted: true,
            damageAfterEncounter:
              runtime?.encounteredAt !== null && runtime?.encounteredAt !== undefined
                ? state.adaptation.signals.damageTaken
                : 0,
            gameVersion: room.gameVersion ?? 'unknown',
            generatorVersion: room.generatorVersion,
          },
        }
      : {}),
    ...(reward
      ? {
          rewardOutcome: {
            rewardSystemVersion: reward.rewardSystemVersion,
            eligible: reward.eligible,
            spawned: reward.spawned,
            spawnReason: reward.spawnReason,
            cacheId: reward.cacheId,
            placementCategory: reward.placementCategory,
            opened: cacheRuntime?.depleted ?? false,
            resonanceAwarded: cacheRuntime?.resonanceAwarded ?? false,
          },
        }
      : {}),
  };
}

export function gameplayReducer(state: GameplayState, action: GameplayAction): GameplayState {
  if (action.type === 'start-run') {
    const evaluationProgress =
      action.roomOrder && action.currentRoomId
        ? {
            roomOrder: [...action.roomOrder],
            currentRoomIndex: 0,
            currentRoomId: action.currentRoomId,
            enteredFrom: 'west' as const,
            roomEnteredAtMs: 0,
            exitChoices: [],
            evaluationComplete: false,
          }
        : null;
    const runSeed = action.runSeed ?? `${action.runId}-${action.startedAt}`;
    const enemies = action.enemies ?? emptyEnemyRoomState(action.currentRoomId);
    const adaptation = createAdaptiveRunState(action.longTermProfile);
    adaptation.signals.ratsSpawned = livingRats(enemies).length;
    return {
      ...createGameplayState(action.maximumHealth),
      status: 'active',
      player: createPlayer(action.spawn),
      runStats: { ...createRunStats(), runId: action.runId, startedAt: action.startedAt },
      experiencePreset: action.experiencePreset ?? 'seasoned-adventurer',
      evaluationProgress,
      dungeonProgress: {
        runSeed,
        dungeonRoomNumber: 0,
        currentRoom: null,
        enteredFrom: null,
        chosenExitIds: [],
        pokeCooldown: 0,
        previousMode: null,
        provenance: {
          gameVersion: VERSION_INFO.gameVersion,
          adaptationVersion: action.adaptationVersion ?? VERSION_INFO.adaptationVersion,
          startingGeneratorVersion: action.generatorVersion ?? VERSION_INFO.generatorVersion,
          activeGeneratorVersion: action.generatorVersion ?? VERSION_INFO.generatorVersion,
          mixed: false,
          transitions: [],
        },
        lastChosenExitId: null,
        lastChosenExitDirection: null,
        previousEntranceDirection: null,
        nextEntranceDirection: null,
        recentDecisionRecords: [],
        completedDecisionCount: 0,
        recovery: {
          cooldownRemaining: 0,
          roomsSinceLastGeneratedSpawn: 3,
          roomsSinceLastUse: 3,
          previousSkipped: false,
        },
      },
      adaptation,
      enemies,
      interactables: action.room ? createInteractableRuntimeStates(action.room) : {},
    };
  }
  if (action.type === 'reset-to-idle') return createGameplayState(action.maximumHealth);
  if (action.type === 'reset-room') {
    if (state.status === 'defeated') return state;
    return {
      ...state,
      player: createPlayer(),
      invulnerability: { ...state.invulnerability, pendingRune: null },
      lastMove: null,
      blockedMove: null,
      lastAttack: null,
      shieldTiming: createShieldTimingState(),
      lastDamage: null,
      lastAvoidedDamage: null,
      announcement: '',
    };
  }
  if (action.type === 'apply-debug-profile')
    return {
      ...state,
      adaptation: {
        ...state.adaptation,
        currentRunProfile: action.profile,
        effectiveProfile: action.profile,
      },
    };
  if (state.status !== 'active') return state;
  if (action.type === 'enemy-tick') {
    const next = processEnemyTick(state, action);
    return isAnyLivingRatAlerted(next.enemies) ? cancelInteraction(next, 'combat-alert') : next;
  }
  if (action.type === 'debug-freeze-enemy-ai')
    return { ...state, enemies: { ...state.enemies, aiFrozen: action.frozen } };
  if (action.type === 'shift-enemy-timers')
    return action.duration <= 0
      ? state
      : {
          ...state,
          enemies: shiftEnemyTimers(state.enemies, action.duration),
          interaction:
            state.interaction.status === 'channeling'
              ? {
                  ...state.interaction,
                  deadline:
                    state.interaction.deadline === null
                      ? null
                      : state.interaction.deadline + action.duration,
                }
              : state.interaction,
        };
  if (action.type === 'debug-spawn-rat') {
    const occupied = new Set([
      ...livingRats(state.enemies).map((rat) => coordinateKey(rat.position)),
      coordinateKey(gridPositionToCoordinate(state.player.position)),
      ...(action.room.hazards ?? []).map(coordinateKey),
      ...action.room.exits.map((exit) => coordinateKey(exit.tile)),
      ...getBlockingFeatureLookup(action.room),
    ]);
    const tile = [...action.room.floorTiles]
      .sort((left, right) => left.y - right.y || left.x - right.x)
      .find((candidate) => !occupied.has(coordinateKey(candidate)));
    if (!tile) return { ...state, announcement: 'No safe tile is available for a debug Rat.' };
    const spawn = {
      id: `${action.room.id}-debug-rat-${state.enemies.rats.length + 1}`,
      type: 'rat' as const,
      tile,
      order: state.enemies.rats.length + 1,
      source: 'generated' as const,
      reason: 'Development-only Rat spawn',
    };
    return {
      ...state,
      enemies: {
        ...state.enemies,
        rats: [...state.enemies.rats, createRatFromSpawn(spawn, action.timestamp, 'debug')],
      },
      adaptation: {
        ...state.adaptation,
        signals: {
          ...state.adaptation.signals,
          ratsSpawned: state.adaptation.signals.ratsSpawned + 1,
        },
      },
      announcement: 'Debug Rat spawned.',
    };
  }
  if (action.type === 'debug-defeat-all-enemies') {
    let defeated = 0;
    const rats = state.enemies.rats.map((rat) => {
      if (!isLivingRat(rat)) return rat;
      defeated += rat.defeatCounted ? 0 : 1;
      return defeatRat(rat, action.timestamp);
    });
    return {
      ...state,
      enemies: { ...state.enemies, rats },
      runStats: {
        ...state.runStats,
        enemiesDefeated: state.runStats.enemiesDefeated + defeated,
      },
      adaptation: {
        ...state.adaptation,
        signals: {
          ...state.adaptation.signals,
          ratsDefeated: state.adaptation.signals.ratsDefeated + defeated,
        },
      },
      announcement: defeated
        ? 'All Rats defeated through development controls.'
        : 'No living Rats remain.',
    };
  }
  if (action.type === 'pause-run') {
    if (state.pause.isPaused) return state;
    const timestamp = Math.max(0, action.timestamp);
    const shieldDuration =
      state.player.isShielding && state.adaptation.shieldStartedAt !== null
        ? Math.max(0, timestamp - state.adaptation.shieldStartedAt)
        : 0;
    return {
      ...state,
      player: { ...state.player, isShielding: false, shieldDirection: null },
      shieldTiming: createShieldTimingState(),
      pause: {
        isPaused: true,
        reason: action.reason,
        pausedAt: timestamp,
        totalPausedMs: state.pause.totalPausedMs,
      },
      adaptation: {
        ...state.adaptation,
        shieldStartedAt: null,
        signals: {
          ...state.adaptation.signals,
          shieldTimeMs: state.adaptation.signals.shieldTimeMs + shieldDuration,
        },
      },
      announcement: 'Run paused.',
    };
  }
  if (action.type === 'resume-run') {
    if (!state.pause.isPaused) return state;
    const pausedDuration = Math.max(0, action.timestamp - state.pause.pausedAt);
    return {
      ...state,
      pause: {
        isPaused: false,
        totalPausedMs: state.pause.totalPausedMs + pausedDuration,
      },
      invulnerability: {
        ...state.invulnerability,
        expiresAt:
          state.invulnerability.expiresAt === null
            ? null
            : state.invulnerability.expiresAt + pausedDuration,
      },
      attackCooldown: {
        readyAt:
          state.attackCooldown.readyAt === null
            ? null
            : state.attackCooldown.readyAt + pausedDuration,
      },
      enemies: shiftEnemyTimers(state.enemies, pausedDuration),
      interaction:
        state.interaction.status === 'channeling'
          ? {
              ...state.interaction,
              deadline:
                state.interaction.deadline === null
                  ? null
                  : state.interaction.deadline + pausedDuration,
            }
          : state.interaction,
      adaptation: {
        ...state.adaptation,
        lastMeaningfulActionAt:
          state.adaptation.lastMeaningfulActionAt === null
            ? null
            : state.adaptation.lastMeaningfulActionAt + pausedDuration,
      },
      announcement: 'Run resumed.',
    };
  }
  if (state.pause.isPaused) return state;
  if (action.type === 'mark-interaction-encountered') {
    const runtime = state.interactables[action.targetId];
    if (!runtime || runtime.encounteredAt !== null) return state;
    return {
      ...state,
      interactables: {
        ...state.interactables,
        [action.targetId]: { ...runtime, encounteredAt: action.timestamp },
      },
    };
  }
  if (action.type === 'start-interaction') {
    if (state.interaction.status === 'channeling') return state;
    const target = getAvailableInteraction({
      room: action.room,
      player: state.player,
      currentHealth: state.currentHealth,
      maximumHealth: state.maximumHealth,
      enemies: state.enemies,
      runtime: state.interactables,
    });
    if (!target || target.id !== action.targetId) return state;
    return {
      ...state,
      interactables: {
        ...state.interactables,
        [target.id]: {
          ...state.interactables[target.id],
          depleted: false,
          encounteredAt: state.interactables[target.id]?.encounteredAt ?? action.timestamp,
          usedAt: null,
          healthWhenUsed: null,
          resonanceAwarded: state.interactables[target.id]?.resonanceAwarded ?? false,
          cancellationReasons: state.interactables[target.id]?.cancellationReasons ?? [],
        },
      },
      interaction: {
        targetId: target.id,
        type: target.type,
        startedAt: action.timestamp,
        deadline: action.timestamp + target.channelDurationMs,
        remainingMs: target.channelDurationMs,
        status: 'channeling',
        cancellationReason: null,
        result: null,
      },
      announcement:
        target.type === 'resonance-cache' ? 'Opening Resonance Cache…' : 'Restoring health…',
    };
  }
  if (action.type === 'interaction-unavailable-feedback')
    return {
      ...state,
      interaction: {
        ...createIdleInteractionState(),
        targetId: action.targetId,
        type: 'restoration-fountain',
        startedAt: action.timestamp,
        status: 'cancelled',
        cancellationReason: 'unavailable',
      },
      announcement: 'Health is already full.',
    };
  if (action.type === 'interaction-tick') {
    const channel = state.interaction;
    if (channel.status !== 'channeling' || !channel.targetId || channel.deadline === null)
      return state;
    if (
      !isInteractionTargetValid(channel.targetId, {
        room: action.room,
        player: state.player,
        currentHealth: state.currentHealth,
        maximumHealth: state.maximumHealth,
        enemies: state.enemies,
        runtime: state.interactables,
      })
    )
      return cancelInteraction(
        state,
        isAnyLivingRatAlerted(state.enemies) ? 'combat-alert' : 'unavailable',
      );
    if (action.timestamp < channel.deadline)
      return {
        ...state,
        interaction: { ...channel, remainingMs: channel.deadline - action.timestamp },
      };
    if (state.interactables[channel.targetId]?.depleted) return state;
    if (channel.type === 'resonance-cache') {
      const runtime = state.interactables[channel.targetId];
      if (!runtime) return cancelInteraction(state, 'unavailable');
      const reward = awardResonance(state.resonance, Boolean(runtime.resonanceAwarded));
      if (!reward.awarded) return state;
      return {
        ...state,
        resonance: reward.resonance,
        interactables: {
          ...state.interactables,
          [channel.targetId]: {
            ...runtime,
            depleted: true,
            usedAt: action.timestamp,
            healthWhenUsed: state.currentHealth,
            resonanceAwarded: true,
          },
        },
        interaction: {
          ...channel,
          deadline: null,
          remainingMs: 0,
          status: 'completed',
          result: 'awarded-resonance',
        },
        announcement: `Resonance Shard collected. Resonance ${reward.resonance}.`,
      };
    }
    return {
      ...state,
      currentHealth: Math.min(state.maximumHealth, state.currentHealth + 1),
      interactables: {
        ...state.interactables,
        [channel.targetId]: {
          ...state.interactables[channel.targetId],
          depleted: true,
          usedAt: action.timestamp,
          healthWhenUsed: state.currentHealth,
        },
      },
      interaction: {
        ...channel,
        deadline: null,
        remainingMs: 0,
        status: 'completed',
        result: 'restored-one-health',
      },
      announcement: `Health restored. ${Math.min(state.maximumHealth, state.currentHealth + 1)} of ${state.maximumHealth} health.`,
    };
  }
  if (action.type === 'shield') {
    if (state.player.isShielding === action.isShielding) return state;
    const timestamp = action.timestamp ?? Date.now();
    const duration =
      !action.isShielding && state.adaptation.shieldStartedAt !== null
        ? Math.max(0, timestamp - state.adaptation.shieldStartedAt)
        : 0;
    const adaptation = withMeaningfulAction(state.adaptation, timestamp);
    const next = {
      ...state,
      player: {
        ...state.player,
        isShielding: action.isShielding,
        shieldDirection: action.isShielding ? state.player.facing : null,
      },
      shieldTiming: action.isShielding
        ? { raisedAt: timestamp, lastFacingChangedAt: null }
        : createShieldTimingState(),
      adaptation: {
        ...adaptation,
        shieldStartedAt: action.isShielding ? timestamp : null,
        signals: {
          ...adaptation.signals,
          shieldActivations: adaptation.signals.shieldActivations + (action.isShielding ? 1 : 0),
          shieldTimeMs: adaptation.signals.shieldTimeMs + duration,
        },
      },
      announcement: action.isShielding ? 'Shield raised.' : 'Shield lowered.',
    };
    return action.isShielding ? cancelInteraction(next, 'shield') : next;
  }
  if (action.type === 'attack') {
    if (state.attackCooldown.readyAt !== null && action.timestamp < state.attackCooldown.readyAt)
      return state;
    const attack = createAttackAction(
      state.player,
      getCollisionContext(action.room),
      action.id,
      action.timestamp,
    );
    const adaptation = withMeaningfulAction(state.adaptation, action.timestamp);
    const ratResult = applySwordToRats(state, attack, action.timestamp);
    const attackedPositions = state.enemies.rats
      .filter((rat) => ratResult.attackedRatIds.includes(rat.id))
      .map((rat) => rat.position);
    const rats = ratResult.enemies.rats.map((rat) => {
      if (!isLivingRat(rat) || attackedPositions.length === 0) return rat;
      const shouldAlert =
        ratResult.attackedRatIds.includes(rat.id) ||
        attackedPositions.some((position) => {
          const distance = action.room ? pathDistance(action.room, rat.position, position) : null;
          return distance !== null && distance <= RAT_COMBAT_CONFIG.alertPropagationRangeTiles;
        });
      if (!shouldAlert || rat.awareness === 'alerted') return rat;
      return {
        ...rat,
        awareness: 'alerted' as const,
        state: rat.state === 'idle' ? ('chasing' as const) : rat.state,
        nextMovementAt:
          rat.state === 'idle' ? action.timestamp + RAT_MOVEMENT_INTERVAL_MS : rat.nextMovementAt,
      };
    });
    const alertedCount = rats.filter(
      (rat) => isLivingRat(rat) && rat.awareness === 'alerted',
    ).length;
    const enemies = {
      ...ratResult.enemies,
      rats,
      combatMetrics: {
        ...ratResult.enemies.combatMetrics,
        swordSwings: ratResult.enemies.combatMetrics.swordSwings + 1,
        maximumSimultaneouslyAlertedRats: Math.max(
          ratResult.enemies.combatMetrics.maximumSimultaneouslyAlertedRats,
          alertedCount,
        ),
      },
    };
    return cancelInteraction(
      {
        ...state,
        adaptation: {
          ...adaptation,
          signals: {
            ...adaptation.signals,
            swordSwings: adaptation.signals.swordSwings + 1,
            swordSwingsAtEnemies: adaptation.signals.swordSwingsAtEnemies + (ratResult.hit ? 1 : 0),
            ratsDamaged: adaptation.signals.ratsDamaged + ratResult.damaged,
            ratsDefeated: adaptation.signals.ratsDefeated + ratResult.defeated,
          },
        },
        enemies,
        runStats: {
          ...state.runStats,
          enemiesDefeated: state.runStats.enemiesDefeated + ratResult.defeated,
        },
        lastAttack: attack,
        attackCooldown: { readyAt: action.timestamp + ATTACK_COOLDOWN_MS },
        announcement: attack.target
          ? ratResult.defeated
            ? 'Rat defeated.'
            : ratResult.hit
              ? 'Rat injured.'
              : `Attacked ${attack.facing}.`
          : 'Attacked beyond the room boundary.',
      },
      'attack',
    );
  }
  if (action.type === 'turn') {
    if (state.player.facing === action.direction) return state;
    const adaptation =
      action.trigger === 'repeat'
        ? state.adaptation
        : withMeaningfulAction(state.adaptation, action.timestamp ?? Date.now());
    return cancelInteraction(
      {
        ...state,
        adaptation: {
          ...adaptation,
          signals: {
            ...adaptation.signals,
            directionChanges:
              adaptation.signals.directionChanges + (action.trigger === 'repeat' ? 0 : 1),
          },
        },
        player: turnPlayer(state.player, action.direction),
        shieldTiming: state.player.isShielding
          ? { ...state.shieldTiming, lastFacingChangedAt: action.timestamp ?? Date.now() }
          : state.shieldTiming,
        announcement: `Facing ${action.direction}.`,
      },
      'turned-away',
    );
  }
  if (action.type === 'move') {
    const next = movePlayer(state, action);
    return next.player.position.row !== state.player.position.row ||
      next.player.position.column !== state.player.position.column
      ? cancelInteraction(next, 'movement')
      : next;
  }
  if (
    action.type === 'commit-room-transition' &&
    state.evaluationProgress &&
    state.dungeonProgress
  ) {
    const dungeonRoomsCleared =
      state.runStats.dungeonRoomsCleared + (action.incrementDungeonRooms ? 1 : 0);
    const adaptation = completeRoomSignals(state, action);
    const enemies = action.enemies ?? emptyEnemyRoomState(action.destinationRoomId);
    const completedGeneratedFountain = state.dungeonProgress.currentRoom
      ? getRestorationFountains(state.dungeonProgress.currentRoom.roomSnapshot).find(
          (feature) => feature.source === 'generated',
        )
      : undefined;
    const completedGeneratedFountainUsed = Boolean(
      completedGeneratedFountain && state.interactables[completedGeneratedFountain.id]?.depleted,
    );
    adaptation.signals.ratsSpawned = livingRats(enemies).length;
    return {
      ...state,
      player: {
        ...state.player,
        position: action.destinationSpawn,
        isShielding: false,
        shieldDirection: null,
      },
      shieldTiming: createShieldTimingState(),
      invulnerability: createInvulnerabilityState(),
      runStats: { ...state.runStats, dungeonRoomsCleared, roomsCleared: dungeonRoomsCleared },
      evaluationProgress: {
        ...state.evaluationProgress,
        currentRoomId: action.destinationRoomId,
        currentRoomIndex: action.destinationRoomIndex,
        enteredFrom: action.enteredFrom,
        roomEnteredAtMs: action.exitedAtMs,
        exitChoices: action.exitChoice
          ? [...state.evaluationProgress.exitChoices, action.exitChoice]
          : state.evaluationProgress.exitChoices,
        evaluationComplete: action.evaluationComplete,
      },
      dungeonProgress: {
        ...state.dungeonProgress,
        dungeonRoomNumber:
          action.generatedRoom?.dungeonRoomNumber ?? state.dungeonProgress.dungeonRoomNumber,
        currentRoom: action.generatedRoom ?? state.dungeonProgress.currentRoom,
        enteredFrom: action.generatedRoom ? action.enteredFrom : state.dungeonProgress.enteredFrom,
        chosenExitIds: action.chosenExitId
          ? [...state.dungeonProgress.chosenExitIds, action.chosenExitId].slice(-5)
          : state.dungeonProgress.chosenExitIds,
        pokeCooldown: action.nextPokeCooldown ?? state.dungeonProgress.pokeCooldown,
        previousMode: action.nextMode ?? state.dungeonProgress.previousMode,
        provenance: action.generatedRoom
          ? updateGenerationProvenance(
              state.dungeonProgress.provenance,
              action.generatedRoom.generatorVersion,
              action.generatedRoom.adaptationVersion ?? 'rules-1',
              action.generatedRoom.dungeonRoomNumber,
            )
          : state.dungeonProgress.provenance,
        lastChosenExitId: action.chosenExitId ?? state.dungeonProgress.lastChosenExitId,
        lastChosenExitDirection:
          action.exitDirection ?? state.dungeonProgress.lastChosenExitDirection,
        previousEntranceDirection: action.generatedRoom
          ? (state.dungeonProgress.currentRoom?.details.entranceDirection ??
            state.evaluationProgress.enteredFrom)
          : state.dungeonProgress.previousEntranceDirection,
        nextEntranceDirection: action.generatedRoom
          ? action.enteredFrom
          : state.dungeonProgress.nextEntranceDirection,
        recentDecisionRecords:
          state.dungeonProgress.currentRoom &&
          action.generatedRoom &&
          action.chosenExitId &&
          action.exitDirection
            ? [
                ...(state.dungeonProgress.recentDecisionRecords ?? []),
                createRoomDecisionRecord(
                  state.dungeonProgress.currentRoom,
                  action.chosenExitId,
                  action.exitDirection,
                  action.enteredFrom,
                  state,
                ),
              ].slice(-5)
            : state.dungeonProgress.recentDecisionRecords,
        completedDecisionCount:
          (state.dungeonProgress.completedDecisionCount ?? 0) +
          (state.dungeonProgress.currentRoom && action.generatedRoom ? 1 : 0),
        recovery: action.generatedRoom
          ? {
              cooldownRemaining:
                action.generatedRoom.details.recoveryDecision?.cooldownAfter ??
                state.dungeonProgress.recovery?.cooldownRemaining ??
                0,
              roomsSinceLastGeneratedSpawn: action.generatedRoom.details.recoveryDecision?.spawned
                ? 0
                : (state.dungeonProgress.recovery?.roomsSinceLastGeneratedSpawn ?? 0) + 1,
              roomsSinceLastUse: completedGeneratedFountainUsed
                ? 0
                : (state.dungeonProgress.recovery?.roomsSinceLastUse ?? 0) + 1,
              previousSkipped: Boolean(
                completedGeneratedFountain && !completedGeneratedFountainUsed,
              ),
            }
          : state.dungeonProgress.recovery,
      },
      adaptation,
      enemies,
      interaction:
        state.interaction.status === 'channeling'
          ? {
              ...createIdleInteractionState(),
              status: 'cancelled',
              cancellationReason: 'room-transition',
            }
          : createIdleInteractionState(),
      interactables:
        action.destinationRoom || action.generatedRoom?.roomSnapshot
          ? createInteractableRuntimeStates(
              action.destinationRoom ?? action.generatedRoom!.roomSnapshot,
            )
          : {},
      lastMove: null,
      blockedMove: null,
      lastAttack: null,
      lastDamage: null,
      lastAvoidedDamage: null,
      announcement: action.generatedRoom
        ? `Entered Dungeon Room ${action.generatedRoom.dungeonRoomNumber}.`
        : 'Entered the next Awakening Chamber.',
    };
  }
  if (
    action.type === 'invulnerability-expired' &&
    state.runStats.runId === action.runId &&
    state.invulnerability.expiresAt === action.expectedExpiresAt &&
    action.timestamp >= action.expectedExpiresAt
  ) {
    const pendingRune = state.invulnerability.pendingRune;
    const expiredState = { ...state, invulnerability: createInvulnerabilityState() };
    return pendingRune && positionsMatch(state.player.position, pendingRune)
      ? applyPlayerDamage(expiredState, {
          id: `delayed-rune-${action.expectedExpiresAt}`,
          source: 'rune',
          amount: 1,
          timestamp: action.expectedExpiresAt,
        })
      : expiredState;
  }
  return state;
}

export interface RestorableGameplayRun {
  status: Exclude<GameplayStatus, 'idle'>;
  runId: string;
  elapsedMs: number;
  currentHealth: number;
  resonance?: number;
  player: Pick<PlayerState, 'position' | 'facing'>;
  dungeonRoomsCleared: number;
  roomsCleared?: number;
  enemiesDefeated: number;
  evaluationProgress: EvaluationProgress;
  dungeonProgress: DungeonProgress;
  experiencePreset: ExperiencePreset;
  adaptation: AdaptiveRunState;
  enemies: StoredEnemyRoomState;
  pause: RunPauseState;
  invulnerabilityRemainingMs: number;
  pendingRune: GridPosition | null;
  attackCooldownRemainingMs: number;
  interaction?: InteractionChannelState;
  interactables?: InteractableRuntimeStates;
}

export function restoreGameplayState(
  snapshot: RestorableGameplayRun,
  maximumHealth: number,
  now: number,
): GameplayState {
  const base = createGameplayState(maximumHealth);
  const elapsedMs = Math.max(0, Math.trunc(snapshot.elapsedMs));
  const dungeonRoomsCleared = Math.max(
    0,
    Math.trunc(snapshot.dungeonRoomsCleared ?? snapshot.roomsCleared ?? 0),
  );
  const enemies: EnemyRoomState = {
    roomId: snapshot.enemies.roomId,
    aiFrozen: snapshot.enemies.aiFrozen,
    countPlan: snapshot.enemies.countPlan,
    lastBlockAt:
      snapshot.enemies.lastBlockRemainingMs > 0
        ? now + snapshot.enemies.lastBlockRemainingMs
        : null,
    lastBlockKind: snapshot.enemies.lastBlockKind,
    lastTickAt: now,
    awarenessGraceEndsAt:
      snapshot.enemies.awarenessGraceRemainingMs > 0
        ? now + snapshot.enemies.awarenessGraceRemainingMs
        : null,
    combatMetrics: snapshot.enemies.combatMetrics,
    rats: snapshot.enemies.rats.map((rat) => ({
      id: rat.id,
      type: rat.type,
      position: rat.position,
      facing: rat.facing,
      awareness: rat.awareness,
      health: rat.health,
      state: rat.state,
      lockedTarget: rat.lockedTarget,
      nextMovementAt: rat.movementRemainingMs > 0 ? now + rat.movementRemainingMs : null,
      telegraphEndsAt: rat.telegraphRemainingMs > 0 ? now + rat.telegraphRemainingMs : null,
      lungeEndsAt: rat.lungeRemainingMs > 0 ? now + rat.lungeRemainingMs : null,
      recoveryEndsAt: rat.recoveryRemainingMs > 0 ? now + rat.recoveryRemainingMs : null,
      recoveryKind: rat.recoveryKind,
      attackOutcome: rat.attackOutcome,
      corpseEndsAt: rat.corpseRemainingMs > 0 ? now + rat.corpseRemainingMs : null,
      hitFlashUntil: rat.hitFlashRemainingMs > 0 ? now + rat.hitFlashRemainingMs : null,
      defeatCounted: rat.defeatCounted,
      spawnSource: rat.spawnSource,
      spawnReason: rat.spawnReason,
      authoredSpawnNumber: rat.authoredSpawnNumber,
      nextPathStep: rat.nextPathStep,
      pathDistanceToPlayer: rat.pathDistanceToPlayer,
      pathBlocked: rat.pathBlocked,
      bodyLockPreventionApplied: rat.bodyLockPreventionApplied,
    })),
  };
  return {
    ...base,
    status: snapshot.status,
    player: { ...base.player, position: snapshot.player.position, facing: snapshot.player.facing },
    currentHealth: clampHealth(snapshot.currentHealth, base.maximumHealth),
    resonance: normalizeResonance(snapshot.resonance),
    pause: snapshot.pause.isPaused
      ? {
          isPaused: true,
          reason: snapshot.pause.reason,
          pausedAt: now,
          totalPausedMs: snapshot.pause.totalPausedMs,
        }
      : {
          isPaused: false,
          totalPausedMs: snapshot.pause.totalPausedMs,
        },
    invulnerability: {
      expiresAt:
        snapshot.invulnerabilityRemainingMs > 0 ? now + snapshot.invulnerabilityRemainingMs : null,
      pendingRune: snapshot.invulnerabilityRemainingMs > 0 ? snapshot.pendingRune : null,
    },
    attackCooldown: {
      readyAt:
        snapshot.attackCooldownRemainingMs > 0 ? now + snapshot.attackCooldownRemainingMs : null,
    },
    runStats: {
      runId: snapshot.runId,
      startedAt: now - elapsedMs - snapshot.pause.totalPausedMs,
      timeSurvived: snapshot.status === 'defeated' ? elapsedMs : null,
      dungeonRoomsCleared,
      roomsCleared: dungeonRoomsCleared,
      enemiesDefeated: Math.max(0, Math.trunc(snapshot.enemiesDefeated)),
    },
    experiencePreset: snapshot.experiencePreset,
    evaluationProgress: snapshot.evaluationProgress,
    dungeonProgress: snapshot.dungeonProgress,
    adaptation: snapshot.adaptation,
    enemies,
    interaction:
      snapshot.interaction?.status === 'channeling'
        ? {
            ...snapshot.interaction,
            deadline: now + Math.max(0, snapshot.interaction.remainingMs),
          }
        : (snapshot.interaction ?? createIdleInteractionState()),
    interactables: snapshot.interactables ?? {},
    announcement: snapshot.status === 'defeated' ? 'You were defeated.' : '',
  };
}

export function getTimeSurvived(
  runStats: RunStats,
  now: number,
  pause: RunPauseState = createPauseState(),
): number {
  if (runStats.timeSurvived !== null) return runStats.timeSurvived;
  if (runStats.startedAt === null) return 0;
  const currentPauseMs = pause.isPaused ? Math.max(0, now - pause.pausedAt) : 0;
  return Math.max(0, now - runStats.startedAt - pause.totalPausedMs - currentPauseMs);
}
export function formatSurvivalTime(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

export { createBehaviorSignals };
