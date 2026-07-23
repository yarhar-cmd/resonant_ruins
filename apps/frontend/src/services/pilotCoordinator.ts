import { characters } from './mockAdventureService';
import { createActiveRunRecord } from './activeRunStorage';
import {
  clearResearchActiveRun,
  loadResearchActiveRun,
  saveResearchActiveRun,
  type ResearchActiveRunRecord,
} from './researchActiveRunStorage';
import {
  appendResearchRun,
  createResearchRun,
  loadResearchStorage,
  setPilotPhase,
  updateResearchSession,
  type ResearchStorageIssue,
} from './researchStorage';
import {
  PILOT_CHARACTER_ID,
  PILOT_PROTOCOL_ID,
  PILOT_TARGET_OUTCOMES,
  nextRoomOpportunityIndex,
} from '../research/pilotProtocol';
import type { ResearchRun, ResearchSession } from '../types/research';
import { createFreshRun } from '../utils/runLifecycle';

const PILOT_TAB_ID_KEY = 'resonant-ruins:pilot-tab-id:v1';

function tabId(sessionStorageOverride?: Storage): string {
  const storage = sessionStorageOverride ?? window.sessionStorage;
  const existing = storage.getItem(PILOT_TAB_ID_KEY);
  if (existing) return existing;
  const created = `pilot-tab-${crypto.randomUUID()}`;
  storage.setItem(PILOT_TAB_ID_KEY, created);
  return created;
}

function wardenMaximumHealth(): number {
  return characters.find((character) => character.id === PILOT_CHARACTER_ID)!.health;
}

function activeEnvelope(
  session: ResearchSession,
  run: ResearchRun,
  skipPractice: boolean,
  writerTabId: string,
): ResearchActiveRunRecord {
  const attemptIds = run.gameplayAttemptIds!;
  const gameplay = createFreshRun({
    maximumHealth: wardenMaximumHealth(),
    experiencePreset: session.lockedExperiencePreset!,
    longTermProfile:
      run.conditionProfile ?? session.sharedPracticeBaseline ?? session.sessionProfile,
  });
  const record = createActiveRunRecord(gameplay, PILOT_CHARACTER_ID, Date.now());
  if (!record) throw new Error('Pilot gameplay attempt could not be created.');
  return {
    researchSchemaVersion: 'research-1',
    researchSessionId: session.id,
    researchRunId: run.id,
    gameplay: record,
    pendingFeedback: null,
    roomStart: null,
    pendingShadow: null,
    protocolId: PILOT_PROTOCOL_ID,
    participantPhase: run.runLabel === 'Run A' ? 'practice' : 'run_b_active',
    gameplayAttemptId: attemptIds.at(-1)!,
    gameplayAttemptIndex: attemptIds.length,
    skipPractice,
    writerTabId,
  };
}

export function pilotWriterState(
  active: ResearchActiveRunRecord,
  sessionStorageOverride?: Storage,
): 'writer' | 'read-only' {
  if (active.protocolId !== PILOT_PROTOCOL_ID) return 'writer';
  return active.writerTabId === tabId(sessionStorageOverride) ? 'writer' : 'read-only';
}

export function startPilotRunA(
  session: ResearchSession,
  storage?: Storage,
  sessionStorageOverride?: Storage,
): ResearchStorageIssue | null {
  if (session.protocolId !== PILOT_PROTOCOL_ID || session.runs.length !== 0) return 'conflict';
  const run = createResearchRun({
    session,
    characterId: PILOT_CHARACTER_ID,
    experiencePreset: session.lockedExperiencePreset!,
  });
  const issue = appendResearchRun(session.id, run, storage);
  if (issue && issue !== 'storage-pressure') return issue;
  const activeIssue = saveResearchActiveRun(
    activeEnvelope(session, run, false, tabId(sessionStorageOverride)),
    storage,
  );
  return activeIssue ? 'write-failed' : issue;
}

