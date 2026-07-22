import { beforeEach, describe, expect, it } from 'vitest';
import type { GenerationRequest } from '../types/generation';
import { buildSharedCandidatePoolV4 } from '../utils/generatedRoomGeneratorV4';
import {
  clearCounterfactualSandbox,
  createCounterfactualSandbox,
  getCounterfactualSandbox,
} from './counterfactualSandbox';

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
    expect({ ...localStorage }).toEqual(before);
    clearCounterfactualSandbox();
    expect(getCounterfactualSandbox(token)).toBeNull();
    expect({ ...localStorage }).toEqual(before);
  });
});
