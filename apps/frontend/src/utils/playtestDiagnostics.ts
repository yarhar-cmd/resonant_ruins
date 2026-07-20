import { VERSION_INFO, type GeneratorVersion } from '../config/version';
import type { GameplayState } from './gameplayState';
import type { CardinalDirection } from '../types/player';
import type { RatAwareness, RatState } from '../types/enemies';
import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import { coordinateKey, gridPositionToCoordinate } from './roomGeometry';
import { playerLegalEscapeTiles } from './enemySystem';

export interface PlaytestRatDiagnostic {
  id: string;
  position: TileCoordinate;
  facing: CardinalDirection;
  awareness: RatAwareness;
  pathDistanceToPlayer: number | null;
  state: RatState;
  lockedTarget: TileCoordinate | null;
  telegraphRemainingMs: number;
  lungeRemainingMs: number;
  recoveryRemainingMs: number;
  nextMovementTile: TileCoordinate | null;
  pathBlocked: boolean;
  bodyLockPreventionApplied: boolean;
}

export interface PlaytestDiagnosticsSnapshot {
  room: {
    number: number;
    seed: string;
    gameVersion: string;
    generatorVersion: GeneratorVersion;
    adaptationVersion: string;
    type: string;
    mode: string;
  };
  player: {
    position: TileCoordinate;
    facing: CardinalDirection;
    shielding: boolean;
    legalEscapeTiles: TileCoordinate[];
    currentHealth: number;
    maximumHealth: number;
    invulnerable: boolean;
  };
  combat: {
    alertedRats: number;
    telegraphingRats: number;
    lungingRats: number;
    recoveringRats: number;
    attacksStarted: number;
    attacksLanded: number;
    attacksDodged: number;
    regularBlocks: number;
    perfectBlocks: number;
    swordSwings: number;
    swordHits: number;
    playerDamageTaken: number;
    bodyLockPreventionActivations: number;
    maximumSimultaneouslyAlertedRats: number;
    combatDurationMs: number;
  };
  rats: PlaytestRatDiagnostic[];
}

export function remainingDiagnosticTime(deadline: number | null, now: number): number {
  return deadline === null ? 0 : Math.max(0, Math.trunc(deadline - now));
}

export function formatDiagnosticTile(tile: TileCoordinate | null): string {
  return tile ? `${tile.x},${tile.y}` : 'none';
}

