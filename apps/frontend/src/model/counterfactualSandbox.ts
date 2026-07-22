import { createActiveRunRecord, type ActiveRunRecord } from '../services/activeRunStorage';
import type { GeneratedRoomSave } from '../types/generation';
import { createRoomEnemyState } from '../utils/enemySystem';
import { coordinateToGridPosition, findSafeSpawn } from '../utils/roomGeometry';
import { createFreshRun } from '../utils/runLifecycle';
import { createInteractableRuntimeStates } from '../utils/interactions';
import type { RewardGenerationOverride } from '../types/rewards';
import { applyRewardLayer } from '../utils/rewardGeneration';

let activeSandbox: {
  token: string;
  candidateId: string;
  record: ActiveRunRecord;
  rewardOverride: RewardGenerationOverride;
} | null = null;

export function createCounterfactualSandbox(
  generated: GeneratedRoomSave,
  candidateId: string,
  now = Date.now(),
  rewardOverride: RewardGenerationOverride = 'disable',
): string {
  const prepared = applyRewardLayer(generated, {
    enabled: true,
    override: rewardOverride,
  });
  const base = createFreshRun({
    maximumHealth: 6,
    experiencePreset: 'seasoned-adventurer',
    runId: `sandbox-${generated.roomSeed}`,
    runSeed: generated.runSeed,
    startedAt: now,
  });
  const entrance = prepared.details.entranceDirection;
  const gameplay = {
    ...base,
    player: {
      ...base.player,
      position: coordinateToGridPosition(findSafeSpawn(prepared.roomSnapshot, entrance)),
    },
    evaluationProgress: {
      ...base.evaluationProgress!,
      currentRoomIndex: 5,
      currentRoomId: prepared.roomSnapshot.id,
      enteredFrom: entrance,
      roomEnteredAtMs: 0,
      evaluationComplete: true,
    },
    dungeonProgress: {
      ...base.dungeonProgress!,
      dungeonRoomNumber: prepared.dungeonRoomNumber,
      currentRoom: prepared,
      enteredFrom: entrance,
    },
    enemies: createRoomEnemyState(
      prepared.roomSnapshot,
      'seasoned-adventurer',
      now,
      prepared.details.enemyCountPlan ?? null,
    ),
    interactables: createInteractableRuntimeStates(prepared.roomSnapshot),
  };
  const record = createActiveRunRecord(gameplay, 'warden', now);
  if (!record) throw new Error('Counterfactual sandbox could not create an in-memory run.');
  const token = `sandbox-${generated.roomSeed}-${candidateId}`;
  activeSandbox = { token, candidateId, record, rewardOverride };
  return token;
}

export function getCounterfactualSandbox(token: string | null): {
  candidateId: string;
  record: ActiveRunRecord;
  rewardOverride: RewardGenerationOverride;
} | null {
  return activeSandbox && activeSandbox.token === token
    ? {
        candidateId: activeSandbox.candidateId,
        record: activeSandbox.record,
        rewardOverride: activeSandbox.rewardOverride,
      }
    : null;
}

export function clearCounterfactualSandbox(): void {
  activeSandbox = null;
}
