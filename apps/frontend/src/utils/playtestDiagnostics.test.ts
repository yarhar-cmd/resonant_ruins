import { describe, expect, it } from 'vitest';
import { evaluationRooms } from '../data/rooms/evaluationRooms';
import { createRoomEnemyState } from './enemySystem';
import { createFreshRun } from './runLifecycle';
import {
  formatDiagnosticTile,
  formatPlaytestDiagnosticSummary,
  remainingDiagnosticTime,
  selectPlaytestDiagnostics,
} from './playtestDiagnostics';

function diagnosticFixture() {
  const room = evaluationRooms[3]!;
  const gameplay = createFreshRun({
    maximumHealth: 6,
    experiencePreset: 'seasoned-adventurer',
    startedAt: 1_000,
    runId: 'diagnostic-run',
    runSeed: 'diagnostic-seed',
  });
  const enemies = createRoomEnemyState(room, 'seasoned-adventurer', 10_000);
  enemies.rats[0] = {
    ...enemies.rats[0]!,
    facing: 'left',
    awareness: 'alerted',
    state: 'telegraphing',
    lockedTarget: { x: 8, y: 5 },
    telegraphEndsAt: 10_600,
    nextPathStep: { x: 8, y: 5 },
    pathDistanceToPlayer: 3,
    bodyLockPreventionApplied: true,
  };
  enemies.combatMetrics = {
    ...enemies.combatMetrics,
    attacksStarted: 4,
    attacksLanded: 1,
    attacksDodged: 2,
    regularBlocks: 1,
    perfectBlocks: 1,
    swordSwings: 5,
    playerHitsLanded: 3,
    playerDamageTaken: 1,
    bodyLockPreventionActivations: 2,
    maximumSimultaneouslyAlertedRats: 2,
    combatDurationMs: 8_250,
  };
  return {
    room,
    gameplay: {
      ...gameplay,
      currentHealth: 5,
      enemies,
      player: { ...gameplay.player, facing: 'right' as const, isShielding: true },
      evaluationProgress: {
        ...gameplay.evaluationProgress!,
        currentRoomIndex: 3,
        currentRoomId: room.id,
      },
    },
  };
}

describe('preview-safe Playtest Diagnostics selectors', () => {
  it('formats tiles and clamps authoritative timer deadlines', () => {
    expect(formatDiagnosticTile({ x: 8, y: 5 })).toBe('8,5');
    expect(formatDiagnosticTile(null)).toBe('none');
    expect(remainingDiagnosticTime(10_600, 10_125)).toBe(475);
    expect(remainingDiagnosticTime(9_000, 10_125)).toBe(0);
    expect(remainingDiagnosticTime(null, 10_125)).toBe(0);
  });

  it('selects room, player, combat, and per-Rat values from reducer-owned state', () => {
    const { room, gameplay } = diagnosticFixture();
    const snapshot = selectPlaytestDiagnostics(gameplay, room, 10_125, true);

    expect(snapshot.room).toMatchObject({
      number: 4,
      seed: 'authored-room',
      gameVersion: 'mvp-0.2',
      generatorVersion: 'generator-2',
      adaptationVersion: 'rules-1',
      type: 'Awakening Chamber',
      mode: 'not applicable',
    });
    expect(snapshot.player).toMatchObject({
      facing: 'right',
      shielding: true,
      currentHealth: 5,
      maximumHealth: 6,
      invulnerable: true,
    });
    expect(snapshot.player.legalEscapeTiles.length).toBeGreaterThan(0);
    expect(snapshot.combat).toMatchObject({
      attacksStarted: 4,
      attacksLanded: 1,
      attacksDodged: 2,
      regularBlocks: 1,
      perfectBlocks: 1,
      swordSwings: 5,
      swordHits: 3,
      bodyLockPreventionActivations: 2,
      maximumSimultaneouslyAlertedRats: 2,
      combatDurationMs: 8_250,
    });
    expect(snapshot.rats[0]).toMatchObject({
      id: 'evaluation-room-04-rat-1',
      awareness: 'alerted',
      state: 'telegraphing',
      telegraphRemainingMs: 475,
      pathDistanceToPlayer: 3,
      nextMovementTile: { x: 8, y: 5 },
      bodyLockPreventionApplied: true,
    });
  });

  it('copies only compact gameplay diagnostics and required counters', () => {
    const { room, gameplay } = diagnosticFixture();
    const summary = formatPlaytestDiagnosticSummary(
      selectPlaytestDiagnostics(gameplay, room, 10_125),
    );

    expect(summary).toContain('Room 4 | seed authored-room');
    expect(summary).toContain('game=mvp-0.2 generator=generator-2');
    expect(summary).toContain('Player tile=1,5 facing=right');
    expect(summary).toContain(
      'Rat evaluation-room-04-rat-1 tile=9,5 facing=left awareness=alerted state=telegraphing',
    );
    expect(summary).toContain('timers=475/0/0ms');
    expect(summary).toContain('bodyLockPreventions=2');
    expect(summary).not.toContain('localStorage');
  });
});
