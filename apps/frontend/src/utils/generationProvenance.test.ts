import { describe, expect, it } from 'vitest';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import { coordinateToGridPosition, findSafeSpawn } from './roomGeometry';
import { generateDungeonRoom } from './generatedRoomGenerator';
import { gameplayReducer } from './gameplayState';
import { createFreshRun } from './runLifecycle';

describe('mixed generator provenance', () => {
  it('records the approved generator-1 to generator-2 continuation explicitly', () => {
    const state = createFreshRun({
      maximumHealth: 6,
      experiencePreset: 'seasoned-adventurer',
      runId: 'mixed-run',
      runSeed: 'mixed-seed',
      startedAt: 1_000,
    });
    state.dungeonProgress!.provenance = {
      gameVersion: 'mvp-0.2',
      adaptationVersion: 'rules-1',
      startingGeneratorVersion: 'generator-1',
      activeGeneratorVersion: 'generator-1',
      mixed: false,
      transitions: [],
    };
    const generatedRoom = generateDungeonRoom({
      runSeed: 'mixed-seed',
      dungeonRoomNumber: 1,
      chosenExitId: 'legacy-exit',
      entranceDirection: 'west',
      experiencePreset: 'seasoned-adventurer',
      effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
      mode: 'reinforce',
      generatorVersion: 'generator-2',
      adaptationVersion: 'rules-1',
      gameVersion: 'mvp-0.2',
    });
    const transitioned = gameplayReducer(state, {
      type: 'commit-room-transition',
      destinationRoomId: generatedRoom.roomSnapshot.id,
      destinationRoomIndex: 5,
      destinationSpawn: coordinateToGridPosition(findSafeSpawn(generatedRoom.roomSnapshot, 'west')),
      enteredFrom: 'west',
      exitedAtMs: 2_000,
      exitChoice: null,
      evaluationComplete: true,
      generatedRoom,
      chosenExitId: 'legacy-exit',
      exitDirection: 'east',
      nextMode: 'reinforce',
      nextPokeCooldown: 0,
    });
    expect(transitioned.dungeonProgress?.provenance).toEqual({
      gameVersion: 'mvp-0.2',
      adaptationVersion: 'rules-1',
      startingGeneratorVersion: 'generator-1',
      activeGeneratorVersion: 'generator-2',
      mixed: true,
      transitions: [
        {
          roomNumber: 1,
          from: 'generator-1',
          to: 'generator-2',
          reason: 'generator-1-continuation',
        },
      ],
    });
  });
});
