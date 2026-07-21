import { describe, expect, it } from 'vitest';
import { EVALUATION_ROOM_3_ID, getEvaluationRoom } from '../data/rooms/evaluationRooms';
import { applyPlayerDamage, createGameplayState, gameplayReducer } from './gameplayState';
import { coordinateToGridPosition } from './roomGeometry';
import { createRatFromSpawn, emptyEnemyRoomState } from './enemySystem';

const room = getEvaluationRoom(EVALUATION_ROOM_3_ID)!;
const fountainId = `${EVALUATION_ROOM_3_ID}-restoration-fountain`;

function readyState() {
  let state = gameplayReducer(createGameplayState(3), {
    type: 'start-run',
    maximumHealth: 3,
    startedAt: 0,
    runId: 'fountain-run',
    runSeed: 'fountain-seed',
    roomOrder: [
      'evaluation-room-01',
      'evaluation-room-02',
      'evaluation-room-03',
      'evaluation-room-04',
      'evaluation-room-05',
    ],
    currentRoomId: EVALUATION_ROOM_3_ID,
    spawn: coordinateToGridPosition({ x: 10, y: 2 }),
    room,
    enemies: emptyEnemyRoomState(room.id),
  });
  state = applyPlayerDamage(state, {
    id: 'setup-damage',
    source: 'rune',
    amount: 1,
    timestamp: 10,
  });
  return gameplayReducer(state, { type: 'turn', direction: 'up', trigger: 'press', timestamp: 20 });
}

describe('Restoration Fountain authoritative gameplay', () => {
  it('channels for 700ms, heals exactly one, depletes once, and grants no invulnerability', () => {
    let state = readyState();
    const invulnerabilityBefore = state.invulnerability.expiresAt;
    state = gameplayReducer(state, {
      type: 'start-interaction',
      timestamp: 100,
      room,
      targetId: fountainId,
    });
    expect(state.interaction).toMatchObject({ status: 'channeling', deadline: 800 });
    state = gameplayReducer(state, { type: 'interaction-tick', timestamp: 799, room });
    expect(state.currentHealth).toBe(2);
    state = gameplayReducer(state, { type: 'interaction-tick', timestamp: 800, room });
    expect(state.currentHealth).toBe(3);
    expect(state.interactables[fountainId]).toMatchObject({ depleted: true, usedAt: 800 });
    expect(state.interaction).toMatchObject({
      status: 'completed',
      result: 'restored-one-health',
    });
    expect(state.invulnerability.expiresAt).toBe(invulnerabilityBefore);
    expect(
      gameplayReducer(state, {
        type: 'start-interaction',
        timestamp: 900,
        room,
        targetId: fountainId,
      }),
    ).toBe(state);
  });

  it('pauses the channel deadline and completes only once after resume', () => {
    let state = gameplayReducer(readyState(), {
      type: 'start-interaction',
      timestamp: 100,
      room,
      targetId: fountainId,
    });
    state = gameplayReducer(state, { type: 'pause-run', timestamp: 400, reason: 'pause-menu' });
    state = gameplayReducer(state, { type: 'interaction-tick', timestamp: 900, room });
    expect(state.currentHealth).toBe(2);
    state = gameplayReducer(state, { type: 'resume-run', timestamp: 1_000 });
    expect(state.interaction.deadline).toBe(1_400);
    state = gameplayReducer(state, { type: 'interaction-tick', timestamp: 1_400, room });
    const completed = gameplayReducer(state, {
      type: 'interaction-tick',
      timestamp: 1_500,
      room,
    });
    expect(completed.currentHealth).toBe(3);
    expect(completed.interactables[fountainId]?.usedAt).toBe(1_400);
  });

  it('cancels on movement, shield, attack, and an alerted living Rat', () => {
    const start = () =>
      gameplayReducer(readyState(), {
        type: 'start-interaction',
        timestamp: 100,
        room,
        targetId: fountainId,
      });
    expect(
      gameplayReducer(start(), {
        type: 'move',
        direction: 'down',
        trigger: 'press',
        id: 'move-away',
        timestamp: 200,
        room,
      }).interaction,
    ).toMatchObject({ status: 'cancelled', cancellationReason: 'movement' });
    expect(
      gameplayReducer(start(), { type: 'shield', isShielding: true, timestamp: 200 }).interaction,
    ).toMatchObject({ status: 'cancelled', cancellationReason: 'shield' });
    expect(
      gameplayReducer(start(), { type: 'attack', id: 'attack', timestamp: 200, room }).interaction,
    ).toMatchObject({ status: 'cancelled', cancellationReason: 'attack' });

    const rat = createRatFromSpawn(
      {
        id: 'alert-rat',
        type: 'rat',
        tile: { x: 5, y: 5 },
        order: 1,
        source: 'authored',
        reason: 'test',
      },
      0,
    );
    const combat = {
      ...readyState(),
      enemies: {
        ...emptyEnemyRoomState(room.id),
        rats: [{ ...rat, awareness: 'alerted' as const, state: 'chasing' as const }],
      },
    };
    expect(
      gameplayReducer(combat, {
        type: 'start-interaction',
        timestamp: 100,
        room,
        targetId: fountainId,
      }),
    ).toBe(combat);
  });
});
