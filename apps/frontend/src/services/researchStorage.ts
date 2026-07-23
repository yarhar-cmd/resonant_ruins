import {
  DEFAULT_ASSIGNMENT_UNIT,
  RESEARCH_ASSIGNMENT_METHOD_ID,
  RESEARCH_SCHEMA_VERSION,
  RESEARCH_STORAGE_KEY,
  RESEARCH_STORAGE_WARNING_BYTES,
  normalizeParticipantCode,
} from '../config/research';
import { ResearchStorageEnvelopeSchema } from '../research/schemas';
import { assignResearchCondition } from '../research/conditionAssignment';
import type { AdaptiveProfile, ExperiencePreset } from '../types/adaptation';
import type {
  ResearchAssignmentUnit,
  ResearchRun,
  ResearchSession,
  ResearchStorageEnvelope,
  RoomResearchRecord,
} from '../types/research';
import { RoomResearchRecordSchema } from '../research/schemas';
import { NEUTRAL_ADAPTIVE_PROFILE } from './playerProfileStorage';
import {
  PILOT_ASSIGNMENT_METHOD_ID,
  PILOT_CHARACTER_ID,
  PILOT_PROTOCOL_ID,
  PILOT_TARGET_OUTCOMES,
  pilotConditionOrder,
  pilotRunLabel,
} from '../research/pilotProtocol';
import type { PilotIncompleteReason, PilotPhase, PilotSessionExit } from '../types/research';

export type ResearchStorageIssue =
  'invalid' | 'unavailable' | 'write-failed' | 'storage-pressure' | 'not-found' | 'conflict';

export type ResearchRoomFinalizationResult =
  | {
      status: 'saved';
      issue: null;
      warning: 'storage-pressure' | null;
      duplicate: false;
    }
  | {
      status: 'identical-duplicate';
      issue: null;
      warning: null;
      duplicate: true;
    }
  | {
      status: 'conflicting-duplicate';
      issue: 'conflict';
      warning: null;
      duplicate: true;
    }
  | {
      status: 'write-failed';
      issue: Exclude<ResearchStorageIssue, 'storage-pressure'>;
      warning: null;
      duplicate: false;
    };

function storageOrDefault(storage?: Storage): Storage {
  return storage ?? window.localStorage;
}

