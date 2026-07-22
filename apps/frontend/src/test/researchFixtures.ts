import {
  createResearchRoomStart,
  buildRoomResearchRecord,
  createPendingRoomFeedback,
} from '../research/roomRecord';
import { createResearchRun, createResearchSession } from '../services/researchStorage';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import { createFreshRun } from '../utils/runLifecycle';
import { generateDungeonRoomV4 } from '../utils/generatedRoomGeneratorV4';
import type { GameplayState } from '../utils/gameplayState';
import { coordinateToGridPosition, findSafeSpawn } from '../utils/roomGeometry';
import { createRoomEnemyState } from '../utils/enemySystem';
import { createInteractableRuntimeStates } from '../utils/interactions';
import { applyRewardLayer } from '../utils/rewardGeneration';
import type { RewardGenerationOverride } from '../types/rewards';

export function researchFixture(
  options: {
    rewardOverride?: RewardGenerationOverride;
    pilot?: boolean;
  } = {},
) {
  const session = createResearchSession({
    pilot: options.pilot ?? false,
    participantCode: 'TEST_01',
    id: 'session-fixture',
    sessionSeed: 'session-seed',
    now: 1_000,
  });
  const run = createResearchRun({
    session,
    characterId: 'warden',
    experiencePreset: 'seasoned-adventurer',
    id: 'run-fixture',
    now: 2_000,
  });
  session.runs = [run];
  const makeGenerated = (runSeed: string) =>
    applyRewardLayer(
      generateDungeonRoomV4({
        runSeed,
        dungeonRoomNumber: 1,
        chosenExitId: 'awakening-exit',
        entranceDirection: 'west',
        experiencePreset: 'seasoned-adventurer',
        effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
        mode: 'reinforce',
        generatorVersion: 'generator-4',
        gameVersion: 'mvp-0.5',
        adaptationVersion: 'rules-2',
        selectorId: run.condition === 'RULES_ADAPTIVE' ? 'rules-adaptive' : 'neutral-procedural',
      }),
      options.rewardOverride ? { override: options.rewardOverride } : undefined,
    );
  let generated = makeGenerated('research-room-fixture');
  if (options.rewardOverride === 'force' && !generated.details.rewardDecision?.spawned) {
    for (let index = 0; index < 40; index += 1) {
      const candidate = makeGenerated(`research-room-fixture-${index}`);
      if (candidate.details.rewardDecision?.spawned) {
        generated = candidate;
        break;
      }
    }
  }
  const base = createFreshRun({
    maximumHealth: 6,
    experiencePreset: 'seasoned-adventurer',
    runId: 'gameplay-run-fixture',
    runSeed: generated.runSeed,
    startedAt: 1_000,
  });
  const gameplay: GameplayState = {
    ...base,
    currentHealth: 5,
    player: {
      ...base.player,
      position: coordinateToGridPosition(findSafeSpawn(generated.roomSnapshot, 'west')),
    },
    runStats: { ...base.runStats, timeSurvived: 12_000, dungeonRoomsCleared: 0 },
    evaluationProgress: {
      ...base.evaluationProgress!,
      currentRoomIndex: 5,
      currentRoomId: generated.roomSnapshot.id,
      enteredFrom: 'west',
      roomEnteredAtMs: 5_000,
      evaluationComplete: true,
    },
    dungeonProgress: {
      ...base.dungeonProgress!,
      dungeonRoomNumber: 1,
      currentRoom: generated,
      enteredFrom: 'west',
    },
    enemies: createRoomEnemyState(
      generated.roomSnapshot,
      'seasoned-adventurer',
      5_000,
      generated.details.enemyCountPlan ?? null,
    ),
    interactables: createInteractableRuntimeStates(generated.roomSnapshot),
    adaptation: {
      ...base.adaptation,
      signals: {
        ...base.adaptation.signals,
        movementSteps: 18,
        damageTaken: 1,
        runeContacts: 1,
        swordSwings: 2,
        floorTilesVisited: ['1,1', '2,1', '3,1'],
        directionChanges: 4,
      },
    },
  };
  const roomStart = createResearchRoomStart({
    gameplay: { ...gameplay, currentHealth: 6 },
    generated,
    sessionProfile: session.sessionProfile,
    capturedAt: '2026-01-01T00:00:00.000Z',
  });
  const record = buildRoomResearchRecord({
    session,
    run,
    condition: run.condition,
    gameplay,
    generated,
    roomStart,
    profileAfter: gameplay.adaptation.currentRunProfile,
    status: 'completed',
    exit: generated.roomSnapshot.exits[0],
    capturedAt: '2026-01-01T00:00:10.000Z',
  });
  return {
    session,
    run,
    generated,
    gameplay,
    roomStart,
    record,
    pending: createPendingRoomFeedback(record, '2026-01-01T00:00:10.000Z'),
  };
}
