import { describe, expect, it } from 'vitest';
import { researchFixture } from '../test/researchFixtures';
import { createResearchSummary } from './summary';

function sessions() {
  const officialFixture = researchFixture();
  const official = {
    ...officialFixture.session,
    runs: [
      {
        ...officialFixture.run,
        rooms: [
          {
            ...officialFixture.record,
            feedback: {
              ...officialFixture.record.feedback,
              status: 'submitted' as const,
              difficulty: 'about_right' as const,
              fairness: 4 as const,
              enjoyment: 5 as const,
              submittedAt: '2026-01-01T00:00:11.000Z',
              responseDurationMs: 1_000,
            },
          },
          {
            ...officialFixture.record,
            roomDecisionId: 'official-too-hard',
            condition: 'RULES_ADAPTIVE' as const,
            feedback: {
              ...officialFixture.record.feedback,
              status: 'submitted' as const,
              difficulty: 'too_hard' as const,
              fairness: null,
              enjoyment: 3 as const,
              skippedFields: ['fairness'] as ('fairness' | 'enjoyment')[],
              submittedAt: '2026-01-01T00:00:12.000Z',
              responseDurationMs: 2_000,
            },
          },
          {
            ...officialFixture.record,
            roomDecisionId: 'official-skip',
            feedback: {
              ...officialFixture.record.feedback,
              status: 'skipped' as const,
              fullDialogSkipped: true,
              skippedFields: ['fairness', 'enjoyment'] as ('fairness' | 'enjoyment')[],
              submittedAt: '2026-01-01T00:00:13.000Z',
              responseDurationMs: 3_000,
            },
          },
        ],
      },
    ],
  };
  const pilotFixture = researchFixture();
  const pilot = {
    ...pilotFixture.session,
    id: 'pilot-summary-session',
    pilot: true,
    runs: [
      {
        ...pilotFixture.run,
        id: 'pilot-summary-run',
        pilot: true,
        rooms: [
          {
            ...pilotFixture.record,
            researchSessionId: 'pilot-summary-session',
            runId: 'pilot-summary-run',
            roomDecisionId: 'pilot-about-right',
            pilot: true,
            feedback: {
              ...pilotFixture.record.feedback,
              status: 'submitted' as const,
              difficulty: 'about_right' as const,
              submittedAt: '2026-01-01T00:00:14.000Z',
              responseDurationMs: 4_000,
            },
          },
        ],
      },
    ],
  };
  return [official, pilot];
}

describe('descriptive research summary', () => {
  it('uses only submitted difficulty ratings in the About Right denominator', () => {
    const summary = createResearchSummary(sessions());
    expect(summary).toMatchObject({
      sessionCount: 1,
      runCount: 1,
      roomCount: 3,
      ratedRooms: 2,
      skippedRooms: 1,
      aboutRightCount: 1,
      aboutRightRate: 0.5,
      tooHardRate: 0.5,
      averageFairness: 4,
      averageEnjoyment: 4,
    });
  });

  it('excludes Pilot by default and includes it only when explicitly requested', () => {
    expect(createResearchSummary(sessions()).roomCount).toBe(3);
    const included = createResearchSummary(sessions(), true);
    expect(included.sessionCount).toBe(2);
    expect(included.roomCount).toBe(4);
    expect(included.ratedRooms).toBe(3);
    expect(included.aboutRightRate).toBeCloseTo(2 / 3);
  });

  it('returns explicit empty-state values without declaring a winner', () => {
    expect(createResearchSummary([])).toMatchObject({
      sessionCount: 0,
      roomCount: 0,
      ratedRooms: 0,
      aboutRightRate: null,
      averageFairness: null,
      averageEnjoyment: null,
    });
  });
});
