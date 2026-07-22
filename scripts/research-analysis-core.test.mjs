import { describe, expect, it } from 'vitest';
import {
  analyzeResearchExport,
  formatResearchAnalysis,
  researchAnalysisCsv,
  validateResearchExport,
} from './research-analysis-core.mjs';

function room(id, condition, difficulty = 'about_right') {
  return {
    roomDecisionId: id,
    condition,
    archetype: 'open-arena',
    gameVersion: 'mvp-0.4',
    generatorVersion: 'generator-4',
    selectorVersion: condition === 'RULES_ADAPTIVE' ? 'rules-selector-1' : 'neutral-selector-1',
    feedbackSchemaVersion: 'feedback-1',
    selectedCandidateId: `candidate-${id}`,
    outcome: { status: 'completed', durationMs: 10_000, damageTaken: 1 },
    feedback: { status: 'submitted', difficulty, fairness: 4, enjoyment: 5 },
  };
}

function researchExport() {
  return {
    researchSchemaVersion: 'research-1',
    sessions: [
      {
        id: 'official',
        pilot: false,
        participantCode: 'P01',
        status: 'ended',
        runs: [
          { rooms: [room('a', 'RULES_ADAPTIVE'), room('b', 'NEUTRAL_PROCEDURAL', 'too_hard')] },
        ],
      },
      {
        id: 'pilot',
        pilot: true,
        participantCode: null,
        status: 'ended',
        runs: [{ rooms: [room('pilot-room', 'RULES_ADAPTIVE')] }],
      },
    ],
  };
}

describe('offline research analysis core', () => {
  it('validates JSON and excludes Pilot by default', () => {
    expect(validateResearchExport(researchExport())).toBeTruthy();
    const summary = analyzeResearchExport(researchExport());
    expect(summary.overall).toMatchObject({
      sessions: 1,
      runs: 1,
      generatedRoomRecords: 2,
      aboutRightRate: 0.5,
    });
    expect(summary.dataQuality.pilotRoomRecords).toBe(1);
  });

  it('includes Pilot only with the explicit option and groups conditions and sessions', () => {
    const summary = analyzeResearchExport(researchExport(), { includePilot: true });
    expect(summary.overall.generatedRoomRecords).toBe(3);
    expect(summary.byCondition.RULES_ADAPTIVE.roomRecords).toBe(2);
    expect(summary.byParticipantCodeOrSession.P01.conditionExposure).toEqual([
      'RULES_ADAPTIVE',
      'NEUTRAL_PROCEDURAL',
    ]);
  });

  it('reports duplicates and emits readable and machine-readable output', () => {
    const input = researchExport();
    input.sessions[0].runs[0].rooms.push(room('a', 'RULES_ADAPTIVE'));
    const summary = analyzeResearchExport(input);
    expect(summary.dataQuality.duplicateRoomDecisionIds).toEqual(['a']);
    expect(formatResearchAnalysis(summary)).toContain('Descriptive output only');
    expect(researchAnalysisCsv(summary)).toContain('"data_quality"');
  });

  it('rejects malformed input', () => {
    expect(() => validateResearchExport({ researchSchemaVersion: 'wrong' })).toThrow('research-1');
  });
});
