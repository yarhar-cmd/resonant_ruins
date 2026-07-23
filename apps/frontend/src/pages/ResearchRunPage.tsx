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
  updateResearchSessionProfile,
} from '../services/researchStorage';
import { MODEL_LAB_ENABLED } from '../config/environment';
import { getPilotDevelopmentShadowArtifact } from '../model/developmentModelSelection';
import { createArtifactScoringModel } from '../model/inference';

export function ResearchRunPage() {
  const [initial] = useState(loadResearchActiveRun);
  const researchStorage = useMemo(loadResearchStorage, []);
  const research = researchStorage.data;
  const active = initial.record;
  const session = active
    ? research.sessions.find((candidate) => candidate.id === active.researchSessionId)
    : null;
  const run = session?.runs.find((candidate) => candidate.id === active?.researchRunId);
  const shadowModel = useMemo(() => {
    const artifact = getPilotDevelopmentShadowArtifact(Boolean(session?.pilot), MODEL_LAB_ENABLED);
    return artifact ? createArtifactScoringModel(artifact) : null;
  }, [session?.pilot]);
  const saveRecord = useCallback((gameplay: NonNullable<typeof active>['gameplay']) => {
    const current = loadResearchActiveRun().record;
    return current ? saveResearchActiveRun({ ...current, gameplay }) : ('invalid' as const);
  }, []);

  if (!active || !session || !run || session.status !== 'active')
    return <Navigate to="/research" replace />;

  return (
    <DungeonRunSession
      initialRecord={active.gameplay}
      controllerOptions={{
        mode: 'research',
        researchCondition: run.condition,
        researchSessionProfile: session.sessionProfile,
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
          updateResearchSessionProfile(session.id, profile),
        onResearchRoomStart: (roomStart) => {
          const current = loadResearchActiveRun().record;
          return Boolean(current && !saveResearchActiveRun({ ...current, roomStart }));
        },
        onResearchPendingChange: (pendingFeedback) => {
          const current = loadResearchActiveRun().record;
          return Boolean(current && !saveResearchActiveRun({ ...current, pendingFeedback }));
        },
        onResearchShadowChange: (pendingShadow) => {
          const current = loadResearchActiveRun().record;
          return Boolean(current && !saveResearchActiveRun({ ...current, pendingShadow }));
        },
        onFinalizeResearchRecord: (record) => finalizeRoomResearchRecord(record),
        saveActiveRecord: saveRecord,
        clearActiveRecord: () => {
          clearResearchActiveRun();
        },
        returnPath: '/research',
      }}
    />
  );
}
