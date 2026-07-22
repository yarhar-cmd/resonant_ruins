import { describe, expect, it } from 'vitest';
import type { RoomDefinition } from '../types/rooms';
import type { ResonanceCacheFeature } from '../types/topology';
import { emptyEnemyRoomState } from './enemySystem';
import {
  applyPlayerDamage,
  createGameplayState,
  gameplayReducer,
  type GameplayState,
} from './gameplayState';
import { createInteractableRuntimeStates, getAvailableInteraction } from './interactions';
import { isWalkableCoordinate } from './roomGeometry';
import { createRatFromSpawn, findRatPath } from './enemySystem';

const cache: ResonanceCacheFeature = {
  id: 'cache-1',
  kind: 'resonance-cache',
  tile: { x: 3, y: 2 },
  blocking: true,
  rewardSystemVersion: 'rewards-1',
  placementCategory: 'optional-dead-end',
  spawnedReason: 'spawned',
  spawnRoll: 0.1,
  interactionTiles: [{ x: 2, y: 2 }],
  optionalRouteScore: 80,
  visualVariant: 'ruined-stone-coffer',
};

const room: RoomDefinition = {
  id: 'cache-gameplay-room',
  phase: 'dungeon',
  width: 7,
  height: 5,
  floorTiles: [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ],
  exits: [],
  features: [cache],
};

function activeState(): GameplayState {
  return {
    ...createGameplayState(6),
    status: 'active' as const,
    player: {
      position: { row: 2, column: 2 },
      facing: 'right' as const,
      isShielding: false,
      shieldDirection: null,
    },
    enemies: emptyEnemyRoomState(room.id),
    interactables: createInteractableRuntimeStates(room),
  };
}

function withRat(state: GameplayState, awareness: 'unaware' | 'alerted'): GameplayState {
  const rat = createRatFromSpawn(
    {
      id: `cache-${awareness}-rat`,
      type: 'rat',
      tile: { x: 1, y: 1 },
      order: 1,
      source: 'authored',
      reason: 'Cache combat-lock fixture',
    },
    0,
  );
  return {
    ...state,
    enemies: {
      ...state.enemies,
      rats: [
        awareness === 'alerted'
          ? { ...rat, awareness, state: 'chasing' as const }
          : { ...rat, awareness },
      ],
    },
  };
}

function startChannel(state = activeState()) {
  return gameplayReducer(state, {
    type: 'start-interaction',
    timestamp: 1_000,
    room,
    targetId: cache.id,
  });
}

