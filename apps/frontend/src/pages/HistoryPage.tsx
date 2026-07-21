import { useMemo, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { ConfirmationDialog } from '../components/mirrorvault/ConfirmationDialog';
import { EmptyState } from '../components/common/States';
import { SecondaryButton } from '../components/common/Buttons';
import {
  RUN_STORAGE_INVALID_WARNING,
  StorageWarning,
} from '../components/mirrorvault/StorageWarning';
import {
  getFilteredRunArchiveView,
  clearRecentRunHistory,
  loadRunArchive,
  type CharacterId,
  type RunArchiveFilters,
} from '../services/runArchive';
import { EXPERIENCE_PRESETS, type StoredExperiencePreset } from '../types/adaptation';
import { formatSurvivalTime } from '../utils/gameplayState';

const characterLabels: Record<CharacterId, string> = {
  warden: 'Warden',
  seeker: 'Seeker',
  ember: 'Ember',
};
const experienceLabels: Record<StoredExperiencePreset, string> = {
  'new-delver': EXPERIENCE_PRESETS['new-delver'].label,
  'seasoned-adventurer': EXPERIENCE_PRESETS['seasoned-adventurer'].label,
  'dungeon-veteran': EXPERIENCE_PRESETS['dungeon-veteran'].label,
  unknown: 'Unknown Experience',
};
const clearFilters: RunArchiveFilters = {
  characterId: 'all',
  experiencePreset: 'all',
  gameVersion: 'all',
  generatorVersion: 'all',
};
function gameVersionLabel(version: string): string {
  return !version || version === 'unknown' ? 'Unknown version' : version;
}
function generatorVersionLabel(versions: readonly string[], mixed: boolean): string {
  if (!versions.length) return 'Legacy generator';
  const label = versions.join(' + ');
  return mixed ? `${label} · mixed provenance` : label;
}

export function HistoryPage() {
  const [loaded, setLoaded] = useState(loadRunArchive);
  const [filters, setFilters] = useState<RunArchiveFilters>(clearFilters);
  const [showWarning, setShowWarning] = useState(Boolean(loaded.issue));
  const [clearOpen, setClearOpen] = useState(false);
  const [clearMessage, setClearMessage] = useState('');
  const view = useMemo(
    () => getFilteredRunArchiveView(loaded.data, filters),
    [filters, loaded.data],
  );
  const allRuns = Object.values(loaded.data.histories).flat();
  const gameVersions = [...new Set(allRuns.map((run) => run.gameVersion))].sort();
  const filtersActive =
    filters.characterId !== 'all' ||
    filters.experiencePreset !== 'all' ||
    filters.gameVersion !== 'all' ||
    filters.generatorVersion !== 'all';
  const bestBadges = new Map<string, string[]>();
  for (const [label, runId] of [
    ['Best Survival', view.best.bestTimeRunId],
    ['Best Rooms', view.best.bestRoomsRunId],
    ['Best Enemies', view.best.bestEnemiesRunId],
  ] as const) {
    if (runId) bestBadges.set(runId, [...(bestBadges.get(runId) ?? []), label]);
  }

  function confirmClearHistory() {
    const result = clearRecentRunHistory();
    if (!result.cleared) {
      setShowWarning(true);
      setClearMessage('Run History could not be cleared. No data was changed.');
      return;
    }
    setLoaded({ data: result.data, issue: null });
    setFilters(clearFilters);
    setClearOpen(false);
    setClearMessage('Recent Run History cleared. Best records were preserved.');
  }

  return (
    <PageContainer
      eyebrow="Local archive"
      title="Runs"
      intro="Defeated runs are stored only in this browser and remain partitioned by character and experience."
    >
      {showWarning && (
        <StorageWarning
          message={RUN_STORAGE_INVALID_WARNING}
          onDismiss={() => setShowWarning(false)}
        />
      )}
      <div className="runs-filters" aria-label="Run history filters">
        <label>
          Character
          <select
            value={filters.characterId}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                characterId: event.target.value as RunArchiveFilters['characterId'],
              }))
            }
          >
            <option value="all">All</option>
            {Object.entries(characterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Experience
          <select
            value={filters.experiencePreset}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                experiencePreset: event.target.value as RunArchiveFilters['experiencePreset'],
              }))
            }
          >
            <option value="all">All</option>
            {Object.entries(experienceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <SecondaryButton disabled={!filtersActive} onClick={() => setFilters(clearFilters)}>
          Clear Filters
        </SecondaryButton>
        <label>
          Game version
          <select
            value={filters.gameVersion}
            onChange={(event) =>
              setFilters((current) => ({ ...current, gameVersion: event.target.value }))
            }
          >
            <option value="all">All</option>
            {gameVersions.map((version) => (
              <option key={version} value={version}>
                {gameVersionLabel(version)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Generator
          <select
            value={filters.generatorVersion}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                generatorVersion: event.target.value as RunArchiveFilters['generatorVersion'],
              }))
            }
          >
            <option value="all">All</option>
            <option value="generator-1">generator-1</option>
            <option value="generator-2">generator-2</option>
            <option value="generator-3">generator-3</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>

      <section className="best-runs" aria-labelledby="best-runs-title">
        <h2 id="best-runs-title">Best Runs</h2>
        <dl className="best-runs__grid">
          <div>
            <dt>Best Survival Time</dt>
            <dd>{formatSurvivalTime(view.best.bestTimeSurvivedMs)}</dd>
          </div>
          <div>
            <dt>Best Dungeon Rooms Cleared</dt>
            <dd>{view.best.bestDungeonRoomsCleared}</dd>
          </div>
          <div>
            <dt>Best Enemies Defeated</dt>
            <dd>{view.best.bestEnemiesDefeated}</dd>
          </div>
        </dl>
      </section>

      <section className="recent-runs" aria-labelledby="recent-runs-title">
        <div className="recent-runs__heading">
          <h2 id="recent-runs-title">Recent Runs</h2>
          <button
            type="button"
            className="button button--secondary"
            disabled={allRuns.length === 0}
            onClick={() => setClearOpen(true)}
          >
            Clear Run History
          </button>
        </div>
        {clearMessage && <p role="status">{clearMessage}</p>}
        {view.recentRuns.length === 0 ? (
          <EmptyState>
            {allRuns.length === 0 ? (
              <>
                No completed runs yet.
                <br />
                Your defeated runs will appear here.
              </>
            ) : (
              <>
                No runs match these filters.
                <br />
                <button
                  className="button button--secondary"
                  onClick={() => setFilters(clearFilters)}
                >
                  Clear Filters
                </button>
              </>
            )}
          </EmptyState>
        ) : (
          <div className="history-list">
            {view.recentRuns.map((run) => (
              <article key={run.id} className="history-card">
                <header>
                  <p className="eyebrow">{new Date(run.endedAt).toLocaleString()}</p>
                  <h3>{characterLabels[run.characterId]}</h3>
                  <p>{experienceLabels[run.experiencePreset]}</p>
                  <p>
                    {gameVersionLabel(run.gameVersion)} ·{' '}
                    {generatorVersionLabel(run.generatorVersions, run.mixedGeneratorProvenance)}
                  </p>
                </header>
                <dl>
                  <div>
                    <dt>Survival time</dt>
                    <dd>{formatSurvivalTime(run.timeSurvivedMs)}</dd>
                  </div>
                  <div>
                    <dt>Dungeon rooms cleared</dt>
                    <dd>{run.dungeonRoomsCleared}</dd>
                  </div>
                  <div>
                    <dt>Enemies defeated</dt>
                    <dd>{run.enemiesDefeated}</dd>
                  </div>
                </dl>
                {bestBadges.has(run.id) && (
                  <ul className="run-best-badges" aria-label="Best records owned by this run">
                    {bestBadges.get(run.id)!.map((badge) => (
                      <li key={badge}>{badge}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      <ConfirmationDialog
        open={clearOpen}
        title="Clear Run History?"
        confirmLabel="Clear recent runs"
        destructive
        onConfirm={confirmClearHistory}
        onCancel={() => setClearOpen(false)}
      >
        <p>
          This removes recent completed-run cards only. Best records, the active run, adaptive
          profile, experience preset, settings, and character selection will remain.
        </p>
      </ConfirmationDialog>
    </PageContainer>
  );
}
