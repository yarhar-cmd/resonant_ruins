import { researchFixture } from '../../test/researchFixtures';
import type {
  DifficultyRating,
  FeedbackStatus,
  PilotRunLabel,
  ResearchCondition,
  ResearchRun,
  ResearchSession,
  RoomOutcomeStatus,
  RoomResearchRecord,
} from '../../types/research';

const fixture = researchFixture();

export function analysisRecord(input: {
  sessionId: string;
  runId: string;
  roomDecisionId: string;
  condition: ResearchCondition;
  participantCode?: string | null;
  pilot?: boolean;
  difficulty?: DifficultyRating | null;
  feedbackStatus?: FeedbackStatus;
  fairness?: 1 | 2 | 3 | 4 | 5 | null;
  enjoyment?: 1 | 2 | 3 | 4 | 5 | null;
  outcomeStatus?: RoomOutcomeStatus;
  durationMs?: number;
}): RoomResearchRecord {
  const feedbackStatus = input.feedbackStatus ?? 'submitted';
  const outcomeStatus = input.outcomeStatus ?? 'completed';
  return {
    ...structuredClone(fixture.record),
    researchSessionId: input.sessionId,
    runId: input.runId,
    roomId: `room-${input.roomDecisionId}`,
    roomDecisionId: input.roomDecisionId,
    condition: input.condition,
    participantCode: input.participantCode ?? 'P001',
    pilot: input.pilot ?? false,
    capturedAt: '2026-06-01T12:00:00.000Z',
    outcome: {
      ...fixture.record.outcome,
      status: outcomeStatus,
      durationMs: input.durationMs ?? 30_000,
      chosenExitId: outcomeStatus === 'completed' ? 'exit-east' : null,
      outgoingDirection: outcomeStatus === 'completed' ? 'east' : null,
    },
    feedback: {
      ...fixture.record.feedback,
      status: feedbackStatus,
      difficulty: feedbackStatus === 'submitted' ? (input.difficulty ?? 'about_right') : null,
      fairness:
        feedbackStatus === 'submitted' ? (input.fairness === undefined ? 4 : input.fairness) : null,
      enjoyment:
        feedbackStatus === 'submitted'
          ? input.enjoyment === undefined
            ? 4
            : input.enjoyment
          : null,
      skippedFields:
        feedbackStatus === 'submitted'
          ? [
              ...(input.fairness === null ? (['fairness'] as const) : []),
              ...(input.enjoyment === null ? (['enjoyment'] as const) : []),
            ]
          : feedbackStatus === 'skipped'
            ? ['fairness', 'enjoyment']
            : [],
      fullDialogSkipped: feedbackStatus === 'skipped',
      submittedAt:
        feedbackStatus === 'submitted' || feedbackStatus === 'skipped'
          ? '2026-06-01T12:00:31.000Z'
          : null,
      responseDurationMs:
        feedbackStatus === 'submitted' || feedbackStatus === 'skipped' ? 1_000 : null,
      notRequestedReason: feedbackStatus === 'not_requested_due_to_defeat' ? 'defeat' : null,
    },
  };
}

export function analysisRun(input: {
  id: string;
  sessionId: string;
  condition: ResearchCondition;
  participantCode?: string | null;
  pilot?: boolean;
  runLabel?: PilotRunLabel;
  rooms: RoomResearchRecord[];
  status?: ResearchRun['status'];
}): ResearchRun {
  return {
    ...structuredClone(fixture.run),
    id: input.id,
    condition: input.condition,
    pilot: input.pilot ?? false,
    status: input.status ?? 'completed',
    endedAt: '2026-06-01T12:10:00.000Z',
    runLabel: input.runLabel,
    rooms: input.rooms.map((room) => ({
      ...room,
      researchSessionId: input.sessionId,
      runId: input.id,
      condition: input.condition,
      participantCode: input.participantCode ?? 'P001',
      pilot: input.pilot ?? false,
    })),
  };
}

export function analysisSession(input: {
  id: string;
  participantCode?: string | null;
  pilot?: boolean;
  runs: ResearchRun[];
  startedAt?: string;
  status?: ResearchSession['status'];
}): ResearchSession {
  return {
    ...structuredClone(fixture.session),
    id: input.id,
    participantCode: input.participantCode ?? 'P001',
    pilot: input.pilot ?? false,
    startedAt: input.startedAt ?? '2026-06-01T12:00:00.000Z',
    status: input.status ?? 'ended',
    endedAt: '2026-06-01T12:20:00.000Z',
    runs: input.runs.map((run) => ({
      ...run,
      pilot: input.pilot ?? false,
      rooms: run.rooms.map((room) => ({
        ...room,
        researchSessionId: input.id,
        participantCode: input.participantCode ?? 'P001',
        pilot: input.pilot ?? false,
      })),
    })),
  };
}

export function completeConditionSession(input: {
  id: string;
  participantCode: string;
  condition: ResearchCondition;
  difficulties: (DifficultyRating | 'skip')[];
  pilot?: boolean;
  runLabel?: PilotRunLabel;
}): ResearchSession {
  const runId = `${input.id}-run`;
  const rooms = input.difficulties.map((difficulty, index) =>
    analysisRecord({
      sessionId: input.id,
      runId,
      roomDecisionId: `${input.id}-room-${index + 1}`,
      condition: input.condition,
      participantCode: input.participantCode,
      pilot: input.pilot,
      difficulty: difficulty === 'skip' ? null : difficulty,
      feedbackStatus: difficulty === 'skip' ? 'skipped' : 'submitted',
    }),
  );
  return analysisSession({
    id: input.id,
    participantCode: input.participantCode,
    pilot: input.pilot,
    runs: [
      analysisRun({
        id: runId,
        sessionId: input.id,
        condition: input.condition,
        participantCode: input.participantCode,
        pilot: input.pilot,
        runLabel: input.runLabel,
        rooms,
      }),
    ],
  });
}
