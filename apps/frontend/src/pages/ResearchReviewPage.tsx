import { Panel } from '../components/common/Panel';
import { SecondaryButton } from '../components/common/Buttons';
import {
  createResearchExport,
  downloadResearchFile,
  pilotResearchExportFilename,
  researchExportCsv,
  researchExportJson,
} from '../research/export';
import { validatePilotSession } from '../research/pilotProtocol';
import { ResearchSessionSchema } from '../research/schemas';
import { loadResearchActiveRun } from '../services/researchActiveRunStorage';
import { loadResearchStorage } from '../services/researchStorage';
import type { ResearchSession } from '../types/research';
import { EXPERIENCE_PRESETS } from '../types/adaptation';
import { loadResearchSyncStates, type ResearchSyncState } from '../services/researchSync';

function exportSession(session: ResearchSession, format: 'json' | 'csv') {
  const exportedAt = new Date().toISOString();
  const data = createResearchExport([session], 'session', exportedAt);
  const contents = format === 'json' ? researchExportJson(data) : researchExportCsv(data);
  downloadResearchFile(
    pilotResearchExportFilename({
      format,
      exportedAt,
      participantCode: session.participantCode,
      participantSequence: session.participantSequence!,
    }),
    contents,
    format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
  );
}

export function ResearchReviewPage() {
  const loaded = loadResearchStorage();
  const active = loadResearchActiveRun();
  const sessions = loaded.data.sessions.filter((session) => session.protocolId === 'fixed-pilot-1');
  const syncStates = loadResearchSyncStates();

  return (
    <div className="research-review-page">
      <header className="page-heading">
        <p className="eyebrow">Researcher view</p>
        <h1>Pilot verification</h1>
        <p>Local invariant checks and manual export for fixed-length Pilot sessions.</p>
      </header>
      {!sessions.length && (
        <Panel>
          <p>No fixed Pilot sessions are stored in this browser.</p>
        </Panel>
      )}
      {[...sessions].reverse().map((session) => {
        const rooms = session.runs.flatMap((run) => run.rooms);
        const issues = validatePilotSession(session);
        const schemaValid = ResearchSessionSchema.safeParse(session).success;
        const staleActive =
          active.record?.researchSessionId === session.id && session.completionStatus !== 'active';
        const sync: ResearchSyncState = syncStates[session.id] ?? {
          status: 'local_only',
          lastAttemptAt: null,
          lastReceipt: null,
          message: null,
        };
        return (
          <Panel key={session.id} className="pilot-verification" eyebrow="Pilot / Official">
            <h2>{session.participantCode ?? 'No participant code'}</h2>
            <dl className="research-summary-grid">
              <div>
                <dt>Research session ID</dt>
                <dd>{session.id}</dd>
              </div>
              <div>
                <dt>Participant sequence</dt>
                <dd>{session.participantSequence}</dd>
              </div>
              <div>
                <dt>Marker</dt>
                <dd>{session.pilot ? 'Pilot' : 'Official'}</dd>
              </div>
              <div>
                <dt>Locked preset</dt>
                <dd>{EXPERIENCE_PRESETS[session.lockedExperiencePreset!].label}</dd>
              </div>
              <div>
                <dt>Warden validation</dt>
                <dd>
                  {session.runs.every((run) => run.characterId === 'warden') ? 'Valid' : 'Invalid'}
                </dd>
              </div>
              <div>
                <dt>Practice</dt>
                <dd>{session.practiceCompletedAt ? 'Complete' : 'Incomplete'}</dd>
              </div>
              {session.runs.map((run) => (
                <div key={run.id}>
                  <dt>{run.runLabel}</dt>
                  <dd>
                    {run.status} · {run.rooms.length} / 10
                  </dd>
                </div>
              ))}
              <div>
                <dt>Hidden order</dt>
                <dd>{session.hiddenConditionOrder?.join(' → ')}</dd>
              </div>
              <div>
                <dt>Defeated rooms</dt>
                <dd>{rooms.filter((room) => room.outcome.status === 'defeated').length}</dd>
              </div>
              <div>
                <dt>Submitted feedback</dt>
                <dd>{rooms.filter((room) => room.feedback.status === 'submitted').length}</dd>
              </div>
              <div>
                <dt>Full skips</dt>
                <dd>
                  {
                    rooms.filter(
                      (room) =>
                        room.feedback.status === 'skipped' && room.feedback.fullDialogSkipped,
                    ).length
                  }
                </dd>
              </div>
              <div>
                <dt>Missing fairness</dt>
                <dd>{rooms.filter((room) => room.feedback.fairness === null).length}</dd>
              </div>
              <div>
                <dt>Missing enjoyment</dt>
                <dd>{rooms.filter((room) => room.feedback.enjoyment === null).length}</dd>
              </div>
              <div>
                <dt>Gameplay attempts</dt>
                <dd>
                  {session.runs.reduce(
                    (sum, run) => sum + (run.gameplayAttemptIds?.length ?? 0),
                    0,
                  )}
                </dd>
              </div>
              <div>
                <dt>Session status</dt>
                <dd>{session.completionStatus}</dd>
              </div>
              <div>
                <dt>Incomplete reason</dt>
                <dd>{session.incompleteReason ?? 'Not applicable'}</dd>
              </div>
              <div>
                <dt>Schema / invariants</dt>
                <dd>
                  {schemaValid && issues.length === 0 ? 'Valid' : `Invalid (${issues.length})`}
                </dd>
              </div>
              <div>
                <dt>Local sync status</dt>
                <dd>{sync.status.replaceAll('_', ' ')}</dd>
              </div>
              <div>
                <dt>Last upload attempt</dt>
                <dd>{sync.lastAttemptAt ?? 'Never'}</dd>
              </div>
            </dl>
            <section className="pilot-technical-review" aria-labelledby={`technical-${session.id}`}>
              <h3 id={`technical-${session.id}`}>Technical problems</h3>
              {!session.sessionExit ? (
                <p>Completion questionnaire not submitted.</p>
              ) : (
                <>
                  <p>{session.sessionExit.technicalProblem === 'yes' ? 'Yes' : 'No'}</p>
                  {session.sessionExit.technicalProblem === 'yes' && (
                    <p>
                      {session.sessionExit.technicalProblemDescription ??
                        'No technical-problem description provided.'}
                    </p>
                  )}
                </>
              )}
            </section>
            {(staleActive || active.issue || issues.length > 0) && (
              <div role="status" className="form-message">
                {staleActive && (
                  <p>Warning: stale active gameplay exists for this terminal session.</p>
                )}
                {active.issue && <p>Warning: active gameplay staging is invalid or unavailable.</p>}
                {issues.map((issue) => (
                  <p key={issue}>{issue}</p>
                ))}
              </div>
            )}
            <div className="research-actions">
              <SecondaryButton onClick={() => exportSession(session, 'json')}>JSON</SecondaryButton>
              <SecondaryButton onClick={() => exportSession(session, 'csv')}>CSV</SecondaryButton>
            </div>
            {sync.message && (
              <p
                role={
                  sync.status === 'conflict' || sync.status === 'upload_failed' ? 'alert' : 'status'
                }
                className="form-message"
              >
                {sync.message} Local evidence has not been deleted or rewritten.
              </p>
            )}
            <p className="research-export-guidance">
              Filename format:{' '}
              <code>
                RR_Pilot_&lt;participant-code&gt;_seq-&lt;number&gt;_&lt;YYYYMMDD-HHMM&gt;
              </code>
              . JSON and CSV use the same condition-masked stem.
            </p>
          </Panel>
        );
      })}
    </div>
  );
}
