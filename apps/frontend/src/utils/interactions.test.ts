import { describe, expect, it } from 'vitest';
import { EVALUATION_ROOM_3_ID, getEvaluationRoom } from '../data/rooms/evaluationRooms';
import { emptyEnemyRoomState } from './enemySystem';
import { createInteractableRuntimeStates, getAvailableInteraction } from './interactions';

const room = getEvaluationRoom(EVALUATION_ROOM_3_ID)!;

describe('Resonant Ruins reusable interaction discovery', () => {
  it('requires cardinal adjacency and correct facing', () => {
    const runtime = createInteractableRuntimeStates(room);
    const base = {
      room,
      currentHealth: 2,
      maximumHealth: 3,
      enemies: emptyEnemyRoomState(room.id),
      runtime,
    };
    expect(
      getAvailableInteraction({
        ...base,
        player: {
          position: { row: 2, column: 10 },
          facing: 'up',
          isShielding: false,
          shieldDirection: null,
        },
      }),
    ).toMatchObject({ type: 'restoration-fountain', prompt: 'E — Restore Health' });
    expect(
      getAvailableInteraction({
        ...base,
        player: {
          position: { row: 2, column: 10 },
          facing: 'right',
          isShielding: false,
          shieldDirection: null,
        },
      }),
    ).toBeNull();
  });

  it('rejects full health and a depleted Fountain', () => {
    const runtime = createInteractableRuntimeStates(room);
    const fountainId = Object.keys(runtime)[0]!;
    const player = {
      position: { row: 2, column: 10 },
      facing: 'up' as const,
      isShielding: false,
      shieldDirection: null,
    };
    expect(
      getAvailableInteraction({
        room,
        player,
        currentHealth: 3,
        maximumHealth: 3,
        enemies: emptyEnemyRoomState(room.id),
        runtime,
      }),
    ).toBeNull();
    runtime[fountainId]!.depleted = true;
    expect(
      getAvailableInteraction({
        room,
        player,
        currentHealth: 2,
        maximumHealth: 3,
        enemies: emptyEnemyRoomState(room.id),
        runtime,
      }),
    ).toBeNull();
  });
});
