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
} from '../types/research';
import { NEUTRAL_ADAPTIVE_PROFILE } from './playerProfileStorage';

export type ResearchStorageIssue =
  'invalid' | 'unavailable' | 'write-failed' | 'storage-pressure' | 'not-found' | 'conflict';

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
  assignmentUnit?: ResearchAssignmentUnit;
  now?: number;
  id?: string;
  sessionSeed?: string;
}): ResearchSession {
  const participantCode = input.participantCode?.trim() ?? '';
  const normalizedCode = normalizeParticipantCode(participantCode);
  if (participantCode && !normalizedCode) throw new Error('Invalid participant code.');
  const id = input.id ?? newId('research-session');
  return {
    researchSchemaVersion: RESEARCH_SCHEMA_VERSION,
    id,
    pilot: input.pilot,
    participantCode: normalizedCode,
    sessionSeed: input.sessionSeed ?? `${id}:${input.now ?? Date.now()}`,
    assignmentUnit: input.assignmentUnit ?? DEFAULT_ASSIGNMENT_UNIT,
    assignmentMethodId: RESEARCH_ASSIGNMENT_METHOD_ID,
    startedAt: nowIso(input.now),
    endedAt: null,
    status: 'active',
    startingProfileSource: 'neutral-session-baseline',
    sessionProfile: { ...NEUTRAL_ADAPTIVE_PROFILE },
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
  const assignment = assignResearchCondition({
    sessionSeed: input.session.sessionSeed,
    runIndex,
    unit: input.session.assignmentUnit,
  });
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
    experiencePreset: input.experiencePreset,
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
