import { useEffect, useState } from 'react';
import { Panel } from '../components/common/Panel';
import { PrimaryButton, SecondaryButton } from '../components/common/Buttons';

type Status = 'pending_review' | 'approved' | 'quarantined' | 'rejected';
interface Row {
  research_session_id: string;
  participant_code: string | null;
  participant_sequence: number | null;
  pilot: boolean;
  completion_status: string;
  uploaded_at: string;
  game_version: string | null;
  protocol_id: string | null;
  research_schema_version: string;
  data_quality_warnings: string[];
  review_status: Status;
  model_eligible: boolean;
  payload_json: unknown;
}

export function ResearchAdminPage() {
  const [token, setToken] = useState('');
  const [filter, setFilter] = useState<Status>('pending_review');
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(1);
  const [firstSequence, setFirstSequence] = useState(1);
  const [mode, setMode] = useState<'pilot' | 'official'>('pilot');
  const [issued, setIssued] = useState<string[]>([]);
  async function api(path: string, init: RequestInit = {}) {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? 'Request failed.');
    return value;
  }
  async function load() {
    if (!token) return;
    try {
      const value = await api(`/api/research/reviews?status=${filter}`);
      setRows(value.sessions);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Request failed.');
    }
  }
  // Token intentionally remains runtime memory; refresh only when the moderation filter changes.
  useEffect(() => {
    void load();
    // Token intentionally remains runtime memory; refresh only when the moderation filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);
  async function review(id: string, status: Status) {
    await api('/api/research/reviews', {
      method: 'POST',
      body: JSON.stringify({ action: 'status', researchSessionId: id, status }),
    });
    await load();
  }
  async function comment(id: string) {
    const text = window.prompt('Append review comment');
    if (!text) return;
    await api('/api/research/reviews', {
      method: 'POST',
      body: JSON.stringify({
        action: 'comment',
        researchSessionId: id,
        category: 'general',
        commentText: text,
      }),
    });
  }
  async function generate() {
    try {
      const value = await api('/api/research/access/codes', {
        method: 'POST',
        body: JSON.stringify({ count, firstSequence, studyMode: mode }),
      });
      setIssued(value.codes.map((c: { code: string }) => c.code));
      setFirstSequence(firstSequence + count);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Request failed.');
    }
  }
  async function dataset() {
    const value = await api('/api/research/model-dataset');
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'approved-model-dataset.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  if (!token)
    return (
      <div className="research-page">
        <header className="page-heading">
          <p className="eyebrow">Researcher tools</p>
          <h1>Research Administration</h1>
        </header>
        <Panel eyebrow="Runtime authorization">
          <p>
            This shared administrative token is an operational safeguard, not full account
            authentication. It is held in memory only.
          </p>
          <label>
            <span>Admin token</span>
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <PrimaryButton onClick={() => void load()}>Continue</PrimaryButton>
        </Panel>
      </div>
    );
  return (
    <div className="research-page">
      <header className="page-heading">
        <p className="eyebrow">Researcher tools</p>
        <h1>Research Administration</h1>
      </header>
      <Panel eyebrow="Access codes">
        <label>
          <span>Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="pilot">Pilot</option>
            <option value="official">Official</option>
          </select>
        </label>
        <label>
          <span>Count</span>
          <input
            type="number"
            min="1"
            max="500"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <label>
          <span>First participant sequence</span>
          <input
            type="number"
            min="1"
            value={firstSequence}
            onChange={(e) => setFirstSequence(Number(e.target.value))}
          />
        </label>
        <PrimaryButton onClick={() => void generate()}>Generate codes</PrimaryButton>
        {issued.length > 0 && (
          <div>
            <strong>Save now; these codes will not be shown again.</strong>
            <pre>{issued.join('\n')}</pre>
          </div>
        )}
      </Panel>
      <Panel eyebrow="Moderation">
        <div className="research-actions">
          {(['pending_review', 'approved', 'quarantined', 'rejected'] as Status[]).map((s) => (
            <SecondaryButton key={s} onClick={() => setFilter(s)} disabled={filter === s}>
              {s.replace('_', ' ')}
            </SecondaryButton>
          ))}
          <SecondaryButton onClick={() => void dataset()}>
            Download approved model dataset
          </SecondaryButton>
        </div>
        {message && <p role="alert">{message}</p>}
        {rows.map((row) => (
          <article key={row.research_session_id} className="research-session-card">
            <h2>{row.research_session_id}</h2>
            <p>
              {row.participant_code} · Sequence {row.participant_sequence} ·{' '}
              {row.pilot ? 'Pilot' : 'Official'} · {row.completion_status}
            </p>
            <p>
              Uploaded {new Date(row.uploaded_at).toLocaleString()} ·{' '}
              {row.protocol_id ?? 'no protocol'} · {row.game_version ?? 'unknown game'} ·{' '}
              {row.research_schema_version}
            </p>
            <p>
              Warnings:{' '}
              {row.data_quality_warnings.length ? row.data_quality_warnings.join(', ') : 'none'} ·
              Model eligible: {row.model_eligible ? 'yes' : 'no'}
            </p>
            <details>
              <summary>Inspect immutable canonical evidence</summary>
              <pre>{JSON.stringify(row.payload_json, null, 2)}</pre>
            </details>
            <div className="research-actions">
              <SecondaryButton onClick={() => void comment(row.research_session_id)}>
                Add comment
              </SecondaryButton>
              <PrimaryButton onClick={() => void review(row.research_session_id, 'approved')}>
                Approve
              </PrimaryButton>
              <SecondaryButton onClick={() => void review(row.research_session_id, 'quarantined')}>
                Quarantine
              </SecondaryButton>
              <SecondaryButton onClick={() => void review(row.research_session_id, 'rejected')}>
                Reject
              </SecondaryButton>
            </div>
          </article>
        ))}
      </Panel>
    </div>
  );
}