function nowIso(now = Date.now()): string {
  return new Date(now).toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createEmptyResearchStorage(): ResearchStorageEnvelope {
  return { researchSchemaVersion: RESEARCH_SCHEMA_VERSION, activeSessionId: null, sessions: [] };
}

export function parseResearchStorage(value: unknown): ResearchStorageEnvelope | null {
  const parsed = ResearchStorageEnvelopeSchema.safeParse(value);
  return parsed.success ? (parsed.data as ResearchStorageEnvelope) : null;
}

export function loadResearchStorage(storage?: Storage): {
  data: ResearchStorageEnvelope;
  issue: Exclude<
    ResearchStorageIssue,
    'write-failed' | 'storage-pressure' | 'not-found' | 'conflict'
  > | null;
} {
  try {
    const raw = storageOrDefault(storage).getItem(RESEARCH_STORAGE_KEY);
    if (raw === null) return { data: createEmptyResearchStorage(), issue: null };
    const parsed = parseResearchStorage(JSON.parse(raw) as unknown);
    return parsed
      ? { data: parsed, issue: null }
      : { data: createEmptyResearchStorage(), issue: 'invalid' };
  } catch (error) {
    return {
      data: createEmptyResearchStorage(),
      issue: error instanceof SyntaxError ? 'invalid' : 'unavailable',
    };
  }
}

export function researchStorageSize(data: ResearchStorageEnvelope): number {
  return new TextEncoder().encode(JSON.stringify(data)).byteLength;
}

export function saveResearchStorage(
  data: ResearchStorageEnvelope,
  storage?: Storage,
): ResearchStorageIssue | null {
  if (!parseResearchStorage(data)) return 'invalid';
  const size = researchStorageSize(data);
  try {
    storageOrDefault(storage).setItem(RESEARCH_STORAGE_KEY, JSON.stringify(data));
    return size >= RESEARCH_STORAGE_WARNING_BYTES ? 'storage-pressure' : null;
  } catch {
    return 'write-failed';
  }
}

export function createResearchSession(input: {
  pilot: boolean;
  participantCode?: string;
  participantSequence?: number;
  experiencePreset?: ExperiencePreset;
  assignmentUnit?: ResearchAssignmentUnit;
  now?: number;
  id?: string;
  sessionSeed?: string;
}): ResearchSession {
  const participantCode = input.participantCode?.trim() ?? '';
  const normalizedCode = normalizeParticipantCode(participantCode);
  if (participantCode && !normalizedCode) throw new Error('Invalid participant code.');
  const id = input.id ?? newId('research-session');
  const fixedPilot = input.pilot && input.participantSequence !== undefined;
  if (fixedPilot && !input.experiencePreset)
    throw new Error('Pilot experience preset is required.');
  const pilotOrder = fixedPilot ? pilotConditionOrder(input.participantSequence!) : null;
  return {
    researchSchemaVersion: RESEARCH_SCHEMA_VERSION,
    id,
    pilot: input.pilot,
    participantCode: normalizedCode,
    sessionSeed: input.sessionSeed ?? `${id}:${input.now ?? Date.now()}`,
    assignmentUnit: input.assignmentUnit ?? DEFAULT_ASSIGNMENT_UNIT,
    assignmentMethodId: fixedPilot ? PILOT_ASSIGNMENT_METHOD_ID : RESEARCH_ASSIGNMENT_METHOD_ID,
    startedAt: nowIso(input.now),
    endedAt: null,
    status: 'active',
    startingProfileSource: 'neutral-session-baseline',
    sessionProfile: { ...NEUTRAL_ADAPTIVE_PROFILE },
    ...(fixedPilot
      ? {
          protocolId: PILOT_PROTOCOL_ID,
          participantSequence: input.participantSequence!,
          lockedExperiencePreset: input.experiencePreset!,
          lockedCharacterId: PILOT_CHARACTER_ID,
          hiddenConditionOrder: pilotOrder!,
          participantPhase: 'practice' as const,
          practiceCompletedAt: null,
          practiceChambersCompleted: 0,
          sharedPracticeBaseline: null,
          completionStatus: 'active' as const,
          completedAt: null,
          incompleteAt: null,
          incompleteReason: null,
          breakStartedAt: null,
          sessionExit: null,
        }
      : {}),
    runs: [],
  };
}

export function startResearchSession(
  input: Parameters<typeof createResearchSession>[0],
  storage?: Storage,
): { session: ResearchSession; issue: ResearchStorageIssue | null } {
  const loaded = loadResearchStorage(storage);
  const session = createResearchSession(input);
  const data: ResearchStorageEnvelope = {
    researchSchemaVersion: RESEARCH_SCHEMA_VERSION,
    activeSessionId: session.id,
    sessions: [...loaded.data.sessions, session],
  };
  return { session, issue: saveResearchStorage(data, storage) ?? loaded.issue };
}

export function createResearchRun(input: {
  session: ResearchSession;
  characterId: string;
  experiencePreset: ExperiencePreset;
  now?: number;
  id?: string;
}): ResearchRun {
  const runIndex = input.session.runs.length;
  const isFixedPilot = input.session.protocolId === PILOT_PROTOCOL_ID;
  if (isFixedPilot && runIndex >= 2) throw new Error('Fixed Pilot sessions contain two runs.');
  const condition = isFixedPilot ? input.session.hiddenConditionOrder![runIndex]! : undefined;
  const assignment = isFixedPilot
    ? {
        unit: 'per-run' as const,
        methodId: PILOT_ASSIGNMENT_METHOD_ID,
        sessionSeed: input.session.sessionSeed,
        runIndex,
        blockIndex: 0,
        roll: input.session.participantSequence! % 2 === 1 ? 0 : 1,
        condition: condition!,
      }
    : assignResearchCondition({
        sessionSeed: input.session.sessionSeed,
        runIndex,
        unit: input.session.assignmentUnit,
      });
  const lockedPreset = isFixedPilot
    ? input.session.lockedExperiencePreset!
    : input.experiencePreset;
  if (isFixedPilot && input.characterId !== PILOT_CHARACTER_ID)
    throw new Error('Fixed Pilot runs must use the Warden.');
  return {
    researchSchemaVersion: RESEARCH_SCHEMA_VERSION,
    id: input.id ?? newId('research-run'),
    runIndex,
    pilot: input.session.pilot,
    condition: assignment.condition,
    assignment,
    startedAt: nowIso(input.now),
    endedAt: null,
    status: 'active',
    characterId: input.characterId,
    experiencePreset: lockedPreset,
    ...(isFixedPilot
      ? {
          protocolId: PILOT_PROTOCOL_ID,
          runLabel: pilotRunLabel(runIndex),
          conditionBlockIndex: runIndex as 0 | 1,
          targetOutcomeCount: PILOT_TARGET_OUTCOMES,
          startingProfile: {
            ...(input.session.sharedPracticeBaseline ?? input.session.sessionProfile),
          },
          conditionProfile: {
            ...(input.session.sharedPracticeBaseline ?? input.session.sessionProfile),
          },
          gameplayAttemptIds: [newId('gameplay-attempt')],
        }
      : {}),
    rooms: [],
  };
}

export function updateResearchSession(
  session: ResearchSession,
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const index = loaded.data.sessions.findIndex((item) => item.id === session.id);
  if (index < 0) return 'not-found';
  const sessions = [...loaded.data.sessions];
  sessions[index] = session;
  return saveResearchStorage({ ...loaded.data, sessions }, storage) ?? loaded.issue;
}

export function appendResearchRun(
  sessionId: string,
  run: ResearchRun,
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === sessionId);
  if (!session) return 'not-found';
  if (session.runs.some((item) => item.id === run.id)) return 'conflict';
  return updateResearchSession({ ...session, runs: [...session.runs, run] }, storage);
}