describe('Resonance Cache gameplay interaction', () => {
  it('is solid before and after opening and offers the accessible prompt only while unopened', () => {
    const initial = activeState();
    expect(isWalkableCoordinate(room, cache.tile)).toBe(false);
    expect(
      getAvailableInteraction({
        room,
        player: initial.player,
        currentHealth: initial.currentHealth,
        maximumHealth: initial.maximumHealth,
        enemies: initial.enemies,
        runtime: initial.interactables,
      }),
    ).toMatchObject({
      id: cache.id,
      type: 'resonance-cache',
      prompt: 'E — Open Resonance Cache',
      accessibleLabel: 'Resonance Cache, unopened, grants one Resonance',
      channelDurationMs: 400,
    });
  });

  it('uses shared solid-feature rules for Rat pathing and sword blocking after opening too', () => {
    const ratPath = findRatPath(room, { x: 3, y: 3 }, { x: 3, y: 1 });
    expect(ratPath).not.toBeNull();
    expect(ratPath).not.toContainEqual(cache.tile);

    const attacked = gameplayReducer(activeState(), {
      type: 'attack',
      id: 'cache-solid-attack',
      timestamp: 500,
      room,
    });
    expect(attacked.lastAttack).toMatchObject({
      target: { row: 2, column: 3 },
      blockedReason: 'tile',
    });

    const opened = {
      ...activeState(),
      interactables: {
        [cache.id]: {
          ...activeState().interactables[cache.id]!,
          depleted: true,
          resonanceAwarded: true,
        },
      },
    };
    expect(isWalkableCoordinate(room, cache.tile)).toBe(false);
    expect(
      gameplayReducer(opened, {
        type: 'attack',
        id: 'cache-open-solid-attack',
        timestamp: 600,
        room,
      }).lastAttack,
    ).toMatchObject({ target: { row: 2, column: 3 }, blockedReason: 'tile' });
  });

  it('awards exactly one Resonance only after the 400 ms channel and is idempotent', () => {
    const started = gameplayReducer(activeState(), {
      type: 'start-interaction',
      timestamp: 1_000,
      room,
      targetId: cache.id,
    });
    expect(started.resonance).toBe(0);
    expect(
      gameplayReducer(started, { type: 'interaction-tick', timestamp: 1_399, room }).resonance,
    ).toBe(0);
    const completed = gameplayReducer(started, {
      type: 'interaction-tick',
      timestamp: 1_400,
      room,
    });
    expect(completed.resonance).toBe(1);
    expect(completed.interactables[cache.id]).toMatchObject({
      depleted: true,
      resonanceAwarded: true,
    });
    expect(
      gameplayReducer(completed, { type: 'interaction-tick', timestamp: 2_000, room }).resonance,
    ).toBe(1);
  });

  it('cancels on movement and preserves no partial reward', () => {
    const started = gameplayReducer(activeState(), {
      type: 'start-interaction',
      timestamp: 1_000,
      room,
      targetId: cache.id,
    });
    const moved = gameplayReducer(started, {
      type: 'move',
      direction: 'down',
      trigger: 'press',
      id: 'move-1',
      timestamp: 1_100,
      room,
    });
    expect(moved.interaction).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'movement',
    });
    expect(moved.resonance).toBe(0);
  });

  it('pauses the channel and resumes from the preserved remaining duration', () => {
    const started = gameplayReducer(activeState(), {
      type: 'start-interaction',
      timestamp: 1_000,
      room,
      targetId: cache.id,
    });
    const paused = gameplayReducer(started, {
      type: 'pause-run',
      timestamp: 1_100,
      reason: 'pause-menu',
    });
    expect(gameplayReducer(paused, { type: 'interaction-tick', timestamp: 2_000, room })).toBe(
      paused,
    );
    const resumed = gameplayReducer(paused, { type: 'resume-run', timestamp: 2_100 });
    expect(resumed.interaction.deadline).toBe(2_400);
    expect(
      gameplayReducer(resumed, { type: 'interaction-tick', timestamp: 2_400, room }).resonance,
    ).toBe(1);
  });

  it('uses the shared living-Rat combat lock without letting an unaware Rat block opening', () => {
    const unaware = withRat(activeState(), 'unaware');
    expect(startChannel(unaware).interaction.status).toBe('channeling');

    const alerted = withRat(activeState(), 'alerted');
    expect(startChannel(alerted)).toBe(alerted);
  });

  it('cancels without a reward when a Rat becomes alerted during the channel', () => {
    const started = startChannel(withRat(activeState(), 'unaware'));
    const alerted = withRat(started, 'alerted');
    const cancelled = gameplayReducer(alerted, {
      type: 'interaction-tick',
      timestamp: 1_100,
      room,
    });

    expect(cancelled.interaction).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'combat-alert',
    });
    expect(cancelled.interactables[cache.id]?.cancellationReasons).toContain('combat-alert');
    expect(cancelled.resonance).toBe(0);
  });

  it.each([
    [
      'turning',
      (state: ReturnType<typeof startChannel>) =>
        gameplayReducer(state, {
          type: 'turn',
          direction: 'up',
          trigger: 'press',
          timestamp: 1_100,
        }),
      'turned-away',
    ],
    [
      'attacking',
      (state: ReturnType<typeof startChannel>) =>
        gameplayReducer(state, { type: 'attack', id: 'cache-attack', timestamp: 1_100, room }),
      'attack',
    ],
    [
      'shielding',
      (state: ReturnType<typeof startChannel>) =>
        gameplayReducer(state, { type: 'shield', isShielding: true, timestamp: 1_100 }),
      'shield',
    ],
  ] as const)('cancels on %s', (_label, action, reason) => {
    const cancelled = action(startChannel());
    expect(cancelled.interaction).toMatchObject({
      status: 'cancelled',
      cancellationReason: reason,
    });
    expect(cancelled.resonance).toBe(0);
  });

  it('cancels on nonfatal damage and defeat with distinct telemetry reasons', () => {
    const damaged = applyPlayerDamage(startChannel(), {
      id: 'cache-damage',
      source: 'rune',
      amount: 1,
      timestamp: 1_100,
    });
    const defeated = applyPlayerDamage(
      { ...startChannel(), currentHealth: 1 },
      {
        id: 'cache-defeat',
        source: 'rat',
        amount: 1,
        timestamp: 1_100,
      },
    );

    expect(damaged.interaction.cancellationReason).toBe('damage');
    expect(defeated.interaction.cancellationReason).toBe('defeat');
    expect(damaged.resonance).toBe(0);
    expect(defeated.resonance).toBe(0);
  });

  it('records a real encounter only when explicitly marked, not merely because the Cache spawned', () => {
    const state = activeState();
    expect(state.interactables[cache.id]?.encounteredAt).toBeNull();
    const encountered = gameplayReducer(state, {
      type: 'mark-interaction-encountered',
      timestamp: 1_250,
      targetId: cache.id,
    });
    expect(encountered.interactables[cache.id]?.encounteredAt).toBe(1_250);
  });
});
