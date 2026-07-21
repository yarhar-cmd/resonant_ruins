import { useCallback, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DungeonRunSession } from './DungeonRunPage';
import {
  clearResearchActiveRun,
  loadResearchActiveRun,
  saveResearchActiveRun,
} from '../services/researchActiveRunStorage';
import { loadResearchStorage, updateResearchSessionProfile } from '../services/researchStorage';

export function ResearchRunPage() {
  const [initial] = useState(loadResearchActiveRun);
  const research = useMemo(() => loadResearchStorage().data, []);
  const active = initial.record;
  const session = active
    ? research.sessions.find((candidate) => candidate.id === active.researchSessionId)
    : null;
  const run = session?.runs.find((candidate) => candidate.id === active?.researchRunId);
  const saveRecord = useCallback(
    (gameplay: NonNullable<typeof active>['gameplay']) =>
      active ? saveResearchActiveRun({ ...active, gameplay }) : ('invalid' as const),
    [active],
  );

  if (!active || !session || !run || session.status !== 'active')
    return <Navigate to="/research" replace />;

  return (
    <DungeonRunSession
      initialRecord={active.gameplay}
      controllerOptions={{
        mode: 'research',
        researchCondition: run.condition,
        researchSessionProfile: session.sessionProfile,
        onResearchSessionProfileChange: (profile) =>
          updateResearchSessionProfile(session.id, profile),
        saveActiveRecord: saveRecord,
        clearActiveRecord: () => {
          clearResearchActiveRun();
        },
        returnPath: '/research',
      }}
    />
  );
}
