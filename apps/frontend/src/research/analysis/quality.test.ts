import { describe, expect, it } from 'vitest';
import { combineResearchSources } from './importResearch';
import { detectAnalysisQualityWarnings } from './quality';
import { DEFAULT_ANALYSIS_FILTERS } from './types';
import { completeConditionSession } from './testFixtures';

function datasetFor(sessions: ReturnType<typeof completeConditionSession>[]) {
  return combineResearchSources([
    {
      filename: 'synthetic-quality.json',
      researchExport: {
        researchSchemaVersion: 'research-1',
        exportedAt: '2026-06-02T00:00:00.000Z',
        scope: 'all-sessions',
        sessions,
      },
    },
  ]);
}

describe('research analysis data-quality diagnostics', () => {
  it('surfaces validation failures and conflicts with their source filenames', () => {
    const session = completeConditionSession({
      id: 'conflict-session',
      participantCode: 'P001',
      condition: 'RULES_ADAPTIVE',
      difficulties: ['about_right'],
    });
    const first = {
      filename: 'one.json',
      researchExport: {
        researchSchemaVersion: 'research-1' as const,
        exportedAt: '2026-06-02T00:00:00.000Z',
        scope: 'all-sessions' as const,
        sessions: [session],
      },
    };
    const changed = structuredClone(first);
    changed.filename = 'two.json';
    changed.researchExport.sessions[0]!.runs[0]!.rooms[0]!.outcome.damageTaken += 1;
    const dataset = combineResearchSources(
      [first, changed],
      [{ filename: 'broken.json', messages: ['Invalid schema.'] }],
    );
    const warnings = detectAnalysisQualityWarnings(dataset, dataset.sessions, {
      ...DEFAULT_ANALYSIS_FILTERS,
      completion: 'all',
    });

    expect(warnings.find((item) => item.code === 'invalid-import')?.sourceFilenames).toEqual([
      'broken.json',
    ]);
    expect(warnings.find((item) => item.code === 'conflicting-room')?.sourceFilenames).toEqual([
      'one.json',
      'two.json',
    ]);
  });

  it('warns for malformed fixed Pilot structure and legacy defeat feedback', () => {
    const session = completeConditionSession({
      id: 'pilot-session',
      participantCode: 'P001',
      condition: 'RULES_ADAPTIVE',
      difficulties: ['about_right'],
      pilot: true,
      runLabel: 'Run A',
    });
    session.protocolId = 'fixed-pilot-1';
    session.assignmentMethodId = 'pilot-sequence-alternation-1';
    session.participantSequence = 2;
    session.hiddenConditionOrder = ['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL'];
    session.lockedExperiencePreset = 'new-delver';
    session.lockedCharacterId = 'warden';
    session.participantPhase = 'session_complete';
    session.completionStatus = 'complete';
    session.completedAt = session.endedAt;
    session.runs[0]!.protocolId = 'fixed-pilot-1';
    session.runs[0]!.rooms[0]!.feedback = {
      ...session.runs[0]!.rooms[0]!.feedback,
      status: 'not_requested_due_to_defeat',
      difficulty: null,
      fairness: null,
      enjoyment: null,
      submittedAt: null,
      responseDurationMs: null,
      notRequestedReason: 'defeat',
    };
    session.runs[0]!.rooms[0]!.outcome.status = 'defeated';
    session.runs[0]!.rooms[0]!.outcome.chosenExitId = null;
    session.runs[0]!.rooms[0]!.outcome.outgoingDirection = null;
    session.sessionExit = {
      schemaVersion: 'pilot-exit-1',
      instructionClarity: 4,
      surveyFatigue: 3,
      sessionLength: 'about_right',
      technicalProblem: 'yes',
      technicalProblemDescription: 'The room briefly froze.',
      overallPreference: 'no_preference',
      comment: null,
      submittedAt: '2026-06-02T00:00:00.000Z',
    };

    const dataset = datasetFor([session]);
    const warnings = detectAnalysisQualityWarnings(dataset, dataset.sessions, {
      ...DEFAULT_ANALYSIS_FILTERS,
      pilot: 'pilot',
      completion: 'all',
    });
    const codes = warnings.map((item) => item.code);

    expect(codes).toContain('pilot-data-included');
    expect(codes).toContain('condition-order-mismatch');
    expect(codes).toContain('pilot-run-length');
    expect(codes).toContain('missing-run-b');
    expect(codes).toContain('pilot-preset-mismatch');
    expect(codes).toContain('legacy-defeat-feedback');
    expect(codes).toContain('pilot-technical-problem');
  });

  it('reports suspicious durations, pending feedback, outcome mismatches, and reused codes', () => {
    const first = completeConditionSession({
      id: 'first',
      participantCode: 'REUSED',
      condition: 'RULES_ADAPTIVE',
      difficulties: ['about_right'],
    });
    first.runs[0]!.rooms[0]!.outcome.durationMs = 31 * 60 * 1_000;
    first.runs[0]!.rooms[0]!.feedback.status = 'pending';
    first.runs[0]!.rooms[0]!.feedback.difficulty = null;
    first.runs[0]!.rooms[0]!.outcome.status = 'defeated';
    const second = completeConditionSession({
      id: 'second',
      participantCode: 'REUSED',
      condition: 'NEUTRAL_PROCEDURAL',
      difficulties: ['about_right'],
    });
    const dataset = datasetFor([first, second]);
    const codes = detectAnalysisQualityWarnings(
      dataset,
      dataset.sessions,
      DEFAULT_ANALYSIS_FILTERS,
    ).map((item) => item.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        'participant-code-reused',
        'suspicious-room-duration',
        'pending-feedback',
        'terminal-room-has-exit',
      ]),
    );
  });
});
