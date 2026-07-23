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
import {
  finalizeRoomResearchRecord,
  loadResearchStorage,
  saveResearchStorage,
} from './researchStorage';

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

  it('restores defeat feedback and its saved answers after refresh', () => {
    const fixture = researchFixture();
    const pending = {
      ...fixture.pending,
      record: {
        ...fixture.pending.record,
        outcome: {
          ...fixture.pending.record.outcome,
          status: 'defeated' as const,
          chosenExitId: null,
          outgoingDirection: null,
        },
        feedback: {
          ...fixture.pending.record.feedback,
          difficulty: 'too_hard' as const,
          fairness: 2 as const,
        },
      },
    };
    const active = {
      researchSchemaVersion: 'research-1' as const,
      researchSessionId: fixture.session.id,
      researchRunId: fixture.run.id,
      gameplay: {
        ...createActiveRunRecord(fixture.gameplay, 'warden', 20_000)!,
        status: 'defeated' as const,
        currentHealth: 0,
      },
      pendingFeedback: pending,
      roomStart: fixture.roomStart,
      pendingShadow: null,
    };
    expect(saveResearchActiveRun(active)).toBeNull();
    expect(loadResearchActiveRun().record?.pendingFeedback).toEqual(pending);
  });

  it('recovers idempotently when the dataset write succeeds before pending state clears', () => {
    const fixture = researchFixture();
    const finalized = {
      ...fixture.record,
      feedback: {
        ...fixture.record.feedback,
        status: 'submitted' as const,
        difficulty: 'about_right' as const,
        submittedAt: '2026-01-01T00:00:12.000Z',
        responseDurationMs: 2_000,
      },
    };
    expect(
      saveResearchStorage({
        researchSchemaVersion: 'research-1',
        activeSessionId: fixture.session.id,
        sessions: [fixture.session],
      }),
    ).toBeNull();
    const active = {
      researchSchemaVersion: 'research-1' as const,
      researchSessionId: fixture.session.id,
      researchRunId: fixture.run.id,
      gameplay: createActiveRunRecord(fixture.gameplay, 'warden', 20_000)!,
      pendingFeedback: {
        ...fixture.pending,
        record: finalized,
        answersUpdatedAt: finalized.feedback.submittedAt!,
      },
      roomStart: fixture.roomStart,
      pendingShadow: null,
    };
    expect(saveResearchActiveRun(active)).toBeNull();
    expect(finalizeRoomResearchRecord(finalized).status).toBe('saved');

    const recovered = loadResearchActiveRun().record;
    expect(recovered?.pendingFeedback?.roomDecisionId).toBe(finalized.roomDecisionId);
    expect(finalizeRoomResearchRecord(recovered!.pendingFeedback!.record).status).toBe(
      'identical-duplicate',
    );
    expect(saveResearchActiveRun({ ...recovered!, pendingFeedback: null })).toBeNull();
    expect(loadResearchStorage().data.sessions[0]!.runs[0]!.rooms).toHaveLength(1);
    expect(loadResearchActiveRun().record?.pendingFeedback).toBeNull();
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
