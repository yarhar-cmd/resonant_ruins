import { beforeEach, describe, expect, it } from 'vitest';
import { createFreshRun } from '../utils/runLifecycle';
import { createActiveRunRecord, loadActiveRun, saveActiveRun } from './activeRunStorage';
import {
  clearResearchActiveRun,
  loadResearchActiveRun,
  saveResearchActiveRun,
} from './researchActiveRunStorage';

describe('research active-run isolation', () => {
  beforeEach(() => localStorage.clear());

  it('allows normal and research active runs to coexist without cross-mode overwrite', () => {
    const normal = createActiveRunRecord(
      createFreshRun({
        maximumHealth: 6,
        experiencePreset: 'seasoned-adventurer',
        runId: 'normal-run',
        runSeed: 'normal-seed',
        startedAt: 1_000,
      }),
      'warden',
      2_000,
    )!;
    const research = createActiveRunRecord(
      createFreshRun({
        maximumHealth: 6,
        experiencePreset: 'new-delver',
        runId: 'research-run',
        runSeed: 'research-seed',
        startedAt: 3_000,
      }),
      'warden',
      4_000,
    )!;
    expect(saveActiveRun(normal)).toBeNull();
    expect(
      saveResearchActiveRun({
        researchSchemaVersion: 'research-1',
        researchSessionId: 'session-1',
        researchRunId: 'research-run-1',
        gameplay: research,
        pendingFeedback: null,
      }),
    ).toBeNull();
    expect(loadActiveRun().record?.runId).toBe('normal-run');
    expect(loadResearchActiveRun().record?.gameplay.runId).toBe('research-run');
    expect(clearResearchActiveRun()).toBeNull();
    expect(loadActiveRun().record?.runId).toBe('normal-run');
  });

  it('rejects malformed research envelopes without deleting normal state', () => {
    localStorage.setItem('resonant-ruins:research-active-run:v1', '{');
    expect(loadResearchActiveRun()).toEqual({ record: null, issue: 'invalid' });
  });
});
