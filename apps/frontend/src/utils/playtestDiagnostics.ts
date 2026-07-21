import { VERSION_INFO, type GeneratorVersion } from '../config/version';
import type { DirectionalExitDecision } from '../types/generation';
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
    archetype: string;
    boundaryFamily: string;
    requestedCandidates: number;
    validCandidates: number;
    rejectedCandidates: number;
    reducedDiversity: boolean;
    fallbackUsed: boolean;
    selectedCandidateRank: number | null;
    selectedCandidateScore: number | null;
    availableExitIds: string[];
    availableExitDirections: string[];
    exitDecisions: DirectionalExitDecision[];
    chosenExitId: string | null;
    chosenExitDirection: string | null;
    previousEntranceDirection: string | null;
    nextEntranceDirection: string | null;
    mixedGeneratorProvenance: boolean;
  };
  topology: RoomDefinition['topology'];
  asciiMap: string;
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
  const details = currentGeneratedRoom?.details;
  const provenance = gameplay.dungeonProgress?.provenance;

  return {
    room: {
      number:
        currentGeneratedRoom?.dungeonRoomNumber ??
        (gameplay.evaluationProgress ? gameplay.evaluationProgress.currentRoomIndex + 1 : 0),
      seed: currentGeneratedRoom?.roomSeed ?? 'authored-room',
      gameVersion:
        currentGeneratedRoom?.gameVersion ?? provenance?.gameVersion ?? VERSION_INFO.gameVersion,
      generatorVersion:
        currentGeneratedRoom?.generatorVersion ??
        provenance?.activeGeneratorVersion ??
        VERSION_INFO.generatorVersion,
      adaptationVersion:
        currentGeneratedRoom?.adaptationVersion ??
        provenance?.adaptationVersion ??
        VERSION_INFO.adaptationVersion,
      type: currentGeneratedRoom
        ? `generated ${currentGeneratedRoom.details.shape}`
        : room.phase === 'evaluation'
          ? 'Awakening Chamber'
          : room.phase,
      mode: currentGeneratedRoom?.details.mode ?? 'not applicable',
      archetype: details?.archetype ?? room.archetype ?? 'authored',
      boundaryFamily: details?.boundaryFamily ?? room.boundaryFamily ?? 'authored',
      requestedCandidates: details?.requestedCandidateCount ?? 0,
      validCandidates: details?.validCandidateCount ?? 0,
      rejectedCandidates: details?.rejectedCandidateCount ?? 0,
      reducedDiversity: details?.reducedDiversity ?? false,
      fallbackUsed: details?.fallbackUsed ?? false,
      selectedCandidateRank: details?.selectedCandidateRank ?? null,
      selectedCandidateScore: details?.selectedCandidateScore ?? null,
      availableExitIds: room.exits.map((exit) => exit.id),
      availableExitDirections: room.exits.map((exit) => exit.direction),
      exitDecisions: details?.exitDecisions ?? [],
      chosenExitId: gameplay.dungeonProgress?.lastChosenExitId ?? null,
      chosenExitDirection: gameplay.dungeonProgress?.lastChosenExitDirection ?? null,
      previousEntranceDirection: gameplay.dungeonProgress?.previousEntranceDirection ?? null,
      nextEntranceDirection: gameplay.dungeonProgress?.nextEntranceDirection ?? null,
      mixedGeneratorProvenance: gameplay.dungeonProgress?.provenance?.mixed ?? false,
    },
    topology: room.topology,
    asciiMap: formatAsciiRoom(room, gameplay),
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
    `Topology archetype=${snapshot.room.archetype} boundary=${snapshot.room.boundaryFamily} candidates=${snapshot.room.validCandidates}/${snapshot.room.requestedCandidates} rejected=${snapshot.room.rejectedCandidates} reduced=${snapshot.room.reducedDiversity} fallback=${snapshot.room.fallbackUsed}`,
    `Directions available=${snapshot.room.availableExitDirections.join(',')} chosen=${snapshot.room.chosenExitDirection ?? 'none'} previousEntrance=${snapshot.room.previousEntranceDirection ?? 'none'} nextEntrance=${snapshot.room.nextEntranceDirection ?? 'none'} mixed=${snapshot.room.mixedGeneratorProvenance}`,
    ...snapshot.room.exitDecisions.map(
      (exit) =>
        `Exit ${exit.exitId} direction=${exit.direction} distance=${exit.pathDistance} safeDistance=${exit.safePathDistance ?? 'none'} route=${exit.route}`,
    ),
  ];

  for (const rat of snapshot.rats) {
    lines.push(
      `Rat ${rat.id} tile=${formatDiagnosticTile(rat.position)} facing=${rat.facing} awareness=${rat.awareness} state=${rat.state} target=${formatDiagnosticTile(rat.lockedTarget)} timers=${rat.telegraphRemainingMs}/${rat.lungeRemainingMs}/${rat.recoveryRemainingMs}ms bodyLockAdjusted=${rat.bodyLockPreventionApplied}`,
    );
  }

  lines.push('ASCII ROOM', snapshot.asciiMap);

  return lines.join('\n');
}

export function formatAsciiRoom(room: RoomDefinition, gameplay: GameplayState): string {
  const floor = new Set(room.floorTiles.map(coordinateKey));
  const outer = new Set((room.outerWallTiles ?? room.wallTiles ?? []).map(coordinateKey));
  const internal = new Set((room.internalWallTiles ?? []).map(coordinateKey));
  const runes = new Set((room.hazards ?? []).map(coordinateKey));
  const rats = new Set(gameplay.enemies.rats.map((rat) => coordinateKey(rat.position)));
  const player = coordinateKey(gridPositionToCoordinate(gameplay.player.position));
  const exits = new Set(room.exits.map((exit) => coordinateKey(exit.tile)));
  const entrance = room.entrance ? coordinateKey(room.entrance.tile) : '';
  const lines: string[] = [];
  for (let y = 0; y < room.height; y += 1) {
    let line = '';
    for (let x = 0; x < room.width; x += 1) {
      const key = coordinateKey({ x, y });
      line +=
        key === player
          ? 'P'
          : rats.has(key)
            ? 'R'
            : runes.has(key)
              ? '^'
              : exits.has(key)
                ? 'E'
                : key === entrance
                  ? 'S'
                  : internal.has(key)
                    ? 'W'
                    : outer.has(key)
                      ? '#'
                      : floor.has(key)
                        ? '.'
                        : ' ';
    }
    lines.push(line.trimEnd());
  }
  return lines.join('\n');
}