export function beginPilotRunB(
  sessionId: string,
  storage?: Storage,
  sessionStorageOverride?: Storage,
): ResearchStorageIssue | null {
  const session = loadResearchStorage(storage).data.sessions.find((item) => item.id === sessionId);
  if (
    !session ||
    session.protocolId !== PILOT_PROTOCOL_ID ||
    session.runs.length !== 1 ||
    session.runs[0]!.rooms.length !== PILOT_TARGET_OUTCOMES
  )
    return 'conflict';
  const run = createResearchRun({
    session,
    characterId: PILOT_CHARACTER_ID,
    experiencePreset: session.lockedExperiencePreset!,
  });
  const appendIssue = appendResearchRun(session.id, run, storage);
  if (appendIssue && appendIssue !== 'storage-pressure') return appendIssue;
  const refreshed = loadResearchStorage(storage).data.sessions.find(
    (item) => item.id === sessionId,
  )!;
  const phaseIssue = setPilotPhase(sessionId, 'run_b_active', storage);
  if (phaseIssue && phaseIssue !== 'storage-pressure') return phaseIssue;
  const activeIssue = saveResearchActiveRun(
    activeEnvelope(refreshed, run, true, tabId(sessionStorageOverride)),
    storage,
  );
  return activeIssue ? 'write-failed' : (appendIssue ?? phaseIssue);
}

export function continuePilotAfterDefeat(
  sessionId: string,
  runId: string,
  storage?: Storage,
  sessionStorageOverride?: Storage,
): ResearchStorageIssue | null {
  const loaded = loadResearchStorage(storage);
  const session = loaded.data.sessions.find((item) => item.id === sessionId);
  const run = session?.runs.find((item) => item.id === runId);
  if (
    !session ||
    session.protocolId !== PILOT_PROTOCOL_ID ||
    !run ||
    nextRoomOpportunityIndex(run) === null
  )
    return 'conflict';
  const attemptId = `gameplay-attempt-${crypto.randomUUID()}`;
  const nextRun = {
    ...run,
    status: 'active' as const,
    endedAt: null,
    gameplayAttemptIds: [...run.gameplayAttemptIds!, attemptId],
  };
  const participantPhase =
    run.runLabel === 'Run A' ? ('run_a_active' as const) : ('run_b_active' as const);
  const nextSession = {
    ...session,
    participantPhase,
    runs: session.runs.map((item) => (item.id === runId ? nextRun : item)),
  };
  const datasetIssue = updateResearchSession(nextSession, storage);
  if (datasetIssue && datasetIssue !== 'storage-pressure') return datasetIssue;
  const activeIssue = saveResearchActiveRun(
    activeEnvelope(nextSession, nextRun, true, tabId(sessionStorageOverride)),
    storage,
  );
  return activeIssue ? 'write-failed' : datasetIssue;
}

export function recoverPilotActiveRun(
  storage?: Storage,
  sessionStorageOverride?: Storage,
): ResearchStorageIssue | null {
  const existing = loadResearchActiveRun(storage).record;
  if (existing) return null;
  const data = loadResearchStorage(storage).data;
  const session = data.sessions.find((item) => item.id === data.activeSessionId);
  if (!session || session.protocolId !== PILOT_PROTOCOL_ID || session.completionStatus !== 'active')
    return 'not-found';
  const run = session.runs.at(-1);
  if (!run || run.status !== 'active' || nextRoomOpportunityIndex(run) === null) return 'conflict';
  const issue = saveResearchActiveRun(
    activeEnvelope(
      session,
      run,
      Boolean(session.practiceCompletedAt),
      tabId(sessionStorageOverride),
    ),
    storage,
  );
  return issue ? 'write-failed' : null;
}

export function clearCompletedPilotGameplay(storage?: Storage): ResearchStorageIssue | null {
  return clearResearchActiveRun(storage) ? 'write-failed' : null;
}
