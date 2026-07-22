import { describe, expect, it } from 'vitest';
import { researchFixture } from '../test/researchFixtures';
import type { ResearchExport, RoomResearchRecord } from '../types/research';
import { DEFAULT_MODEL_PREPARATION_CONFIG, prepareResearchExports } from './dataPreparation';

function submittedRecord(
  decisionId: string,
  sequence: number,
  difficulty: 'too_easy' | 'about_right' | 'too_hard',
): RoomResearchRecord {
  const { record } = researchFixture();
  return {
    ...record,
    roomDecisionId: decisionId,
    roomSequence: sequence,
    capturedAt: `2026-01-01T00:00:${String(sequence).padStart(2, '0')}.000Z`,
    profileBefore: { ...record.profileBefore, pace: sequence / 10 },
    profileAfter: { ...record.profileAfter, pace: 0.99 },
    outcome: { ...record.outcome, durationMs: sequence * 1_000 },
    feedback: {
      ...record.feedback,
      status: 'submitted',
      difficulty,
      submittedAt: `2026-01-01T00:01:${String(sequence).padStart(2, '0')}.000Z`,
    },
  };
}

function exportWith(records: RoomResearchRecord[], pilot = false): ResearchExport {
  const { session, run } = researchFixture();
  return {
    researchSchemaVersion: 'research-1',
    exportedAt: '2026-01-02T00:00:00.000Z',
    scope: 'all-sessions',
    sessions: [
      {
        ...session,
        pilot,
        participantCode: 'SYNTHETIC_01',
        runs: [{ ...run, pilot, rooms: records }],
      },
    ],
  };
}

describe('model data preparation', () => {
  it('derives deterministic prior-only features and a path-free fingerprint', async () => {
    const records = [
      submittedRecord('decision-1', 1, 'too_easy'),
      submittedRecord('decision-2', 2, 'about_right'),
    ];
    const first = await prepareResearchExports([exportWith(records)]);
    const second = await prepareResearchExports([
      { ...exportWith(records), exportedAt: '2026-07-01T00:00:00.000Z' },
    ]);

    expect(first.datasetFingerprint).toBe(second.datasetFingerprint);
    expect(first.rows[0]!.features.previousDifficultyRating).toBe('__missing__');
    expect(first.rows[1]!.features.previousDifficultyRating).toBe('too_easy');
    expect(first.rows[1]!.features.pace).toBe(0.2);
    expect(first.rows[1]!.features.pace).not.toBe(records[1]!.profileAfter.pace);
    expect(JSON.stringify(first)).not.toContain('SYNTHETIC_01');
    expect(JSON.stringify(first)).not.toContain('session-fixture');
  });

  it('excludes Pilot by default and includes it only explicitly', async () => {
    const pilot = exportWith([submittedRecord('pilot-1', 1, 'about_right')], true);
    expect((await prepareResearchExports([pilot])).rows).toHaveLength(0);
    expect(
      (
        await prepareResearchExports([pilot], {
          ...DEFAULT_MODEL_PREPARATION_CONFIG,
          includePilot: true,
        })
      ).rows,
    ).toHaveLength(1);
  });

  it('deduplicates identical records and reports conflicting records', async () => {
    const record = submittedRecord('duplicate-1', 1, 'too_easy');
    const identical = await prepareResearchExports([exportWith([record]), exportWith([record])]);
    expect(identical.rows).toHaveLength(1);
    expect(identical.quality.duplicateRoomDecisionIds).toEqual(['duplicate-1']);

    const conflict = await prepareResearchExports([
      exportWith([record]),
      exportWith([{ ...record, feedback: { ...record.feedback, difficulty: 'too_hard' } }]),
    ]);
    expect(conflict.rows).toHaveLength(0);
    expect(conflict.quality.conflictingRoomDecisionIds).toEqual(['duplicate-1']);
    expect(conflict.readiness.readyForOfficialTraining).toBe(false);
  });

  it('reports class and official-readiness thresholds without blocking preparation', async () => {
    const dataset = await prepareResearchExports([
      exportWith([submittedRecord('small-1', 1, 'about_right')]),
    ]);
    expect(dataset.quality.classCounts).toEqual({
      too_easy: 0,
      about_right: 1,
      too_hard: 0,
    });
    expect(dataset.readiness.readyForOfficialTraining).toBe(false);
    expect(dataset.readiness.reasons).toContain('Requires 100 rated Official rooms; found 1.');
  });
});
