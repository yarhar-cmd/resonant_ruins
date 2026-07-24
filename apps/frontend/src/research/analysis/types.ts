import type { ExperiencePreset } from '../../types/adaptation';
import type {
  PilotRunLabel,
  ResearchCondition,
  ResearchExport,
  ResearchSession,
} from '../../types/research';

export type AnalysisPilotFilter = 'official' | 'pilot' | 'all';
export type AnalysisCompletionFilter = 'complete' | 'incomplete' | 'all';
export type AnalysisOrderFilter = 'all' | 'adaptive-first' | 'neutral-first';

export interface AnalysisFilters {
  pilot: AnalysisPilotFilter;
  completion: AnalysisCompletionFilter;
  condition: ResearchCondition | 'all';
  preset: ExperiencePreset | 'all';
  order: AnalysisOrderFilter;
  participantSequence: number | null;
  gameVersion: string | 'all';
  generatorVersion: string | 'all';
  dateFrom: string;
  dateTo: string;
}

export const DEFAULT_ANALYSIS_FILTERS: AnalysisFilters = {
  pilot: 'official',
  completion: 'complete',
  condition: 'all',
  preset: 'all',
  order: 'all',
  participantSequence: null,
  gameVersion: 'all',
  generatorVersion: 'all',
  dateFrom: '',
  dateTo: '',
};

export interface ValidatedResearchSource {
  filename: string;
  researchExport: ResearchExport;
}

export interface ImportValidationFailure {
  filename: string;
  messages: string[];
}

export interface AnalysisConflict {
  kind: 'session' | 'run' | 'room';
  durableId: string;
  message: string;
  sourceFilenames: string[];
}

export interface AnalysisImportAudit {
  acceptedFiles: number;
  rejectedFiles: number;
  acceptedSessions: number;
  acceptedRuns: number;
  acceptedRooms: number;
  duplicateSessions: number;
  duplicateRooms: number;
  conflictingRecords: number;
}

export interface AnalysisDataset {
  sources: ValidatedResearchSource[];
  sessions: ResearchSession[];
  sourceFilenamesBySessionId: Record<string, string[]>;
  conflicts: AnalysisConflict[];
  validationFailures: ImportValidationFailure[];
  audit: AnalysisImportAudit;
}

export interface AnalysisQualityWarning {
  code: string;
  severity: 'warning' | 'error';
  message: string;
  sessionId?: string;
  runId?: string;
  roomDecisionId?: string;
  sourceFilenames: string[];
}

export interface ParticipantConditionSummary {
  participantKey: string;
  participantCode: string | null;
  condition: ResearchCondition;
  sessionIds: string[];
  sessionCount: number;
  conditionComplete: boolean;
  roomCount: number;
  aboutRightCount: number;
  validSubmittedDifficultyCount: number;
  aboutRightRate: number | null;
  tooEasyCount: number;
  tooHardCount: number;
  meanFairness: number | null;
  meanEnjoyment: number | null;
  fairnessMissingCount: number;
  enjoymentMissingCount: number;
  explicitFullSkipCount: number;
  explicitFullSkipRate: number | null;
  defeatedRoomCount: number;
  defeatedRoomRate: number | null;
  completedRoomCount: number;
  completedRoomRate: number | null;
  averageDamageTaken: number | null;
  averageRoomDurationMs: number | null;
  averageFeedbackResponseDurationMs: number | null;
}

export interface ParticipantRateAggregate {
  key: string;
  label: string;
  participantCount: number;
  analyzableParticipantCount: number;
  aboutRightCount: number;
  validSubmittedDifficultyCount: number;
  pooledAboutRightRate: number | null;
  meanParticipantAboutRightRate: number | null;
  medianParticipantAboutRightRate: number | null;
}

export interface ConditionAnalysisSummary extends ParticipantRateAggregate {
  condition: ResearchCondition;
  tooEasyCount: number;
  tooHardCount: number;
  meanFairness: number | null;
  meanEnjoyment: number | null;
  fairnessMissingCount: number;
  enjoymentMissingCount: number;
  explicitFullSkipRate: number | null;
  defeatedRoomRate: number | null;
  completedRoomRate: number | null;
  averageDamageTaken: number | null;
  averageRoomDurationMs: number | null;
  averageFeedbackResponseDurationMs: number | null;
}

export interface PairedParticipantSummary {
  participantKey: string;
  participantCode: string | null;
  adaptiveAboutRightRate: number;
  neutralAboutRightRate: number;
  aboutRightDifference: number;
  adaptiveFairness: number | null;
  neutralFairness: number | null;
  fairnessDifference: number | null;
  adaptiveEnjoyment: number | null;
  neutralEnjoyment: number | null;
  enjoymentDifference: number | null;
}

export interface PairedAnalysis {
  completePairCount: number;
  incompletePairCount: number;
  pairs: PairedParticipantSummary[];
  meanAboutRightDifference: number | null;
  medianAboutRightDifference: number | null;
  meanFairnessDifference: number | null;
  medianFairnessDifference: number | null;
  meanEnjoymentDifference: number | null;
  medianEnjoymentDifference: number | null;
}

export interface PilotQuestionnaireSummary {
  submittedQuestionnaires: number;
  technicalProblemCount: number;
  technicalProblemRate: number | null;
  meanInstructionClarity: number | null;
  meanSurveyFatigue: number | null;
  sessionLengthCounts: Record<'too_short' | 'about_right' | 'too_long', number>;
  preferenceCounts: Record<'run_a' | 'run_b' | 'no_preference', number>;
}

export interface ResearchAnalysis {
  participantConditions: ParticipantConditionSummary[];
  conditions: Record<ResearchCondition, ConditionAnalysisSummary>;
  runLabels: Record<PilotRunLabel, ParticipantRateAggregate>;
  conditionOrders: Record<'adaptive-first' | 'neutral-first', ParticipantRateAggregate>;
  paired: PairedAnalysis;
  questionnaire: PilotQuestionnaireSummary;
}