export function updateResearchSessionProfile(
  sessionId: string,
  profile: AdaptiveProfile,
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === sessionId);
  return session
    ? updateResearchSession({ ...session, sessionProfile: { ...profile } }, storage)
    : 'not-found';
}

export function updatePilotProfile(
  sessionId: string,
  runId: string,
  profile: AdaptiveProfile,
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === sessionId);
  if (!session) return 'not-found';
  if (session.protocolId !== PILOT_PROTOCOL_ID)
    return updateResearchSessionProfile(sessionId, profile, storage);
  const run = session.runs.find((item) => item.id === runId);
  if (!run) return 'not-found';
  if (!session.practiceCompletedAt) {
    return updateResearchSession(
      {
        ...session,
        sessionProfile: { ...profile },
        sharedPracticeBaseline: { ...profile },
        practiceChambersCompleted: 5,
        practiceCompletedAt: nowIso(),
        participantPhase: 'run_a_active',
        runs: session.runs.map((item) =>
          item.id === runId
            ? {
                ...item,
                startingProfile: { ...profile },
                conditionProfile: { ...profile },
              }
            : item,
        ),
      },
      storage,
    );
  }
  return updateResearchSession(
    {
      ...session,
      runs: session.runs.map((item) =>
        item.id === runId ? { ...item, conditionProfile: { ...profile } } : item,
      ),
    },
    storage,
  );
}

export function setPilotPhase(
  sessionId: string,
  participantPhase: PilotPhase,
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === sessionId);
  return session?.protocolId === PILOT_PROTOCOL_ID
    ? updateResearchSession({ ...session, participantPhase }, storage)
    : 'not-found';
}

export function beginPilotBreak(
  sessionId: string,
  now = Date.now(),
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === sessionId);
  return session?.protocolId === PILOT_PROTOCOL_ID && session.participantPhase === 'run_a_complete'
    ? updateResearchSession(
        { ...session, participantPhase: 'break', breakStartedAt: nowIso(now) },
        storage,
      )
    : 'conflict';
}

export function savePilotSessionExit(
  sessionId: string,
  sessionExit: PilotSessionExit,
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === sessionId);
  return session?.protocolId === PILOT_PROTOCOL_ID &&
    (session.completionStatus === 'complete' || session.completionStatus === 'incomplete')
    ? updateResearchSession({ ...session, sessionExit }, storage)
    : 'conflict';
}

export function endPilotIncomplete(
  sessionId: string,
  reason: PilotIncompleteReason,
  now = Date.now(),
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === sessionId);
  if (!session || session.protocolId !== PILOT_PROTOCOL_ID) return 'not-found';
  if (session.completionStatus === 'complete') return 'conflict';
  const endedAt = nowIso(now);
  const next: ResearchSession = {
    ...session,
    status: 'ended',
    endedAt,
    completionStatus: 'incomplete',
    completedAt: null,
    incompleteAt: endedAt,
    incompleteReason: reason,
    participantPhase: 'session_incomplete',
    runs: session.runs.map((run) =>
      run.status === 'active' ? { ...run, status: 'interrupted', endedAt } : run,
    ),
  };
  const sessions = loaded.data.sessions.map((item) => (item.id === sessionId ? next : item));
  return saveResearchStorage({ ...loaded.data, activeSessionId: null, sessions }, storage);
}

export function endResearchSession(
  sessionId: string,
  now = Date.now(),
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === sessionId);
  if (!session) return 'not-found';
  const ended: ResearchSession = {
    ...session,
    status: 'ended',
    endedAt: nowIso(now),
    runs: session.runs.map((run) =>
      run.status === 'active' ? { ...run, status: 'interrupted', endedAt: nowIso(now) } : run,
    ),
  };
  const sessions = loaded.data.sessions.map((item) => (item.id === sessionId ? ended : item));
  return saveResearchStorage(
    {
      ...loaded.data,
      activeSessionId:
        loaded.data.activeSessionId === sessionId ? null : loaded.data.activeSessionId,
      sessions,
    },
    storage,
  );
}