export function selectPlaytestDiagnostics(
  gameplay: GameplayState,
  room: RoomDefinition,
  now: number,
  transitionInvulnerable = false,
): PlaytestDiagnosticsSnapshot {
  const playerPosition = gridPositionToCoordinate(gameplay.player.position);
  const livingRats = gameplay.enemies.rats.filter(
    (rat) => rat.health > 0 && rat.state !== 'corpse',
  );
  const occupied = new Set(livingRats.map((rat) => coordinateKey(rat.position)));
  const generated = gameplay.dungeonProgress?.currentRoom;
  const currentGeneratedRoom = generated?.roomSnapshot.id === room.id ? generated : null;
  const metrics = gameplay.enemies.combatMetrics;

  return {
    room: {
      number:
        currentGeneratedRoom?.dungeonRoomNumber ??
        (gameplay.evaluationProgress ? gameplay.evaluationProgress.currentRoomIndex + 1 : 0),
      seed: currentGeneratedRoom?.roomSeed ?? 'authored-room',
      gameVersion: VERSION_INFO.gameVersion,
      generatorVersion: currentGeneratedRoom?.generatorVersion ?? VERSION_INFO.generatorVersion,
      adaptationVersion: VERSION_INFO.adaptationVersion,
      type: currentGeneratedRoom
        ? `generated ${currentGeneratedRoom.details.shape}`
        : room.phase === 'evaluation'
          ? 'Awakening Chamber'
          : room.phase,
      mode: currentGeneratedRoom?.details.mode ?? 'not applicable',
    },
    player: {
      position: playerPosition,
      facing: gameplay.player.facing,
      shielding: gameplay.player.isShielding,
      legalEscapeTiles: playerLegalEscapeTiles(room, playerPosition, occupied),
      currentHealth: gameplay.currentHealth,
      maximumHealth: gameplay.maximumHealth,
      invulnerable: transitionInvulnerable || gameplay.invulnerability.expiresAt !== null,
    },
    combat: {
      alertedRats: livingRats.filter((rat) => rat.awareness === 'alerted').length,
      telegraphingRats: livingRats.filter((rat) => rat.state === 'telegraphing').length,
      lungingRats: livingRats.filter((rat) => rat.state === 'lunging').length,
      recoveringRats: livingRats.filter((rat) => rat.state === 'recovering').length,
      attacksStarted: metrics.attacksStarted,
      attacksLanded: metrics.attacksLanded,
      attacksDodged: metrics.attacksDodged,
      regularBlocks: metrics.regularBlocks,
      perfectBlocks: metrics.perfectBlocks,
      swordSwings: metrics.swordSwings,
      swordHits: metrics.playerHitsLanded,
      playerDamageTaken: metrics.playerDamageTaken,
      bodyLockPreventionActivations: metrics.bodyLockPreventionActivations,
      maximumSimultaneouslyAlertedRats: metrics.maximumSimultaneouslyAlertedRats,
      combatDurationMs: metrics.combatDurationMs,
    },
    rats: gameplay.enemies.rats.map((rat) => ({
      id: rat.id,
      position: rat.position,
      facing: rat.facing,
      awareness: rat.awareness,
      pathDistanceToPlayer: rat.pathDistanceToPlayer,
      state: rat.state,
      lockedTarget: rat.lockedTarget,
      telegraphRemainingMs: remainingDiagnosticTime(rat.telegraphEndsAt, now),
      lungeRemainingMs: remainingDiagnosticTime(rat.lungeEndsAt, now),
      recoveryRemainingMs: remainingDiagnosticTime(rat.recoveryEndsAt, now),
      nextMovementTile: rat.nextPathStep,
      pathBlocked: rat.pathBlocked,
      bodyLockPreventionApplied: rat.bodyLockPreventionApplied,
    })),
  };
}

export function formatPlaytestDiagnosticSummary(snapshot: PlaytestDiagnosticsSnapshot): string {
  const lines = [
    'RESONANT RUINS PLAYTEST DIAGNOSTICS',
    `Room ${snapshot.room.number} | seed ${snapshot.room.seed}`,
    `Versions game=${snapshot.room.gameVersion} generator=${snapshot.room.generatorVersion} adaptation=${snapshot.room.adaptationVersion}`,
    `Player tile=${formatDiagnosticTile(snapshot.player.position)} facing=${snapshot.player.facing} shielding=${snapshot.player.shielding}`,
    `Combat started=${snapshot.combat.attacksStarted} landed=${snapshot.combat.attacksLanded} dodged=${snapshot.combat.attacksDodged} regularBlocks=${snapshot.combat.regularBlocks} perfectBlocks=${snapshot.combat.perfectBlocks}`,
    `Sword swings=${snapshot.combat.swordSwings} hits=${snapshot.combat.swordHits} playerDamage=${snapshot.combat.playerDamageTaken} bodyLockPreventions=${snapshot.combat.bodyLockPreventionActivations}`,
  ];

  for (const rat of snapshot.rats) {
    lines.push(
      `Rat ${rat.id} tile=${formatDiagnosticTile(rat.position)} facing=${rat.facing} awareness=${rat.awareness} state=${rat.state} target=${formatDiagnosticTile(rat.lockedTarget)} timers=${rat.telegraphRemainingMs}/${rat.lungeRemainingMs}/${rat.recoveryRemainingMs}ms bodyLockAdjusted=${rat.bodyLockPreventionApplied}`,
    );
  }

  return lines.join('\n');
}
