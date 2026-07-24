import {
  PILOT_CHARACTER_ID,
  PILOT_TARGET_OUTCOMES,
  pilotConditionOrder,
  validatePilotSession,
} from '../pilotProtocol';
import type { ResearchSession, RoomResearchRecord } from '../../types/research';
import type { AnalysisDataset, AnalysisFilters, AnalysisQualityWarning } from './types';

const SUSPICIOUS_ROOM_DURATION_MS = 30 * 60 * 1_000;

function sourceFilenames(dataset: AnalysisDataset, sessionId: string): string[] {
  return dataset.sourceFilenamesBySessionId[sessionId] ?? [];
}

function warning(
  dataset: AnalysisDataset,
  session: ResearchSession,
  code: string,
  message: string,
  details: Partial<Pick<AnalysisQualityWarning, 'runId' | 'roomDecisionId'>> = {},
): AnalysisQualityWarning {
  return {
    code,
    severity: 'warning',
    message,
    sessionId: session.id,
    sourceFilenames: sourceFilenames(dataset, session.id),
    ...details,
  };
}

function timestampIsMalformed(value: string | null | undefined): boolean {
  return Boolean(value && Number.isNaN(Date.parse(value)));
}

function roomWarnings(
  dataset: AnalysisDataset,
  session: ResearchSession,
  runId: string,
  room: RoomResearchRecord,
): AnalysisQualityWarning[] {
  const details = { runId, roomDecisionId: room.roomDecisionId };
  const warnings: AnalysisQualityWarning[] = [];
  if (timestampIsMalformed(room.capturedAt)) {
    warnings.push(
      warning(
        dataset,
        session,
        'malformed-room-timestamp',
        'Room timestamp is malformed.',
        details,
      ),
    );
  }
  if (room.outcome.durationMs > SUSPICIOUS_ROOM_DURATION_MS) {
    warnings.push(
      warning(
        dataset,
        session,
        'suspicious-room-duration',
        'Room duration exceeds 30 minutes and may include an interrupted or idle period.',
        details,
      ),
    );
  }
  if (room.feedback.status === 'pending') {
    warnings.push(
      warning(
        dataset,
        session,
        'pending-feedback',
        'A finalized room still has pending feedback.',
        details,
      ),
    );
  }
  if (room.feedback.status === 'not_requested_due_to_defeat') {
    warnings.push(
      warning(
        dataset,
        session,
        'legacy-defeat-feedback',
        'Defeat feedback was not requested in this legacy record, so it is missing from rating denominators.',
        details,
      ),
    );
  }
  if (
    room.outcome.status === 'completed' &&
    (!room.outcome.chosenExitId || !room.outcome.outgoingDirection)
  ) {
    warnings.push(
      warning(
        dataset,
        session,
        'completed-room-missing-exit',
        'A completed room is missing its chosen exit or outgoing direction.',
        details,
      ),
    );
  }
  if (
    room.outcome.status !== 'completed' &&
    (room.outcome.chosenExitId !== null || room.outcome.outgoingDirection !== null)
  ) {
    warnings.push(
      warning(
        dataset,
        session,
        'terminal-room-has-exit',
        'A defeated or interrupted room unexpectedly records a chosen exit.',
        details,
      ),
    );
  }
  return warnings;
}

function fixedPilotWarnings(
  dataset: AnalysisDataset,
  session: ResearchSession,
): AnalysisQualityWarning[] {
  if (session.protocolId !== 'fixed-pilot-1') return [];
  const warnings = validatePilotSession(session).map((message) =>
    warning(dataset, session, 'fixed-pilot-protocol', message),
  );
  if (!session.participantSequence) {
    warnings.push(
      warning(
        dataset,
        session,
        'missing-participant-sequence',
        'Fixed Pilot session has no participant sequence.',
      ),
    );
  } else if (
    session.hiddenConditionOrder?.join('|') !==
    pilotConditionOrder(session.participantSequence).join('|')
  ) {
    warnings.push(
      warning(
        dataset,
        session,
        'condition-order-mismatch',
        'Stored condition order does not match the participant sequence.',
      ),
    );
  }
  if (session.lockedCharacterId !== PILOT_CHARACTER_ID) {
    warnings.push(
      warning(
        dataset,
        session,
        'pilot-character-mismatch',
        'Fixed Pilot session is not locked to the Warden.',
      ),
    );
  }
  for (const [index, run] of session.runs.entries()) {
    const runLabel = index === 0 ? 'Run A' : 'Run B';
    if (run.rooms.length !== PILOT_TARGET_OUTCOMES) {
      warnings.push(
        warning(
          dataset,
          session,
          'pilot-run-length',
          `${runLabel} contains ${run.rooms.length} finalized rooms instead of ${PILOT_TARGET_OUTCOMES}.`,
          { runId: run.id },
        ),
      );
    }
    if (run.experiencePreset !== session.lockedExperiencePreset) {
      warnings.push(
        warning(
          dataset,
          session,
          'pilot-preset-mismatch',
          `${runLabel} does not use the session's locked experience preset.`,
          { runId: run.id },
        ),
      );
    }
  }
  if (!session.runs.some((run) => run.runLabel === 'Run A')) {
    warnings.push(
      warning(dataset, session, 'missing-run-a', 'Fixed Pilot session is missing Run A.'),
    );
  }
  if (!session.runs.some((run) => run.runLabel === 'Run B')) {
    warnings.push(
      warning(dataset, session, 'missing-run-b', 'Fixed Pilot session is missing Run B.'),
    );
  }
  return warnings;
}

