import { researchCsvCell } from '../export';
import type {
  AnalysisDataset,
  AnalysisFilters,
  AnalysisQualityWarning,
  PairedParticipantSummary,
  ParticipantConditionSummary,
  ResearchAnalysis,
} from './types';

export const PARTICIPANT_ANALYSIS_COLUMNS = [
  'participant_key',
  'participant_code',
  'condition',
  'session_ids',
  'session_count',
  'condition_complete',
  'room_count',
  'about_right_count',
  'submitted_difficulty_count',
  'about_right_rate',
  'too_easy_count',
  'too_hard_count',
  'mean_fairness',
  'mean_enjoyment',
  'fairness_missing_count',
  'enjoyment_missing_count',
  'full_skip_count',
  'full_skip_rate',
  'defeated_room_count',
  'defeated_room_rate',
  'completed_room_count',
  'completed_room_rate',
  'average_damage_taken',
  'average_room_duration_ms',
  'average_feedback_response_duration_ms',
] as const;

export const PAIRED_ANALYSIS_COLUMNS = [
  'participant_key',
  'participant_code',
  'adaptive_about_right_rate',
  'neutral_about_right_rate',
  'adaptive_minus_neutral_about_right',
  'adaptive_fairness',
  'neutral_fairness',
  'adaptive_minus_neutral_fairness',
  'adaptive_enjoyment',
  'neutral_enjoyment',
  'adaptive_minus_neutral_enjoyment',
] as const;

export const QUALITY_REPORT_COLUMNS = [
  'severity',
  'code',
  'message',
  'session_id',
  'run_id',
  'room_decision_id',
  'source_filenames',
] as const;

function csv<Row>(
  columns: readonly string[],
  rows: readonly Row[],
  getter: (row: Row, column: string) => unknown,
): string {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => researchCsvCell(getter(row, column))).join(',')),
  ].join('\r\n');
}

function participantValue(row: ParticipantConditionSummary, column: string): unknown {
  const values: Record<string, unknown> = {
    participant_key: row.participantKey,
    participant_code: row.participantCode,
    condition: row.condition,
    session_ids: row.sessionIds.join('|'),
    session_count: row.sessionCount,
    condition_complete: row.conditionComplete,
    room_count: row.roomCount,
    about_right_count: row.aboutRightCount,
    submitted_difficulty_count: row.validSubmittedDifficultyCount,
    about_right_rate: row.aboutRightRate,
    too_easy_count: row.tooEasyCount,
    too_hard_count: row.tooHardCount,
    mean_fairness: row.meanFairness,
    mean_enjoyment: row.meanEnjoyment,
    fairness_missing_count: row.fairnessMissingCount,
    enjoyment_missing_count: row.enjoymentMissingCount,
    full_skip_count: row.explicitFullSkipCount,
    full_skip_rate: row.explicitFullSkipRate,
    defeated_room_count: row.defeatedRoomCount,
    defeated_room_rate: row.defeatedRoomRate,
    completed_room_count: row.completedRoomCount,
    completed_room_rate: row.completedRoomRate,
    average_damage_taken: row.averageDamageTaken,
    average_room_duration_ms: row.averageRoomDurationMs,
    average_feedback_response_duration_ms: row.averageFeedbackResponseDurationMs,
  };
  return values[column];
}

function pairedValue(row: PairedParticipantSummary, column: string): unknown {
  const values: Record<string, unknown> = {
    participant_key: row.participantKey,
    participant_code: row.participantCode,
    adaptive_about_right_rate: row.adaptiveAboutRightRate,
    neutral_about_right_rate: row.neutralAboutRightRate,
    adaptive_minus_neutral_about_right: row.aboutRightDifference,
    adaptive_fairness: row.adaptiveFairness,
    neutral_fairness: row.neutralFairness,
    adaptive_minus_neutral_fairness: row.fairnessDifference,
    adaptive_enjoyment: row.adaptiveEnjoyment,
    neutral_enjoyment: row.neutralEnjoyment,
    adaptive_minus_neutral_enjoyment: row.enjoymentDifference,
  };
  return values[column];
}

function qualityValue(row: AnalysisQualityWarning, column: string): unknown {
  const values: Record<string, unknown> = {
    severity: row.severity,
    code: row.code,
    message: row.message,
    session_id: row.sessionId,
    run_id: row.runId,
    room_decision_id: row.roomDecisionId,
    source_filenames: row.sourceFilenames.join('|'),
  };
  return values[column];
}

export function participantAnalysisCsv(analysis: ResearchAnalysis): string {
  return csv(PARTICIPANT_ANALYSIS_COLUMNS, analysis.participantConditions, participantValue);
}

export function pairedAnalysisCsv(analysis: ResearchAnalysis): string {
  return csv(PAIRED_ANALYSIS_COLUMNS, analysis.paired.pairs, pairedValue);
}

export function analysisQualityCsv(warnings: AnalysisQualityWarning[]): string {
  return csv(QUALITY_REPORT_COLUMNS, warnings, qualityValue);
}

export function analysisQualityJson(warnings: AnalysisQualityWarning[]): string {
  return JSON.stringify({ warnings }, null, 2);
}

export function analysisSummaryJson(input: {
  dataset: AnalysisDataset;
  filters: AnalysisFilters;
  analysis: ResearchAnalysis;
  warnings: AnalysisQualityWarning[];
  analyzedSessionCount: number;
  exportedAt?: string;
}): string {
  return JSON.stringify(
    {
      analysisSchemaVersion: 1,
      exportedAt: input.exportedAt ?? new Date().toISOString(),
      filters: input.filters,
      importAudit: input.dataset.audit,
      analyzedSessionCount: input.analyzedSessionCount,
      analysis: input.analysis,
      qualityWarnings: input.warnings,
    },
    null,
    2,
  );
}

export function analysisFilename(
  kind: 'participant-summary' | 'paired-analysis' | 'quality-report' | 'analysis-summary',
  extension: 'csv' | 'json',
  now = new Date().toISOString(),
): string {
  return `resonant-ruins-${kind}-${now.slice(0, 10)}.${extension}`;
}
