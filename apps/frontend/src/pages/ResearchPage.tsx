import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../components/common/Buttons';
import { Panel } from '../components/common/Panel';
import { ConfirmationDialog } from '../components/mirrorvault/ConfirmationDialog';
import { ResearchDataPanel } from '../components/mirrorvault/ResearchDataPanel';
import { getPlayableCharacterId } from '../data/characterAvailability';
import { useAdventure } from '../hooks/useAdventure';
import { createActiveRunRecord } from '../services/activeRunStorage';
import { characters } from '../services/mockAdventureService';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import {
  clearResearchActiveRun,
  loadResearchActiveRun,
  saveResearchActiveRun,
} from '../services/researchActiveRunStorage';
import {
  appendResearchRun,
  createResearchRun,
  endResearchSession,
  loadResearchStorage,
  startResearchSession,
} from '../services/researchStorage';
import { EXPERIENCE_PRESETS, type ExperiencePreset } from '../types/adaptation';
import type { ResearchSession } from '../types/research';
import { createFreshRun } from '../utils/runLifecycle';

export function ResearchPage() {
  const navigate = useNavigate();
  const { characterId, playerProfile } = useAdventure();
  const [storage, setStorage] = useState(() => loadResearchStorage());
  const [activeRun, setActiveRun] = useState(() => loadResearchActiveRun());
  const [participantCode, setParticipantCode] = useState('');
  const [experiencePreset, setExperiencePreset] = useState<ExperiencePreset>(
    playerProfile?.experiencePreset ?? 'seasoned-adventurer',
  );
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [endConfirmation, setEndConfirmation] = useState(false);
  const activeSession = storage.data.sessions.find(
    (session) => session.id === storage.data.activeSessionId,
  );

  function refresh() {
    setStorage(loadResearchStorage());
    setActiveRun(loadResearchActiveRun());
  }

  function startRun(session: ResearchSession) {
    const playableCharacterId = getPlayableCharacterId(characterId);
    const character = characters.find((item) => item.id === playableCharacterId) ?? characters[0]!;
    const nextPreset = session.runs.at(-1)?.experiencePreset ?? experiencePreset;
    const run = createResearchRun({
      session,
      characterId: playableCharacterId,
      experiencePreset: nextPreset,
    });
    const gameplay = createFreshRun({
      maximumHealth: character.health,
      experiencePreset: nextPreset,
      longTermProfile: session.sessionProfile,
    });
    const record = createActiveRunRecord(gameplay, playableCharacterId, Date.now());
    const appendIssue = record ? appendResearchRun(session.id, run) : 'invalid';
    if (!record || (appendIssue && appendIssue !== 'storage-pressure')) {
      setMessage('The research run could not be initialized.');
      return;
    }
    const activeIssue = saveResearchActiveRun({
      researchSchemaVersion: 'research-1',
      researchSessionId: session.id,
      researchRunId: run.id,
      gameplay: record,
      pendingFeedback: null,
      roomStart: null,
    });
    if (activeIssue) {
      setMessage('The research run could not be stored in this browser.');
      return;
    }
    navigate('/research/run');
  }

  function startSession(pilot: boolean) {
    if (!noticeAccepted) {
      setMessage('Confirm that you have read the participation and local-data notice.');
      return;
    }
    if (activeSession) {
      setMessage('End the active research session before starting another.');
      return;
    }
    try {
      const started = startResearchSession({ pilot, participantCode });
      if (started.issue && started.issue !== 'storage-pressure') {
        setMessage('The research session could not be stored in this browser.');
        return;
      }
      startRun({ ...started.session, sessionProfile: { ...NEUTRAL_ADAPTIVE_PROFILE } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The research session could not start.');
    }
  }

  function endActiveSession() {
    if (!activeSession) return;
    const issue = endResearchSession(activeSession.id);
    clearResearchActiveRun();
    setEndConfirmation(false);
    setMessage(issue ? 'The session could not be ended cleanly.' : 'Research session ended.');
    refresh();
  }

  return (
    <div className="research-page">
      <header className="page-heading">
        <p className="eyebrow">Resonant Ruins research</p>
        <h1>Research Mode</h1>
        <p>
          Help evaluate whether behavior-adaptive room selection improves room fit without reducing
          fairness or enjoyment.
        </p>
      </header>

      <Panel className="research-notice" eyebrow="Participation and data notice">
        <h2>Your choice, your browser</h2>
        <ul>
          <li>Gameplay behavior and room ratings are recorded only after you start a session.</li>
          <li>Data remains in this browser unless you manually export and share it.</li>
          <li>Nothing is automatically uploaded, and feedback questions may be skipped.</li>
          <li>You may end the session at any time; normal play remains available.</li>
          <li>Exported files leave browser-local control after you share them.</li>
        </ul>
        <label className="research-consent">
          <input
            type="checkbox"
            checked={noticeAccepted}
            onChange={(event) => setNoticeAccepted(event.target.checked)}
          />
          <span>I have read this notice and choose to start when I press a session button.</span>
        </label>
      </Panel>

      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}

      {activeSession ? (
        <Panel
          className="research-session-card"
          eyebrow={activeSession.pilot ? 'Pilot session' : 'Official session'}
        >
          <h2>Session in progress</h2>
          <p>
            Started {new Date(activeSession.startedAt).toLocaleString()} ·{' '}
            {activeSession.runs.length} run{activeSession.runs.length === 1 ? '' : 's'}
          </p>
          <div className="research-actions">
            {activeRun.record && (
              <PrimaryButton onClick={() => navigate('/research/run')}>
                Resume research run
              </PrimaryButton>
            )}
            {!activeRun.record && (
              <PrimaryButton onClick={() => startRun(activeSession)}>
                Start next research run
              </PrimaryButton>
            )}
            <SecondaryButton onClick={() => setEndConfirmation(true)}>End session</SecondaryButton>
          </div>
        </Panel>
      ) : (
        <Panel className="research-setup" eyebrow="Session setup">
          <h2>Choose a session type</h2>
          <label>
            <span>Optional participant code</span>
            <input
              aria-label="Optional participant code"
              value={participantCode}
              maxLength={32}
              pattern="[A-Za-z0-9_-]{1,32}"
              aria-describedby="participant-code-help"
              onChange={(event) => setParticipantCode(event.target.value)}
            />
            <small id="participant-code-help">
              Letters, numbers, underscores, and hyphens only. This is not a guarantee of anonymity.
            </small>
          </label>
          <label>
            <span>Experience preset</span>
            <select
              aria-label="Experience preset"
              value={experiencePreset}
              onChange={(event) => setExperiencePreset(event.target.value as ExperiencePreset)}
            >
              {Object.entries(EXPERIENCE_PRESETS).map(([id, preset]) => (
                <option key={id} value={id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <div className="research-session-options">
            <article>
              <h3>Pilot Session</h3>
              <p>
                Test question wording, timing, export flow, and researcher workflow. Pilot data is
                excluded from official summaries by default.
              </p>
              <SecondaryButton disabled={!noticeAccepted} onClick={() => startSession(true)}>
                Start Pilot Session
              </SecondaryButton>
            </article>
            <article>
              <h3>Official Research Session</h3>
              <p>
                Collect an official local session using balanced adaptive and neutral run
                assignment.
              </p>
              <PrimaryButton disabled={!noticeAccepted} onClick={() => startSession(false)}>
                Start Research Session
              </PrimaryButton>
            </article>
          </div>
        </Panel>
      )}

      <ResearchDataPanel
        data={storage.data}
        validationStatus={storage.issue ?? 'valid'}
        onChanged={refresh}
      />

      <ConfirmationDialog
        open={endConfirmation}
        title="End this research session?"
        confirmLabel="End session"
        destructive
        onCancel={() => setEndConfirmation(false)}
        onConfirm={endActiveSession}
      >
        <p>
          The active run will be marked interrupted. Completed room records will remain available.
        </p>
      </ConfirmationDialog>
    </div>
  );
}
