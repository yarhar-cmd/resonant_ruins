import { describe, expect, it } from 'vitest';
import type { RatEnemy } from '../types/enemies';
import type { GameplayState } from './gameplayState';
import { createGameplayState } from './gameplayState';
import { deriveGameplayAudioEvents, type GameplayAudioSnapshot } from './gameplayAudioEvents';

function activeState(): GameplayState {
  const state = createGameplayState(6);
  return {
    ...state,
    status: 'active',
    runStats: { ...state.runStats, runId: 'audio-run', startedAt: 1_000 },
  };
}

function snapshot(gameplay: GameplayState, roomId = 'room-a'): GameplayAudioSnapshot {
  return { gameplay, roomId };
}

function eventNames(previous: GameplayAudioSnapshot | null, next: GameplayAudioSnapshot) {
  return deriveGameplayAudioEvents(previous, next).map(({ name }) => name);
}

function rat(overrides: Partial<RatEnemy> = {}): RatEnemy {
  return {
    id: 'rat-1',
    type: 'rat',
    position: { x: 2, y: 2 },
    facing: 'left',
    awareness: 'unaware',
    health: 2,
    state: 'idle',
    lockedTarget: null,
    nextMovementAt: null,
    telegraphEndsAt: null,
    lungeEndsAt: null,
    recoveryEndsAt: null,
    recoveryKind: null,
    attackOutcome: null,
    corpseEndsAt: null,
    hitFlashUntil: null,
    defeatCounted: false,
    spawnSource: 'generated',
    spawnReason: 'test',
    nextPathStep: null,
    pathDistanceToPlayer: null,
    pathBlocked: false,
    bodyLockPreventionApplied: false,
    ...overrides,
  };
}

