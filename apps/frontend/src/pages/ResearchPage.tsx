import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, SecondaryButton } from '../components/common/Buttons';
import { Panel } from '../components/common/Panel';
import { ConfirmationDialog } from '../components/mirrorvault/ConfirmationDialog';
import { ResearchDataPanel } from '../components/mirrorvault/ResearchDataPanel';
import { PilotExitForm } from '../components/mirrorvault/PilotExitForm';
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
  beginPilotBreak,
  createResearchRun,
  endPilotIncomplete,
  endResearchSession,
  loadResearchStorage,
  savePilotSessionExit,
  startResearchSession,
} from '../services/researchStorage';
import { beginPilotRunB, startPilotRunA } from '../services/pilotCoordinator';
import { EXPERIENCE_PRESETS, type ExperiencePreset } from '../types/adaptation';
import type { ResearchSession } from '../types/research';
import { createFreshRun } from '../utils/runLifecycle';

export function ResearchPage() {
  const navigate = useNavigate();
  const { characterId, playerProfile } = useAdventure();
  const [storage, setStorage] = useState(() => loadResearchStorage());
  const [activeRun, setActiveRun] = useState(() => loadResearchActiveRun());
  const [participantCode, setParticipantCode] = useState('');
  const [participantSequence, setParticipantSequence] = useState('');
  const [experiencePreset, setExperiencePreset] = useState<ExperiencePreset>(
    playerProfile?.experiencePreset ?? 'seasoned-adventurer',
  );
  const [noticeAccepted, setNoticeAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [endConfirmation, setEndConfirmation] = useState(false);
  const activeSession = storage.data.sessions.find(
    (session) => session.id === storage.data.activeSessionId,
  );
  const latestCompletedPilot = [...storage.data.sessions]
    .reverse()
    .find(
      (session) =>
        session.protocolId === 'fixed-pilot-1' && session.completionStatus === 'complete',
    );

  function refresh() {
    setStorage(loadResearchStorage());
    setActiveRun(loadResearchActiveRun());
  }

  function startRun(session: ResearchSession) {
    if (session.protocolId === 'fixed-pilot-1') {
      const issue =
        session.runs.length === 0 ? startPilotRunA(session) : beginPilotRunB(session.id);
      if (issue && issue !== 'storage-pressure') {
        setMessage('The Pilot run could not be initialized safely.');
        refresh();
        return;
      }
      navigate('/research/run');
      return;
    }
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
      pendingShadow: null,
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
      const sequence = Number(participantSequence);
      if (pilot && (!Number.isSafeInteger(sequence) || sequence <= 0)) {
        setMessage('Enter a positive participant sequence number.');
        return;
      }
      const started = startResearchSession({
        pilot,
        participantCode,
        experiencePreset,
        ...(pilot ? { participantSequence: sequence } : {}),
      });
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
    const issue =
      activeSession.protocolId === 'fixed-pilot-1'
        ? endPilotIncomplete(activeSession.id, 'participant_withdrew')
        : endResearchSession(activeSession.id);
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

      <Panel className="research-notice" eyebrow="1 / Participation notice">
        <h2>Your choice, your browser</h2>
        <ul>
          <li>Gameplay behavior and room ratings are recorded only after you start.</li>
          <li>Nothing is automatically uploaded; data stays here unless you export it.</li>
          <li>You may skip feedback or end the session at any time.</li>
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
          eyebrow={`3 / ${activeSession.pilot ? 'Pilot session' : 'Official session'}`}
        >
          <h2>Session in progress</h2>
          {activeSession.protocolId === 'fixed-pilot-1' && (
            <p>
              Warden · Experience:{' '}
              <strong>{EXPERIENCE_PRESETS[activeSession.lockedExperiencePreset!].label}</strong>
            </p>
          )}
          <p>
            Started {new Date(activeSession.startedAt).toLocaleString()} ·{' '}
            {activeSession.runs.length} run{activeSession.runs.length === 1 ? '' : 's'}
          </p>
          <div className="research-actions">
            {activeRun.record && (
              <PrimaryButton onClick={() => navigate('/research/run')}>
                Resume{' '}
                {activeSession.participantPhase === 'practice'
                  ? 'Practice'
                  : (activeSession.runs.at(-1)?.runLabel ?? 'research run')}
              </PrimaryButton>
            )}
            {!activeRun.record &&
              activeSession.protocolId === 'fixed-pilot-1' &&
              (activeSession.participantPhase === 'run_a_complete' ||
                activeSession.participantPhase === 'break') && (
                <PrimaryButton onClick={() => startRun(activeSession)}>Begin Run B</PrimaryButton>
              )}
            {activeSession.participantPhase === 'run_a_complete' && (
              <SecondaryButton
                onClick={() => {
                  beginPilotBreak(activeSession.id);
                  refresh();
                }}
              >
                Take optional break
              </SecondaryButton>
            )}
            {!activeRun.record && activeSession.protocolId !== 'fixed-pilot-1' && (
              <PrimaryButton onClick={() => startRun(activeSession)}>
                Start next research run
              </PrimaryButton>
            )}
            <SecondaryButton onClick={() => setEndConfirmation(true)}>End session</SecondaryButton>
          </div>
          {(activeSession.participantPhase === 'run_a_complete' ||
            activeSession.participantPhase === 'break') && (
            <div className="research-break-copy">
              <h3>Run A complete</h3>
              <p>You may take an optional break here. Begin Run B whenever you are ready.</p>
            </div>
          )}
        </Panel>
      ) : (
        <>
          {latestCompletedPilot && (
            <Panel className="research-session-complete" eyebrow="Pilot">
              <h2>Session complete</h2>
              <p>
                Thank you. Both runs are complete and your session is saved in this browser. A
                researcher can now verify or export the session.
              </p>
              <SecondaryButton onClick={() => navigate('/research/review')}>
                Researcher verification
              </SecondaryButton>
            </Panel>
          )}
          {latestCompletedPilot && !latestCompletedPilot.sessionExit && (
            <PilotExitForm
              onSubmit={(value) => {
                const issue = savePilotSessionExit(latestCompletedPilot.id, value);
                refresh();
                return !issue || issue === 'storage-pressure';
              }}
            />
          )}
          <Panel className="research-setup" eyebrow="2 / Session type · 3 / Start">
            <h2>Choose Pilot or Official</h2>
            <label>
              <span>Optional participant code</span>
              <input
                aria-label="Optional participant code"
                value={participantCode}
                maxLength={32}
                pattern={'[A-Za-z0-9_\\-]{1,32}'}
                aria-describedby="participant-code-help"
                onChange={(event) => setParticipantCode(event.target.value)}
              />
              <small id="participant-code-help">
                Letters, numbers, underscores, and hyphens only. This is not a guarantee of
                anonymity.
              </small>
            </label>
            <label>
              <span>Participant sequence number (Pilot)</span>
              <input
                aria-label="Participant sequence number"
                type="number"
                min="1"
                step="1"
                value={participantSequence}
                onChange={(event) => setParticipantSequence(event.target.value)}
              />
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
        </>
      )}

      {!(
        activeSession?.protocolId === 'fixed-pilot-1' && activeSession.completionStatus === 'active'
      ) && (
        <details className="research-data-disclosure">
          <summary>
            <span>Research Data</span>
            <small>Exports, local storage, schema status, and data controls</small>
          </summary>
          <ResearchDataPanel
            data={storage.data}
            validationStatus={storage.issue ?? 'valid'}
            onChanged={refresh}
          />
        </details>
      )}

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
