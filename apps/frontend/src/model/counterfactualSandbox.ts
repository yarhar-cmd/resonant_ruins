import { createActiveRunRecord, type ActiveRunRecord } from '../services/activeRunStorage';
import type { GeneratedRoomSave } from '../types/generation';
import { createRoomEnemyState } from '../utils/enemySystem';
import { coordinateToGridPosition, findSafeSpawn } from '../utils/roomGeometry';
import { createFreshRun } from '../utils/runLifecycle';
import { createInteractableRuntimeStates } from '../utils/interactions';

let activeSandbox: { token: string; candidateId: string; record: ActiveRunRecord } | null = null;

export function createCounterfactualSandbox(
  generated: GeneratedRoomSave,
  candidateId: string,
  now = Date.now(),
): string {
  const base = createFreshRun({
    maximumHealth: 6,
    experiencePreset: 'seasoned-adventurer',
    runId: `sandbox-${generated.roomSeed}`,
    runSeed: generated.runSeed,
    startedAt: now,
  });
  const entrance = generated.details.entranceDirection;
  const gameplay = {
    ...base,
    player: {
      ...base.player,
      position: coordinateToGridPosition(findSafeSpawn(generated.roomSnapshot, entrance)),
    },
    evaluationProgress: {
      ...base.evaluationProgress!,
      currentRoomIndex: 5,
      currentRoomId: generated.roomSnapshot.id,
      enteredFrom: entrance,
      roomEnteredAtMs: 0,
      evaluationComplete: true,
    },
    dungeonProgress: {
      ...base.dungeonProgress!,
      dungeonRoomNumber: generated.dungeonRoomNumber,
      currentRoom: generated,
      enteredFrom: entrance,
    },
    enemies: createRoomEnemyState(
      generated.roomSnapshot,
      'seasoned-adventurer',
      now,
      generated.details.enemyCountPlan ?? null,
    ),
    interactables: createInteractableRuntimeStates(generated.roomSnapshot),
  };
  const record = createActiveRunRecord(gameplay, 'warden', now);
  if (!record) throw new Error('Counterfactual sandbox could not create an in-memory run.');
  const token = `sandbox-${generated.roomSeed}-${candidateId}`;
  activeSandbox = { token, candidateId, record };
  return token;
}

export function getCounterfactualSandbox(token: string | null): {
  candidateId: string;
  record: ActiveRunRecord;
} | null {
  return activeSandbox && activeSandbox.token === token
    ? { candidateId: activeSandbox.candidateId, record: activeSandbox.record }
    : null;
}

export function clearCounterfactualSandbox(): void {
  activeSandbox = null;
}
