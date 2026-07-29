import { useMemo, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../components/common/Buttons';
import { Panel } from '../components/common/Panel';
import { ConfirmationDialog } from '../components/mirrorvault/ConfirmationDialog';
import { ResearchAnalysisCharts } from '../components/mirrorvault/ResearchAnalysisCharts';
import { downloadResearchFile } from '../research/export';
import {
  createResearchAnalysis,
  filterResearchSessions,
} from '../research/analysis/analyzeResearch';
import {
  analysisFilename,
  analysisQualityCsv,
  analysisQualityJson,
  analysisSummaryJson,
  pairedAnalysisCsv,
  participantAnalysisCsv,
} from '../research/analysis/exportAnalysis';
import {
  combineResearchSources,
  parseResearchExportText,
} from '../research/analysis/importResearch';
import { detectAnalysisQualityWarnings } from '../research/analysis/quality';
import {
  DEFAULT_ANALYSIS_FILTERS,
  type AnalysisFilters,
  type ImportValidationFailure,
  type ValidatedResearchSource,
} from '../research/analysis/types';
import { EXPERIENCE_PRESETS } from '../types/adaptation';
import { fetchResearchExport } from '../services/researchSync';

function percentage(value: number | null): string {
  return value === null ? 'Not available' : `${(value * 100).toFixed(1)}%`;
}

function download(filename: string, contents: string, type: string) {
  downloadResearchFile(filename, contents, type);
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('File read failed.')));
    reader.readAsText(file);
  });
}

