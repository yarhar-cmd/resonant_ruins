import { beforeEach, describe, expect, it } from 'vitest';
import { createFreshRun } from '../utils/runLifecycle';
import { researchFixture } from '../test/researchFixtures';
import { createActiveRunRecord, loadActiveRun, saveActiveRun } from './activeRunStorage';
import {
  clearResearchActiveRun,
  loadResearchActiveRun,
  parseResearchActiveRun,
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
        roomStart: null,
        pendingShadow: null,
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

  it('restores the exact room start and pending feedback after refresh', () => {
    const fixture = researchFixture();
    const gameplay = createActiveRunRecord(fixture.gameplay, 'warden', 20_000)!;
    const active = {
      researchSchemaVersion: 'research-1' as const,
      researchSessionId: fixture.session.id,
      researchRunId: fixture.run.id,
      gameplay,
      pendingFeedback: fixture.pending,
      roomStart: fixture.roomStart,
      pendingShadow: null,
    };
    expect(saveResearchActiveRun(active)).toBeNull();
    expect(loadResearchActiveRun()).toEqual({ record: active, issue: null });
  });

  it('discards invalid optional shadow evidence without destroying the run', () => {
    const fixture = researchFixture();
    const gameplay = createActiveRunRecord(fixture.gameplay, 'warden', 20_000)!;
    const parsed = parseResearchActiveRun({
      researchSchemaVersion: 'research-1',
      researchSessionId: fixture.session.id,
      researchRunId: fixture.run.id,
      gameplay,
      pendingFeedback: null,
      roomStart: null,
      pendingShadow: { schemaVersion: 'shadow-1', status: 'invented' },
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.pendingShadow).toBeNull();
  });
});