describe('gameplay-to-audio presentation events', () => {
  it('emits no restore sound, no run-change sound, and no sound for turning in place', () => {
    const before = activeState();
    const turned = { ...before, player: { ...before.player, facing: 'down' as const } };
    expect(eventNames(null, snapshot(before))).toEqual([]);
    expect(eventNames(snapshot(before), snapshot(turned))).toEqual([]);
    expect(
      eventNames(
        snapshot(before),
        snapshot({ ...turned, runStats: { ...turned.runStats, runId: 'new' } }),
      ),
    ).toEqual([]);
  });

  it('distinguishes successful steps, blocked movement, sword swing, and sword hit', () => {
    const before = activeState();
    const step = {
      ...before,
      lastMove: {
        id: 'move-1',
        source: { row: 1, column: 1 },
        attemptedTarget: { row: 1, column: 2 },
        target: { row: 1, column: 2 },
        facing: 'right' as const,
        moved: true,
        blockedReason: null,
      },
    };
    expect(eventNames(snapshot(before), snapshot(step))).toEqual(['player.step']);
    const bump = {
      ...step,
      lastMove: { ...step.lastMove!, id: 'move-2', moved: false, blockedReason: 'tile' as const },
    };
    expect(eventNames(snapshot(step), snapshot(bump))).toEqual(['player.wall-bump']);

    const attack = {
      ...bump,
      lastAttack: {
        id: 'attack-1',
        source: { row: 1, column: 2 },
        attemptedTarget: { row: 1, column: 3 },
        target: { row: 1, column: 3 },
        facing: 'right' as const,
        damage: 1 as const,
        timestamp: 2_000,
        blockedReason: null,
      },
      enemies: {
        ...bump.enemies,
        combatMetrics: { ...bump.enemies.combatMetrics, playerHitsLanded: 1 },
      },
    };
    expect(eventNames(snapshot(bump), snapshot(attack))).toEqual([
      'player.attack-swing',
      'player.attack-hit',
    ]);
  });

  it('emits shield raise and distinguishes regular from perfect block', () => {
    const before = activeState();
    const raised = { ...before, player: { ...before.player, isShielding: true } };
    expect(eventNames(snapshot(before), snapshot(raised))).toEqual(['shield.raise']);
    const regular = {
      ...raised,
      enemies: { ...raised.enemies, lastBlockAt: 2_000, lastBlockKind: 'regular' as const },
    };
    expect(eventNames(snapshot(raised), snapshot(regular))).toEqual(['shield.block']);
    const perfect = {
      ...regular,
      enemies: { ...regular.enemies, lastBlockAt: 2_100, lastBlockKind: 'perfect' as const },
    };
    expect(eventNames(snapshot(regular), snapshot(perfect))).toEqual(['shield.perfect-block']);
  });

  it('emits one-shot Rat awareness, telegraph, attack, damage, and defeat transitions', () => {
    const before = activeState();
    const withRat = { ...before, enemies: { ...before.enemies, rats: [rat()] } };
    const alertedRat = rat({ awareness: 'alerted', state: 'chasing' });
    const alerted = { ...withRat, enemies: { ...withRat.enemies, rats: [alertedRat] } };
    expect(eventNames(snapshot(withRat), snapshot(alerted))).toEqual(['rat.alert']);
    expect(eventNames(snapshot(alerted), snapshot(alerted))).toEqual([]);
    const telegraph = {
      ...alerted,
      enemies: { ...alerted.enemies, rats: [{ ...alertedRat, state: 'telegraphing' as const }] },
    };
    expect(eventNames(snapshot(alerted), snapshot(telegraph))).toEqual(['rat.telegraph']);
    const lunge = {
      ...telegraph,
      enemies: { ...telegraph.enemies, rats: [{ ...alertedRat, state: 'lunging' as const }] },
    };
    expect(eventNames(snapshot(telegraph), snapshot(lunge))).toEqual(['rat.attack']);
    const hurt = {
      ...lunge,
      enemies: { ...lunge.enemies, rats: [{ ...alertedRat, health: 1 }] },
    };
    expect(eventNames(snapshot(lunge), snapshot(hurt))).toEqual(['rat.damage']);
    const defeated = {
      ...hurt,
      enemies: { ...hurt.enemies, rats: [{ ...alertedRat, health: 0, state: 'corpse' as const }] },
    };
    expect(eventNames(snapshot(hurt), snapshot(defeated))).toEqual(['rat.defeat']);
  });

  it('routes Rune damage, interactions, room transitions, and defeat without mutating state', () => {
    const before = activeState();
    const original = structuredClone(before);
    const runeDamage = {
      ...before,
      currentHealth: 5,
      lastDamage: {
        id: 'rune-1',
        source: 'rune' as const,
        amount: 1,
        timestamp: 2_000,
        fatal: false,
      },
    };
    expect(eventNames(snapshot(before), snapshot(runeDamage))).toEqual([
      'rune.trigger',
      'player.damage',
    ]);
    expect(before).toEqual(original);

    const channeling = {
      ...runeDamage,
      interaction: {
        ...runeDamage.interaction,
        targetId: 'fountain-1',
        type: 'restoration-fountain' as const,
        status: 'channeling' as const,
      },
    };
    expect(eventNames(snapshot(runeDamage), snapshot(channeling))).toEqual(['fountain.channel']);
    const healed = {
      ...channeling,
      interaction: {
        ...channeling.interaction,
        status: 'completed' as const,
        result: 'restored-one-health' as const,
      },
    };
    expect(eventNames(snapshot(channeling), snapshot(healed))).toEqual(['fountain.heal']);

    const cache = {
      ...healed,
      interaction: {
        ...healed.interaction,
        targetId: 'cache-1',
        type: 'resonance-cache' as const,
        status: 'channeling' as const,
        result: null,
      },
    };
    expect(eventNames(snapshot(healed), snapshot(cache))).toEqual(['cache.open']);
    const collected = {
      ...cache,
      interaction: {
        ...cache.interaction,
        status: 'completed' as const,
        result: 'awarded-resonance' as const,
      },
    };
    expect(eventNames(snapshot(cache), snapshot(collected))).toEqual(['resonance.collect']);
    expect(eventNames(snapshot(collected, 'room-a'), snapshot(collected, 'room-b'))).toEqual([
      'exit.activate',
      'room.transition',
    ]);

    const defeated = { ...collected, status: 'defeated' as const };
    expect(eventNames(snapshot(collected), snapshot(defeated))).toEqual(['run.defeat']);
  });
});