export function deleteResearchSession(
  sessionId: string,
  storage?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  if (!loaded.data.sessions.some((session) => session.id === sessionId)) return 'not-found';
  return saveResearchStorage(
    {
      ...loaded.data,
      activeSessionId:
        loaded.data.activeSessionId === sessionId ? null : loaded.data.activeSessionId,
      sessions: loaded.data.sessions.filter((session) => session.id !== sessionId),
    },
    storage,
  );
}

export function deletePilotResearchData(storage?: Storage): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const sessions = loaded.data.sessions.filter((session) => !session.pilot);
  const activeSessionId = sessions.some((session) => session.id === loaded.data.activeSessionId)
    ? loaded.data.activeSessionId
    : null;
  return saveResearchStorage({ ...loaded.data, activeSessionId, sessions }, storage);
}

export function clearAllResearchData(storage?: Storage): ResearchStorageIssue | null {
  try {
    storageOrDefault(storage).removeItem(RESEARCH_STORAGE_KEY);
    return null;
  } catch {
    return 'unavailable';
  }
}

export function finalizeRoomResearchRecord(
  record: RoomResearchRecord,
  storage?: Storage,
): ResearchRoomFinalizationResult {
  const parsedRecord = RoomResearchRecordSchema.safeParse(record);
  if (!parsedRecord.success)
    return { status: 'write-failed', issue: 'invalid', warning: null, duplicate: false };
  record = parsedRecord.data as RoomResearchRecord;
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === record.researchSessionId);
  const run = session?.runs.find((item) => item.id === record.runId);
  if (!session || !run)
    return { status: 'write-failed', issue: 'not-found', warning: null, duplicate: false };
  const existing = run.rooms.find((room) => room.roomDecisionId === record.roomDecisionId);
  if (existing)
    return JSON.stringify(existing) === JSON.stringify(record)
      ? { status: 'identical-duplicate', issue: null, warning: null, duplicate: true }
      : {
          status: 'conflicting-duplicate',
          issue: 'conflict',
          warning: null,
          duplicate: true,
        };
  const fixedPilot = session.protocolId === PILOT_PROTOCOL_ID;
  if (
    fixedPilot &&
    (run.rooms.length >= PILOT_TARGET_OUTCOMES ||
      record.experiencePreset !== session.lockedExperiencePreset ||
      run.characterId !== PILOT_CHARACTER_ID ||
      record.condition !== run.condition ||
      record.roomOpportunityIndex !== run.rooms.length + 1)
  )
    return { status: 'write-failed', issue: 'invalid', warning: null, duplicate: false };
  const outcomeCount = run.rooms.length + 1;
  const blockComplete = fixedPilot && outcomeCount === PILOT_TARGET_OUTCOMES;
  const terminal =
    blockComplete ||
    (!fixedPilot &&
      (record.outcome.status === 'defeated' || record.outcome.status === 'interrupted'));
  const nextRun: ResearchRun = {
    ...run,
    rooms: [...run.rooms, record],
    status: blockComplete ? 'completed' : terminal ? record.outcome.status : run.status,
    endedAt: terminal ? record.capturedAt : run.endedAt,
    ...(fixedPilot ? { conditionProfile: { ...record.profileAfter } } : {}),
  };
  const isRunA = fixedPilot && run.conditionBlockIndex === 0;
  const isRunB = fixedPilot && run.conditionBlockIndex === 1;
  const sessionComplete = Boolean(isRunB && blockComplete);
  const nextSession: ResearchSession = {
    ...session,
    ...(fixedPilot ? {} : { sessionProfile: { ...record.profileAfter } }),
    ...(isRunA && blockComplete ? { participantPhase: 'run_a_complete' as const } : {}),
    ...(sessionComplete
      ? {
          status: 'ended' as const,
          endedAt: record.capturedAt,
          completionStatus: 'complete' as const,
          completedAt: record.capturedAt,
          incompleteAt: null,
          incompleteReason: null,
          participantPhase: 'session_complete' as const,
        }
      : {}),
    runs: session.runs.map((item) => (item.id === run.id ? nextRun : item)),
  };
  const issue = sessionComplete
    ? saveResearchStorage(
        {
          ...loaded.data,
          activeSessionId: null,
          sessions: loaded.data.sessions.map((item) =>
            item.id === session.id ? nextSession : item,
          ),
        },
        storage,
      )
    : updateResearchSession(nextSession, storage);
  if (issue === null || issue === 'storage-pressure')
    return {
      status: 'saved',
      issue: null,
      warning: issue,
      duplicate: false,
    };
  return { status: 'write-failed', issue, warning: null, duplicate: false };
}