export function ResearchAnalysisPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sources, setSources] = useState<ValidatedResearchSource[]>([]);
  const [failures, setFailures] = useState<ImportValidationFailure[]>([]);
  const [filters, setFilters] = useState<AnalysisFilters>(DEFAULT_ANALYSIS_FILTERS);
  const [clearConfirmation, setClearConfirmation] = useState(false);
  const [importStatus, setImportStatus] = useState('No files imported.');
  const [adminToken, setAdminToken] = useState('');
  const [serverPending, setServerPending] = useState(false);
  const dataset = useMemo(() => combineResearchSources(sources, failures), [failures, sources]);
  const analyzedSessions = useMemo(
    () => filterResearchSessions(dataset.sessions, filters),
    [dataset.sessions, filters],
  );
  const analysis = useMemo(() => createResearchAnalysis(analyzedSessions), [analyzedSessions]);
  const warnings = useMemo(
    () => detectAnalysisQualityWarnings(dataset, analyzedSessions, filters),
    [analyzedSessions, dataset, filters],
  );
  const versions = useMemo(() => {
    const rooms = dataset.sessions.flatMap((session) => session.runs.flatMap((run) => run.rooms));
    return {
      game: [...new Set(rooms.map((room) => room.gameVersion))].sort(),
      generator: [...new Set(rooms.map((room) => room.generatorVersion))].sort(),
    };
  }, [dataset.sessions]);

  function setFilter<Key extends keyof AnalysisFilters>(key: Key, value: AnalysisFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    const parsed = await Promise.all(
      [...files].map(async (file) => {
        try {
          return parseResearchExportText(file.name, await readFileText(file));
        } catch {
          return {
            source: null,
            failure: {
              filename: file.name,
              messages: ['The browser could not read this file.'],
            },
          };
        }
      }),
    );
    const accepted = parsed.flatMap((item) => (item.source ? [item.source] : []));
    const rejected = parsed.flatMap((item) => (item.failure ? [item.failure] : []));
    setSources((current) => [...current, ...accepted]);
    setFailures((current) => [...current, ...rejected]);
    setImportStatus(
      `${accepted.length} file${accepted.length === 1 ? '' : 's'} accepted; ${rejected.length} rejected.`,
    );
    if (inputRef.current) inputRef.current.value = '';
  }

  function clearImportedData() {
    setSources([]);
    setFailures([]);
    setFilters(DEFAULT_ANALYSIS_FILTERS);
    setImportStatus('Imported analysis data cleared from memory.');
    setClearConfirmation(false);
  }

  async function importFromServer() {
    if (!adminToken || serverPending) return;
    setServerPending(true);
    try {
      const researchExport = await fetchResearchExport(adminToken);
      setSources((current) => [
        ...current,
        { filename: `research-server-${researchExport.exportedAt}.json`, researchExport },
      ]);
      setImportStatus(
        `${researchExport.sessions.length} session(s) imported from research-server.`,
      );
    } catch (error) {
      setFailures((current) => [
        ...current,
        {
          filename: 'research-server',
          messages: [error instanceof Error ? error.message : 'Server import failed.'],
        },
      ]);
      setImportStatus('Research server import rejected.');
    } finally {
      setServerPending(false);
    }
  }

  const filterControls = (
    <div className="analysis-filter-grid">
      <label>
        <span>Pilot status</span>
        <select
          value={filters.pilot}
          onChange={(event) => setFilter('pilot', event.target.value as AnalysisFilters['pilot'])}
        >
          <option value="official">Official only</option>
          <option value="pilot">Pilot only</option>
          <option value="all">Pilot and Official</option>
        </select>
      </label>
      <label>
        <span>Session completion</span>
        <select
          value={filters.completion}
          onChange={(event) =>
            setFilter('completion', event.target.value as AnalysisFilters['completion'])
          }
        >
          <option value="complete">Complete only</option>
          <option value="incomplete">Incomplete only</option>
          <option value="all">All completion states</option>
        </select>
      </label>
      <label>
        <span>Condition</span>
        <select
          value={filters.condition}
          onChange={(event) =>
            setFilter('condition', event.target.value as AnalysisFilters['condition'])
          }
        >
          <option value="all">All conditions</option>
          <option value="RULES_ADAPTIVE">Adaptive</option>
          <option value="NEUTRAL_PROCEDURAL">Neutral</option>
        </select>
      </label>
      <label>
        <span>Experience preset</span>
        <select
          value={filters.preset}
          onChange={(event) => setFilter('preset', event.target.value as AnalysisFilters['preset'])}
        >
          <option value="all">All presets</option>
          {Object.entries(EXPERIENCE_PRESETS).map(([id, preset]) => (
            <option key={id} value={id}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Condition order</span>
        <select
          value={filters.order}
          onChange={(event) => setFilter('order', event.target.value as AnalysisFilters['order'])}
        >
          <option value="all">All orders</option>
          <option value="adaptive-first">Adaptive first</option>
          <option value="neutral-first">Neutral first</option>
        </select>
      </label>
      <label>
        <span>Participant sequence</span>
        <input
          type="number"
          min="1"
          step="1"
          value={filters.participantSequence ?? ''}
          onChange={(event) =>
            setFilter('participantSequence', event.target.value ? Number(event.target.value) : null)
          }
        />
      </label>
      <label>
        <span>Game version</span>
        <select
          value={filters.gameVersion}
          onChange={(event) => setFilter('gameVersion', event.target.value)}
        >
          <option value="all">All game versions</option>
          {versions.game.map((version) => (
            <option key={version}>{version}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Generator version</span>
        <select
          value={filters.generatorVersion}
          onChange={(event) => setFilter('generatorVersion', event.target.value)}
        >
          <option value="all">All generator versions</option>
          {versions.generator.map((version) => (
            <option key={version}>{version}</option>
          ))}
        </select>
      </label>
      <label>
        <span>From date</span>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(event) => setFilter('dateFrom', event.target.value)}
        />
      </label>
      <label>
        <span>Through date</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(event) => setFilter('dateTo', event.target.value)}
        />
      </label>
    </div>
  );

  return (
    <div className="research-analysis-page">
      <header className="page-heading">
        <p className="eyebrow">Local researcher workspace</p>
        <h1>Research Analysis Lab</h1>
        <p>
          Combine validated Resonant Ruins JSON exports and calculate descriptive participant-level
          results without uploading evidence.
        </p>
      </header>

      <div className="analysis-local-notice" role="note">
        <strong>Separate analysis workspace.</strong> File and server imports remain in this browser
        tab&apos;s memory. They never write to active gameplay research storage or alter evidence.
      </div>

      <Panel className="analysis-import-panel" eyebrow="1 / Import evidence">
        <div className="analysis-section-heading">
          <div>
            <h2>Canonical research JSON</h2>
            <p>Select one or more session-scope or multi-session exports.</p>
          </div>
          {(sources.length > 0 || failures.length > 0) && (
            <button className="button button--danger" onClick={() => setClearConfirmation(true)}>
              Clear imported analysis data
            </button>
          )}
        </div>
        <label className="analysis-file-input">
          <span>Research export files</span>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            multiple
            onChange={(event) => void importFiles(event.target.files)}
          />
        </label>
        <div className="analysis-server-import">
          <label>
            <span>Research admin token</span>
            <input
              type="password"
              autoComplete="off"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
            />
          </label>
          <SecondaryButton
            disabled={!adminToken || serverPending}
            onClick={() => void importFromServer()}
          >
            {serverPending ? 'Importing…' : 'Import from research server'}
          </SecondaryButton>
          <p>
            The token is held in memory only. Retrieved evidence uses the normal validation and
            deduplication pipeline.
          </p>
        </div>
        <p role="status" className="form-message">
          {importStatus}
        </p>
        {failures.length > 0 && (
          <div className="analysis-validation-errors" role="alert">
            <h3>Rejected files</h3>
            <ul>
              {failures.map((failure, index) => (
                <li key={`${failure.filename}-${index}`}>
                  <strong>{failure.filename}</strong>
                  <ul>
                    {failure.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel className="analysis-audit-panel" eyebrow="2 / Import audit">
        <h2>Evidence audit</h2>
        <dl className="analysis-metric-grid">
          <div>
            <dt>Accepted files</dt>
            <dd>{dataset.audit.acceptedFiles}</dd>
          </div>
          <div>
            <dt>Rejected files</dt>
            <dd>{dataset.audit.rejectedFiles}</dd>
          </div>
          <div>
            <dt>Sessions</dt>
            <dd>{dataset.audit.acceptedSessions}</dd>
          </div>
          <div>
            <dt>Runs</dt>
            <dd>{dataset.audit.acceptedRuns}</dd>
          </div>
          <div>
            <dt>Rooms</dt>
            <dd>{dataset.audit.acceptedRooms}</dd>
          </div>
          <div>
            <dt>Duplicate sessions</dt>
            <dd>{dataset.audit.duplicateSessions}</dd>
          </div>
          <div>
            <dt>Duplicate runs</dt>
            <dd>{dataset.audit.duplicateRuns}</dd>
          </div>
          <div>
            <dt>Duplicate rooms</dt>
            <dd>{dataset.audit.duplicateRooms}</dd>
          </div>
          <div>
            <dt>Conflicts</dt>
            <dd>{dataset.audit.conflictingRecords}</dd>
          </div>
        </dl>
        {dataset.conflicts.length > 0 && (
          <ul className="analysis-warning-list">
            {dataset.conflicts.map((conflict, index) => (
              <li key={`${conflict.kind}-${conflict.durableId}-${index}`}>
                <strong>{conflict.kind} conflict:</strong> {conflict.durableId} ·{' '}
                {conflict.sourceFilenames.join(', ')}. Conflicting evidence is excluded.
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="analysis-filter-panel" eyebrow="3 / Filter">
        <div className="analysis-section-heading">
          <div>
            <h2>Analysis cohort</h2>
            <p>Official, complete sessions are selected by default.</p>
          </div>
          <SecondaryButton onClick={() => setFilters(DEFAULT_ANALYSIS_FILTERS)}>
            Reset filters
          </SecondaryButton>
        </div>
        {filterControls}
        {filters.pilot !== 'official' && analyzedSessions.some((session) => session.pilot) && (
          <p className="analysis-pilot-banner" role="status">
            Pilot data is visible. Do not combine it with official-result claims.
          </p>
        )}
      </Panel>

      <section className="analysis-results" aria-labelledby="analysis-results-heading">
        <div className="analysis-section-heading">
          <div>
            <p className="eyebrow">4 / Results</p>
            <h2 id="analysis-results-heading">Descriptive outcomes</h2>
          </div>
          <span className="analysis-count-badge">
            {analyzedSessions.length} matching session
            {analyzedSessions.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="analysis-formula">
          <strong>About Right Rate</strong> = submitted About Right difficulty ratings ÷ all valid
          submitted difficulty ratings. Explicit full skips are excluded; submitted defeat ratings
          remain included.
        </p>

        <div className="analysis-primary-grid">
          {Object.values(analysis.conditions).map((condition) => (
            <article key={condition.condition}>
              <span>{condition.condition === 'RULES_ADAPTIVE' ? 'Adaptive' : 'Neutral'}</span>
              <strong>{percentage(condition.meanParticipantAboutRightRate)}</strong>
              <small>mean participant About Right Rate</small>
              <p>
                Pooled descriptive count: {condition.aboutRightCount} /{' '}
                {condition.validSubmittedDifficultyCount} (
                {percentage(condition.pooledAboutRightRate)})
              </p>
            </article>
          ))}
        </div>

        <ResearchAnalysisCharts analysis={analysis} />

        <section className="analysis-chart-card" aria-labelledby="participant-table-heading">
          <h3 id="participant-table-heading">Participant-condition summaries</h3>
          <div className="analysis-table-wrap">
            <table>
              <caption>One row per participant and condition</caption>
              <thead>
                <tr>
                  <th scope="col">Participant</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Complete</th>
                  <th scope="col">Rooms</th>
                  <th scope="col">About Right</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Rate</th>
                  <th scope="col">Damage mean</th>
                  <th scope="col">Room duration mean</th>
                  <th scope="col">Feedback time mean</th>
                </tr>
              </thead>
              <tbody>
                {analysis.participantConditions.map((row) => (
                  <tr key={`${row.participantKey}-${row.condition}`}>
                    <th scope="row">{row.participantCode ?? row.participantKey}</th>
                    <td>{row.condition === 'RULES_ADAPTIVE' ? 'Adaptive' : 'Neutral'}</td>
                    <td>{row.conditionComplete ? 'Yes' : 'No'}</td>
                    <td>{row.roomCount}</td>
                    <td>{row.aboutRightCount}</td>
                    <td>{row.validSubmittedDifficultyCount}</td>
                    <td>{percentage(row.aboutRightRate)}</td>
                    <td>{row.averageDamageTaken?.toFixed(2) ?? '—'}</td>
                    <td>{row.averageRoomDurationMs?.toFixed(0) ?? '—'} ms</td>
                    <td>{row.averageFeedbackResponseDurationMs?.toFixed(0) ?? '—'} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <Panel className="analysis-quality-panel" eyebrow="5 / Data quality">
        <div className="analysis-section-heading">
          <div>
            <h2>Warnings and compatibility</h2>
            <p>Warnings remain visible and do not silently rewrite evidence.</p>
          </div>
          <span className="analysis-count-badge">{warnings.length} warning(s)</span>
        </div>
        {warnings.length ? (
          <ul className="analysis-quality-list">
            {warnings.map((item, index) => (
              <li
                key={`${item.code}-${item.sessionId ?? 'dataset'}-${index}`}
                className={`analysis-quality-item analysis-quality-item--${item.severity}`}
              >
                <strong>{item.code.replaceAll('-', ' ')}</strong>
                <span>{item.message}</span>
                {item.sourceFilenames.length > 0 && (
                  <small>Source: {item.sourceFilenames.join(', ')}</small>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No data-quality warnings were detected for the current evidence and filters.</p>
        )}
      </Panel>

      <Panel className="analysis-export-panel" eyebrow="6 / Export analysis">
        <h2>Download calculated results</h2>
        <p>Downloads are new analysis artifacts. Original evidence files are never modified.</p>
        <div className="analysis-export-actions">
          <PrimaryButton
            disabled={!analysis.participantConditions.length}
            onClick={() =>
              download(
                analysisFilename('participant-summary', 'csv'),
                participantAnalysisCsv(analysis),
                'text/csv;charset=utf-8',
              )
            }
          >
            Participant CSV
          </PrimaryButton>
          <SecondaryButton
            disabled={!analysis.paired.pairs.length}
            onClick={() =>
              download(
                analysisFilename('paired-analysis', 'csv'),
                pairedAnalysisCsv(analysis),
                'text/csv;charset=utf-8',
              )
            }
          >
            Paired CSV
          </SecondaryButton>
          <SecondaryButton
            onClick={() =>
              download(
                analysisFilename('quality-report', 'csv'),
                analysisQualityCsv(warnings),
                'text/csv;charset=utf-8',
              )
            }
          >
            Quality CSV
          </SecondaryButton>
          <SecondaryButton
            onClick={() =>
              download(
                analysisFilename('quality-report', 'json'),
                analysisQualityJson(warnings),
                'application/json',
              )
            }
          >
            Quality JSON
          </SecondaryButton>
          <SecondaryButton
            onClick={() =>
              download(
                analysisFilename('analysis-summary', 'json'),
                analysisSummaryJson({
                  dataset,
                  filters,
                  analysis,
                  warnings,
                  analyzedSessionCount: analyzedSessions.length,
                }),
                'application/json',
              )
            }
          >
            Summary JSON
          </SecondaryButton>
        </div>
      </Panel>

      <ConfirmationDialog
        open={clearConfirmation}
        title="Clear imported analysis data?"
        confirmLabel="Clear imported data"
        destructive
        onCancel={() => setClearConfirmation(false)}
        onConfirm={clearImportedData}
      >
        <p>
          This removes imported copies from this tab&apos;s memory. It does not alter the original
          files or live Resonant Ruins research storage.
        </p>
      </ConfirmationDialog>
    </div>
  );
}