export function detectAnalysisQualityWarnings(
  dataset: AnalysisDataset,
  analyzedSessions: readonly ResearchSession[],
  filters: AnalysisFilters,
): AnalysisQualityWarning[] {
  const warnings: AnalysisQualityWarning[] = [
    ...dataset.validationFailures.map((failure) => ({
      code: 'invalid-import',
      severity: 'error' as const,
      message: `Import rejected: ${failure.messages.join(' ')}`,
      sourceFilenames: [failure.filename],
    })),
    ...dataset.conflicts.map((item) => ({
      code: `conflicting-${item.kind}`,
      severity: 'error' as const,
      message: `${item.message} Durable ID: ${item.durableId}.`,
      sourceFilenames: item.sourceFilenames,
    })),
  ];

  if (filters.pilot !== 'official' && analyzedSessions.some((session) => session.pilot)) {
    warnings.push({
      code: 'pilot-data-included',
      severity: 'warning',
      message:
        'Pilot data is included. Keep Pilot findings separate from official participant analysis.',
      sourceFilenames: [],
    });
  }

  const sessionsByParticipant = new Map<string, ResearchSession[]>();
  for (const session of dataset.sessions) {
    if (session.participantCode?.trim()) {
      const code = session.participantCode.trim();
      sessionsByParticipant.set(code, [...(sessionsByParticipant.get(code) ?? []), session]);
    }
  }
  for (const [participantCode, sessions] of sessionsByParticipant) {
    if (sessions.length > 1) {
      warnings.push({
        code: 'participant-code-reused',
        severity: 'warning',
        message: `Participant code ${participantCode} appears in ${sessions.length} sessions.`,
        sourceFilenames: [
          ...new Set(sessions.flatMap((session) => sourceFilenames(dataset, session.id))),
        ].sort(),
      });
    }
  }

  const gameVersions = new Set<string>();
  const generatorVersions = new Set<string>();
  for (const session of analyzedSessions) {
    if (timestampIsMalformed(session.startedAt) || timestampIsMalformed(session.endedAt)) {
      warnings.push(
        warning(
          dataset,
          session,
          'malformed-session-timestamp',
          'Session start or end timestamp is malformed.',
        ),
      );
    }
    warnings.push(...fixedPilotWarnings(dataset, session));
    for (const run of session.runs) {
      if (timestampIsMalformed(run.startedAt) || timestampIsMalformed(run.endedAt)) {
        warnings.push(
          warning(
            dataset,
            session,
            'malformed-run-timestamp',
            'Run start or end timestamp is malformed.',
            { runId: run.id },
          ),
        );
      }
      for (const room of run.rooms) {
        gameVersions.add(room.gameVersion);
        generatorVersions.add(room.generatorVersion);
        warnings.push(...roomWarnings(dataset, session, run.id, room));
      }
    }
  }
  if (gameVersions.size > 1) {
    warnings.push({
      code: 'mixed-game-versions',
      severity: 'warning',
      message: `Analysis includes multiple game versions: ${[...gameVersions].sort().join(', ')}.`,
      sourceFilenames: dataset.sources.map((source) => source.filename).sort(),
    });
  }
  if (generatorVersions.size > 1) {
    warnings.push({
      code: 'mixed-generator-versions',
      severity: 'warning',
      message: `Analysis includes multiple generator versions: ${[...generatorVersions]
        .sort()
        .join(', ')}.`,
      sourceFilenames: dataset.sources.map((source) => source.filename).sort(),
    });
  }

  return warnings.sort(
    (left, right) =>
      Number(right.severity === 'error') - Number(left.severity === 'error') ||
      left.code.localeCompare(right.code) ||
      (left.sessionId ?? '').localeCompare(right.sessionId ?? ''),
  );
}
