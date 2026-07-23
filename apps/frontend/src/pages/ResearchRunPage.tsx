import { useCallback, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DungeonRunSession } from './DungeonRunPage';
import {
  clearResearchActiveRun,
  loadResearchActiveRun,
  saveResearchActiveRun,
} from '../services/researchActiveRunStorage';
import {
  finalizeRoomResearchRecord,
  loadResearchStorage,
  researchStorageSize,
  setPilotPhase,
  updatePilotProfile,
  updateResearchSessionProfile,
} from '../services/researchStorage';
import { MODEL_LAB_ENABLED } from '../config/environment';
import { getPilotDevelopmentShadowArtifact } from '../model/developmentModelSelection';
import { createArtifactScoringModel } from '../model/inference';
import { continuePilotAfterDefeat, pilotWriterState } from '../services/pilotCoordinator';
import type { RoomResearchRecord } from '../types/research';

export function ResearchRunPage() {
  const [initial, setInitial] = useState(loadResearchActiveRun);
  const [finished, setFinished] = useState(false);
  const researchStorage = loadResearchStorage();
  const research = researchStorage.data;
  const active = initial.record;
  const session = active
    ? research.sessions.find((candidate) => candidate.id === active.researchSessionId)
    : null;
  const run = session?.runs.find((candidate) => candidate.id === active?.researchRunId);
  const readOnly =
    active?.protocolId === 'fixed-pilot-1' && pilotWriterState(active) === 'read-only';
  const invalidPilotActive =
    active?.protocolId === 'fixed-pilot-1' &&
    Boolean(
      !session ||
      !run ||
      active.gameplay.characterId !== 'warden' ||
      run.characterId !== 'warden' ||
      active.gameplay.experiencePreset !== session.lockedExperiencePreset ||
      run.experiencePreset !== session.lockedExperiencePreset,
    );
  const shadowModel = useMemo(() => {
    const artifact = getPilotDevelopmentShadowArtifact(Boolean(session?.pilot), MODEL_LAB_ENABLED);
    return artifact ? createArtifactScoringModel(artifact) : null;
  }, [session?.pilot]);
  const saveRecord = useCallback((gameplay: NonNullable<typeof active>['gameplay']) => {
    const current = loadResearchActiveRun().record;
    return current ? saveResearchActiveRun({ ...current, gameplay }) : ('invalid' as const);
  }, []);

  if (finished || !active || !session || !run || session.status !== 'active')
    return <Navigate to="/research" replace />;
  if (readOnly)
    return (
      <main className="participant-read-only">
        <h1>Session open in another tab</h1>
        <p>This tab is read-only. Continue in the first participant tab.</p>
      </main>
    );
  if (invalidPilotActive)
    return (
      <main className="participant-recoverable-error">
        <h1>Session recovery needed</h1>
        <p>The locked Warden or experience preset does not match this saved attempt.</p>
      </main>
    );

  return (
    <DungeonRunSession
      key={`${active.researchRunId}:${active.gameplayAttemptId ?? active.gameplay.runId}`}
      initialRecord={active.gameplay}
      controllerOptions={{
        mode: 'research',
        researchCondition: run.condition,
        researchSessionProfile:
          session.protocolId === 'fixed-pilot-1'
            ? (run.conditionProfile ?? session.sharedPracticeBaseline ?? session.sessionProfile)
            : session.sessionProfile,
        researchSession: session,
        researchRun: run,
        shadowModel,
        pendingResearchFeedback: active.pendingFeedback,
        researchRoomStart: active.roomStart,
        pendingResearchShadow: active.pendingShadow,
        getResearchSessionSnapshot: () => {
          const current = loadResearchStorage().data;
          return current.sessions.find((candidate) => candidate.id === session.id) ?? null;
        },
        researchStorageDiagnostics: {
          recordCount: research.sessions.reduce(
            (sessionTotal, storedSession) =>
              sessionTotal +
              storedSession.runs.reduce(
                (runTotal, storedRun) => runTotal + storedRun.rooms.length,
                0,
              ),
            0,
          ),
          invalidRecordCount: researchStorage.issue === 'invalid' ? 1 : 0,
          storageSizeBytes: researchStorageSize(research),
        },
        onResearchSessionProfileChange: (profile) =>
          session.protocolId === 'fixed-pilot-1'
            ? updatePilotProfile(session.id, run.id, profile)
            : updateResearchSessionProfile(session.id, profile),
        onResearchRoomStart: (roomStart) => {
          const current = loadResearchActiveRun().record;
          return Boolean(current && !saveResearchActiveRun({ ...current, roomStart }));
        },
        onResearchPendingChange: (pendingFeedback) => {
          const current = loadResearchActiveRun().record;
          const saved = Boolean(current && !saveResearchActiveRun({ ...current, pendingFeedback }));
          if (saved && session.protocolId === 'fixed-pilot-1' && pendingFeedback)
            setPilotPhase(
              session.id,
              run.runLabel === 'Run A' ? 'run_a_feedback' : 'run_b_feedback',
            );
          return saved;
        },
        onResearchShadowChange: (pendingShadow) => {
          const current = loadResearchActiveRun().record;
          return Boolean(current && !saveResearchActiveRun({ ...current, pendingShadow }));
        },
        onFinalizeResearchRecord: (record) => finalizeRoomResearchRecord(record),
        shouldStopAfterResearchFinalization: () => {
          if (session.protocolId !== 'fixed-pilot-1') return false;
          const fresh = loadResearchStorage()
            .data.sessions.find((item) => item.id === session.id)
            ?.runs.find((item) => item.id === run.id);
          return Boolean(fresh && fresh.rooms.length >= 10);
        },
        onResearchRecordFinalized: (record: RoomResearchRecord) => {
          if (session.protocolId !== 'fixed-pilot-1') return;
          const freshSession = loadResearchStorage().data.sessions.find(
            (item) => item.id === session.id,
          );
          const freshRun = freshSession?.runs.find((item) => item.id === run.id);
          if (!freshSession || !freshRun || freshRun.rooms.length >= 10) {
            setFinished(true);
            return;
          }
          setPilotPhase(session.id, run.runLabel === 'Run A' ? 'run_a_active' : 'run_b_active');
          if (record.outcome.status === 'defeated') {
            const issue = continuePilotAfterDefeat(session.id, run.id);
            if (!issue || issue === 'storage-pressure') setInitial(loadResearchActiveRun());
          }
        },
        skipResearchPractice: active.skipPractice,
        saveActiveRecord: saveRecord,
        clearActiveRecord: () => {
          clearResearchActiveRun();
        },
        returnPath: '/research',
      }}
    />
  );
}
