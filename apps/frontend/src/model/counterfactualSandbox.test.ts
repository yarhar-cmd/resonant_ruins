import { beforeEach, describe, expect, it } from 'vitest';
import type { GenerationRequest } from '../types/generation';
import { buildSharedCandidatePoolV4 } from '../utils/generatedRoomGeneratorV4';
import {
  clearCounterfactualSandbox,
  createCounterfactualSandbox,
  getCounterfactualSandbox,
} from './counterfactualSandbox';
import { findRewardPlacementCandidates } from '../utils/rewardGeneration';
import { getResonanceCaches } from '../utils/interactions';

const request: GenerationRequest = {
  runSeed: 'counterfactual-sandbox-test',
  dungeonRoomNumber: 10,
  chosenExitId: 'sandbox-entry',
  entranceDirection: 'west',
  experiencePreset: 'seasoned-adventurer',
  effectiveProfile: {
    pace: 0.5,
    caution: 0.5,
    aggression: 0.5,
    hazardTolerance: 0.5,
    exploration: 0.5,
  },
  mode: 'reinforce',
  generatorVersion: 'generator-4',
  adaptationVersion: 'rules-2',
  gameVersion: 'mvp-0.5',
};

describe('counterfactual sandbox isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCounterfactualSandbox();
  });

  it('creates a playable record in memory without changing any browser storage', () => {
    localStorage.setItem('mirrorvault:active-run:v1', 'preserve-active');
    localStorage.setItem('mirrorvault:research-active-run:v1', 'preserve-research');
    localStorage.setItem('mirrorvault:run-archive:v1', 'preserve-history');
    localStorage.setItem('mirrorvault:player-profile:v1', 'preserve-profile');
    const before = { ...localStorage };
    const candidate = buildSharedCandidatePoolV4(request).candidates[0]!;

    const token = createCounterfactualSandbox(candidate.save, candidate.id, 1_000);
    const sandbox = getCounterfactualSandbox(token);

    expect(sandbox?.candidateId).toBe(candidate.id);
    expect(sandbox?.record.dungeonProgress?.currentRoom?.roomSeed).toBe(candidate.save.roomSeed);
    expect(sandbox?.rewardOverride).toBe('disable');
    expect(sandbox?.record.dungeonProgress?.currentRoom?.details.rewardDecision?.spawnReason).toBe(
      'sandbox-disabled',
    );
    expect(
      getResonanceCaches(sandbox!.record.dungeonProgress!.currentRoom!.roomSnapshot),
    ).toHaveLength(0);
    expect({ ...localStorage }).toEqual(before);
    clearCounterfactualSandbox();
    expect(getCounterfactualSandbox(token)).toBeNull();
    expect({ ...localStorage }).toEqual(before);
  });

  it('can force one sandbox-local Cache without writing normal or research evidence', () => {
    localStorage.setItem('mirrorvault:active-run:v1', 'preserve-active');
    localStorage.setItem('mirrorvault:research-active-run:v1', 'preserve-research');
    localStorage.setItem('mirrorvault:run-archive:v1', 'preserve-history');
    const before = { ...localStorage };
    let eligible: ReturnType<typeof buildSharedCandidatePoolV4>['candidates'][number] | undefined;
    for (let index = 0; index < 12 && !eligible; index += 1) {
      const pool = buildSharedCandidatePoolV4({
        ...request,
        runSeed: `counterfactual-cache-${index}`,
      });
      eligible = pool.candidates.find(
        (candidate) => findRewardPlacementCandidates(candidate.save).candidates.length > 0,
      );
    }
    expect(eligible).toBeDefined();
    if (!eligible) throw new Error('No eligible counterfactual Cache fixture was found.');

    const token = createCounterfactualSandbox(eligible.save, eligible.id, 1_000, 'force');
    const sandbox = getCounterfactualSandbox(token)!;
    expect(sandbox.rewardOverride).toBe('force');
    expect(sandbox.record.dungeonProgress?.currentRoom?.details.rewardDecision?.spawnReason).toBe(
      'sandbox-forced',
    );
    expect(
      getResonanceCaches(sandbox.record.dungeonProgress!.currentRoom!.roomSnapshot),
    ).toHaveLength(1);
    expect({ ...localStorage }).toEqual(before);
  });
});
