import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../components/common/Panel';
import { PrimaryButton } from '../components/common/Buttons';
import { EXPERIENCE_PRESETS, type ExperiencePreset } from '../types/adaptation';
import { claimStudyAccess, saveStudyClaim } from '../services/studyAccess';
import { startResearchSession } from '../services/researchStorage';

export function StudyJoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [preset, setPreset] = useState<ExperiencePreset>('seasoned-adventurer');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pendingClaim = useRef<{ id: string; recoverySecret: string } | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    pendingClaim.current ??= {
      id: `research-session-${crypto.randomUUID()}`,
      recoverySecret: crypto.randomUUID() + crypto.randomUUID(),
    };
    const { id, recoverySecret } = pendingClaim.current;
    try {
      const claim = await claimStudyAccess(code, id, recoverySecret);
      const started = startResearchSession({
        id,
        pilot: claim.studyMode === 'pilot',
        participantCode: claim.participantCode,
        participantSequence: claim.participantSequence,
        experiencePreset: preset,
      });
      if (started.issue && started.issue !== 'storage-pressure')
        throw new Error('This browser could not save the study session.');
      saveStudyClaim(claim);
      pendingClaim.current = null;
      navigate('/research');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Study access is unavailable.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="research-page">
      <header className="page-heading">
        <p className="eyebrow">Resonant Ruins study</p>
        <h1>Join a Study</h1>
        <p>
          Enter the unique access code provided by the researcher. No account, name, or email is
          required.
        </p>
      </header>
      <Panel eyebrow="Study access">
        <form onSubmit={submit}>
          <label>
            <span>Study access code</span>
            <input
              aria-label="Study access code"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Experience preset</span>
            <select value={preset} onChange={(e) => setPreset(e.target.value as ExperiencePreset)}>
              {Object.entries(EXPERIENCE_PRESETS).map(([id, p]) => (
                <option key={id} value={id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <p>
            Evidence saves locally first. After the completion questionnaire it is submitted for
            review; a local backup remains on this device.
          </p>
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? 'Checking code…' : 'Begin study'}
          </PrimaryButton>
          {message && <p role="alert">{message}</p>}
        </form>
      </Panel>
    </div>
  );
}
