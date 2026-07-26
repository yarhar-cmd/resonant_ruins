import { describe, expect, it } from 'vitest';
import { createResearchAnalysis } from './analyzeResearch';
import {
  analysisFilename,
  analysisQualityCsv,
  analysisQualityJson,
  analysisSummaryJson,
  pairedAnalysisCsv,
  PAIRED_ANALYSIS_COLUMNS,
  participantAnalysisCsv,
  PARTICIPANT_ANALYSIS_COLUMNS,
  QUALITY_REPORT_COLUMNS,
} from './exportAnalysis';
import { combineResearchSources } from './importResearch';
import { DEFAULT_ANALYSIS_FILTERS } from './types';
import { completeConditionSession } from './testFixtures';

describe('research Analysis Lab exports', () => {
  const adaptive = completeConditionSession({
    id: 'adaptive',
    participantCode: '=FORMULA()',
    condition: 'RULES_ADAPTIVE',
    difficulties: ['about_right'],
  });
  const neutral = completeConditionSession({
    id: 'neutral',
    participantCode: '=FORMULA()',
    condition: 'NEUTRAL_PROCEDURAL',
    difficulties: ['too_hard'],
  });
  const analysis = createResearchAnalysis([adaptive, neutral]);

  it('uses stable participant and paired CSV columns with formula protection', () => {
    const participant = participantAnalysisCsv(analysis);
    const paired = pairedAnalysisCsv(analysis);

    expect(participant.split('\r\n')[0]).toBe(PARTICIPANT_ANALYSIS_COLUMNS.join(','));
    expect(paired.split('\r\n')[0]).toBe(PAIRED_ANALYSIS_COLUMNS.join(','));
    expect(participant).toContain("'=FORMULA()");
    expect(paired).toContain("'=FORMULA()");
    expect(paired).toContain('1,0,1');
  });

  it('exports stable quality CSV and JSON without object coercion', () => {
    const warnings = [
      {
        code: 'example',
        severity: 'warning' as const,
        message: '=warning',
        sourceFilenames: ['source,one.json'],
      },
    ];
    const csv = analysisQualityCsv(warnings);
    expect(csv.split('\r\n')[0]).toBe(QUALITY_REPORT_COLUMNS.join(','));
    expect(csv).toContain("'=warning");
    expect(csv).not.toContain('[object Object]');
    expect(JSON.parse(analysisQualityJson(warnings)).warnings).toHaveLength(1);
  });

  it('exports reproducible summary metadata and safe filenames', () => {
    const dataset = combineResearchSources([
      {
        filename: 'synthetic.json',
        researchExport: {
          researchSchemaVersion: 'research-1',
          exportedAt: '2026-06-02T00:00:00.000Z',
          scope: 'all-sessions',
          sessions: [adaptive, neutral],
        },
      },
    ]);
    const summary = JSON.parse(
      analysisSummaryJson({
        dataset,
        filters: DEFAULT_ANALYSIS_FILTERS,
        analysis,
        warnings: [],
        analyzedSessionCount: 2,
        exportedAt: '2026-06-03T00:00:00.000Z',
      }),
    );
    expect(summary).toMatchObject({
      analysisSchemaVersion: 1,
      exportedAt: '2026-06-03T00:00:00.000Z',
      importAudit: { acceptedFiles: 1, acceptedSessions: 2 },
      counts: {
        participants: 1,
        sessions: 2,
        rooms: 2,
        participantConditions: 2,
        completePairs: 1,
        incompletePairs: 0,
      },
    });
    expect(analysisFilename('analysis-summary', 'json', summary.exportedAt)).toBe(
      'resonant-ruins-analysis-summary-2026-06-03.json',
    );
  });
});
