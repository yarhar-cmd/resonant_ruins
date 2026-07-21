import { useMemo, useState } from 'react';
import { SecondaryButton } from '../common/Buttons';
import { Panel } from '../common/Panel';
import {
  createResearchExport,
  downloadResearchFile,
  researchExportCsv,
  researchExportFilename,
  researchExportJson,
} from '../../research/export';
import { createResearchSummary } from '../../research/summary';
import {
  clearAllResearchData,
  deletePilotResearchData,
  deleteResearchSession,
  researchStorageSize,
} from '../../services/researchStorage';
import { clearResearchActiveRun } from '../../services/researchActiveRunStorage';
import type { ResearchSession, ResearchStorageEnvelope } from '../../types/research';
import { ConfirmationDialog } from './ConfirmationDialog';

type DestructiveAction = { type: 'pilot' | 'all' | 'session'; sessionId?: string } | null;

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export function ResearchDataPanel({
  data,
  onChanged,
  validationStatus = 'valid',
}: {
  data: ResearchStorageEnvelope;
  onChanged: () => void;
  validationStatus?: 'valid' | 'invalid' | 'unavailable';
}) {
  const [includePilot, setIncludePilot] = useState(false);
  const [destructiveAction, setDestructiveAction] = useState<DestructiveAction>(null);
  const [message, setMessage] = useState('');
  const summary = useMemo(
    () => createResearchSummary(data.sessions, includePilot),
    [data.sessions, includePilot],
  );
  const pilotSessions = data.sessions.filter((session) => session.pilot);
  const pilotRooms = pilotSessions.reduce(
    (sum, session) => sum + session.runs.reduce((runSum, run) => runSum + run.rooms.length, 0),
    0,
  );
  const unfinishedSession = data.sessions.some((session) => session.status === 'active');

  function exportSessions(sessions: ResearchSession[], format: 'json' | 'csv') {
    try {
      const exportedAt = new Date().toISOString();
      const scope = sessions.length === 1 ? 'session' : 'all-sessions';
      const researchExport = createResearchExport(sessions, scope, exportedAt);
      const contents =
        format === 'json' ? researchExportJson(researchExport) : researchExportCsv(researchExport);
      const filename = researchExportFilename({
        format,
        exportedAt,
        sessionId: scope === 'session' ? sessions[0]!.id : undefined,
      });
      downloadResearchFile(
        filename,
        contents,
        format === 'json' ? 'application/json' : 'text/csv;charset=utf-8',
      );
      setMessage(`${format.toUpperCase()} export prepared locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed validation.');
    }
  }

  function confirmDestructiveAction() {
    if (!destructiveAction) return;
    let issue = null;
    if (destructiveAction.type === 'pilot') {
      const active = data.sessions.find((session) => session.id === data.activeSessionId);
      issue = deletePilotResearchData();
      if (active?.pilot) clearResearchActiveRun();
    } else if (destructiveAction.type === 'all') {
      issue = clearAllResearchData();
      clearResearchActiveRun();
    } else if (destructiveAction.sessionId) {
      issue = deleteResearchSession(destructiveAction.sessionId);
      if (destructiveAction.sessionId === data.activeSessionId) clearResearchActiveRun();
    }
    setDestructiveAction(null);
    setMessage(issue ? 'Research data could not be deleted.' : 'Selected research data deleted.');
    onChanged();
  }

  return (
    <Panel className="research-data-panel" eyebrow="Research data">
      <div className="research-data-heading">
        <div>
          <h2>Browser-local records</h2>
          <p>
            {data.sessions.length} stored session{data.sessions.length === 1 ? '' : 's'} ·
            approximately {Math.ceil(researchStorageSize(data) / 1024)} KB · validation status:
            {validationStatus}
          </p>
        </div>
        <label className="research-pilot-toggle">
          <input
            type="checkbox"
            checked={includePilot}
            onChange={(event) => setIncludePilot(event.target.checked)}
          />
          <span>Include Pilot Data</span>
        </label>
      </div>

      <dl className="research-summary-grid">
        <div>
          <dt>Sessions</dt>
          <dd>{summary.sessionCount}</dd>
        </div>
        <div>
          <dt>Runs</dt>
          <dd>{summary.runCount}</dd>
        </div>
        <div>
          <dt>Room records</dt>
          <dd>{summary.roomCount}</dd>
        </div>
        <div>
          <dt>Rated rooms</dt>
          <dd>{summary.ratedRooms}</dd>
        </div>
        <div>
          <dt>Skipped rooms</dt>
          <dd>{summary.skippedRooms}</dd>
        </div>
        <div>
          <dt>About Right</dt>
          <dd>
            {summary.aboutRightCount} / {summary.ratedRooms} ({percent(summary.aboutRightRate)})
          </dd>
        </div>
        <div>
          <dt>Too Easy</dt>
          <dd>
            {summary.tooEasyCount} ({percent(summary.tooEasyRate)})
          </dd>
        </div>
        <div>
          <dt>Too Hard</dt>
          <dd>
            {summary.tooHardCount} ({percent(summary.tooHardRate)})
          </dd>
        </div>
        <div>
          <dt>Average fairness</dt>
          <dd>{summary.averageFairness?.toFixed(2) ?? '—'} / 5</dd>
        </div>
        <div>
          <dt>Average enjoyment</dt>
          <dd>{summary.averageEnjoyment?.toFixed(2) ?? '—'} / 5</dd>
        </div>
        <div>
          <dt>Participant codes</dt>
          <dd>{summary.participantCodeCount} codes</dd>
        </div>
      </dl>
      <p className="research-summary-note">
        Descriptive results only. Sample size is always shown; no significance, causality,
        superiority, or generalizability is claimed.
      </p>
      {unfinishedSession ? (
        <p>Condition-level results remain hidden while a multi-run session is unfinished.</p>
      ) : (
        <div className="research-condition-summary">
          <span>
            Adaptive: {summary.byCondition.RULES_ADAPTIVE.ratedRooms} rated,{' '}
            {percent(summary.byCondition.RULES_ADAPTIVE.aboutRightRate)} About Right
          </span>
          <span>
            Neutral: {summary.byCondition.NEUTRAL_PROCEDURAL.ratedRooms} rated,{' '}
            {percent(summary.byCondition.NEUTRAL_PROCEDURAL.aboutRightRate)} About Right
          </span>
        </div>
      )}

      <div className="research-actions">
        <SecondaryButton
          disabled={!data.sessions.length}
          onClick={() => exportSessions(data.sessions, 'json')}
        >
          Export all JSON
        </SecondaryButton>
        <SecondaryButton
          disabled={!data.sessions.length}
          onClick={() => exportSessions(data.sessions, 'csv')}
        >
          Export all CSV
        </SecondaryButton>
        <SecondaryButton
          disabled={!pilotSessions.length}
          onClick={() => setDestructiveAction({ type: 'pilot' })}
        >
          Delete Pilot Data ({pilotSessions.length} sessions, {pilotRooms} rooms)
        </SecondaryButton>
        <button
          className="button button--danger"
          disabled={!data.sessions.length}
          onClick={() => setDestructiveAction({ type: 'all' })}
        >
          Clear all research data
        </button>
      </div>

      <div className="research-session-list">
        {data.sessions.map((session) => {
          const rooms = session.runs.flatMap((run) => run.rooms);
          const rated = rooms.filter((room) => room.feedback.status === 'submitted').length;
          const skipped = rooms.filter((room) => room.feedback.status === 'skipped').length;
          return (
            <article key={session.id} className="research-session-record">
              <div>
                <p className="eyebrow">
                  {session.pilot ? 'Pilot' : 'Official'} · {session.status}
                </p>
                <h3>{new Date(session.startedAt).toLocaleString()}</h3>
                <p>
                  {session.runs.length} runs · {rooms.length} rooms · {rated} rated · {skipped}{' '}
                  skipped
                </p>
              </div>
              <div className="research-actions">
                <SecondaryButton onClick={() => exportSessions([session], 'json')}>
                  JSON
                </SecondaryButton>
                <SecondaryButton onClick={() => exportSessions([session], 'csv')}>
                  CSV
                </SecondaryButton>
                <button
                  className="button button--danger"
                  onClick={() => setDestructiveAction({ type: 'session', sessionId: session.id })}
                >
                  Delete
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {message && (
        <p role="status" className="form-message">
          {message}
        </p>
      )}

      <ConfirmationDialog
        open={destructiveAction !== null}
        title={
          destructiveAction?.type === 'pilot'
            ? 'Delete all Pilot data?'
            : destructiveAction?.type === 'all'
              ? 'Clear all research data?'
              : 'Delete this research session?'
        }
        confirmLabel="Delete research data"
        destructive
        onCancel={() => setDestructiveAction(null)}
        onConfirm={confirmDestructiveAction}
      >
        <p>
          This affects only the selected research records. Normal saves, History, best records,
          settings, character selection, and permanent profile remain unchanged.
        </p>
      </ConfirmationDialog>
    </Panel>
  );
}
