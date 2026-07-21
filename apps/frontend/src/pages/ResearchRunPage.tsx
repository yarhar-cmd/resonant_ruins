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
  updateResearchSessionProfile,
} from '../services/researchStorage';

export function ResearchRunPage() {
  const [initial] = useState(loadResearchActiveRun);
  const research = useMemo(() => loadResearchStorage().data, []);
  const active = initial.record;
  const session = active
    ? research.sessions.find((candidate) => candidate.id === active.researchSessionId)
    : null;
  const run = session?.runs.find((candidate) => candidate.id === active?.researchRunId);
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
        pendingResearchFeedback: active.pendingFeedback,
        researchRoomStart: active.roomStart,
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
        onFinalizeResearchRecord: (record) => !finalizeRoomResearchRecord(record).issue,
        saveActiveRecord: saveRecord,
        clearActiveRecord: () => {
          clearResearchActiveRun();
        },
        returnPath: '/research',
      }}
    />
  );
}
