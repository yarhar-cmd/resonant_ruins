import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import developmentArtifactValue from '../model/__fixtures__/development-artifact-1.json';
import { PageContainer } from '../components/layout/PageContainer';
import { VERSION_INFO } from '../config/version';
import { ModelArtifactSchema, type ModelArtifact } from '../model/artifactSchema';
import { createCounterfactualSandbox } from '../model/counterfactualSandbox';
import {
  clearDevelopmentShadowArtifact,
  getDevelopmentShadowArtifact,
  selectDevelopmentShadowArtifact,
} from '../model/developmentModelSelection';
import { buildModelSemanticFeatures } from '../model/featureBuilder';
import { scoreModelCandidates } from '../model/inference';
import { createModelRegistry } from '../model/modelRegistry';
import { strongestContributions } from '../model/explanations';
import { createRecentRatingAccumulator, deriveRecentRatingFeatures } from '../model/recentRatings';
import { ResearchExportSchema } from '../research/schemas';
import type { GenerationRequest } from '../types/generation';
import type { ModelTargetClass } from '../model/featureManifest';
import type { ResearchExport, ShadowRoomEvidence } from '../types/research';
import { buildSharedCandidatePoolV4 } from '../utils/generatedRoomGeneratorV4';
import { rankNeutralCandidates } from '../utils/neutralRoomSelector';
import { createRules2Profile, scoreRoomFeatureVector } from '../utils/roomSelector';
import { asciiRoom } from '../utils/asciiRoom';

const fixtureArtifact = ModelArtifactSchema.parse(developmentArtifactValue);
const targetLabels: Record<ModelTargetClass, string> = {
  too_easy: 'Too Easy',
  about_right: 'About Right',
  too_hard: 'Too Hard',
};

function defaultRequest(seed: string): GenerationRequest {
  return {
    runSeed: seed,
    dungeonRoomNumber: 10,
    chosenExitId: 'model-lab-entry',
    entranceDirection: 'west',
    experiencePreset: 'seasoned-adventurer',
    effectiveProfile: {
      pace: 0.5,
      caution: 0.5,
      aggression: 0.5,
      hazardTolerance: 0.5,
      exploration: 0.5,
    },
    mode: 'reinforce',
    generatorVersion: VERSION_INFO.generatorVersion,
    adaptationVersion: VERSION_INFO.adaptationVersion,
    gameVersion: VERSION_INFO.gameVersion,
    selectorId: 'rules-adaptive',
    recovery: {
      currentHealth: 4,
      maximumHealth: 6,
      recentGeneratedDamage: [0, 1, 0],
      damageStreak: 0,
      roomsSinceLastGeneratedSpawn: 3,
      roomsSinceLastUse: 3,
      previousSkipped: false,
      recentCombatPressure: 1,
      cooldownRemaining: 0,
    },
  };
}

function formatProbability(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function ModelLabPage() {
  const navigate = useNavigate();
  const renderStarted = useRef(performance.now());
  const [renderDuration, setRenderDuration] = useState<number | null>(null);
  const [seed, setSeed] = useState('model-lab-001');
  const [selectedArtifact, setSelectedArtifact] = useState<ModelArtifact | null>(
    getDevelopmentShadowArtifact,
  );
  const [artifactMessage, setArtifactMessage] = useState('No model selected.');
  const [artifactValidationMs, setArtifactValidationMs] = useState<number | null>(null);
  const [researchExport, setResearchExport] = useState<ResearchExport | null>(null);
  const [researchMessage, setResearchMessage] = useState(
    'No ResearchExport loaded. Imports remain in memory and are never persisted.',
  );
  const [targetClass, setTargetClass] = useState<ModelTargetClass>('about_right');
  const [previewCandidateId, setPreviewCandidateId] = useState('');

  useEffect(() => {
    setRenderDuration(performance.now() - renderStarted.current);
  }, []);

  const poolMeasurement = useMemo(() => {
    const started = performance.now();
    const request = defaultRequest(seed);
    const pool = buildSharedCandidatePoolV4(request);
    return { request, pool, durationMs: performance.now() - started };
  }, [seed]);
  const { request, pool } = poolMeasurement;
  const recentRatings = deriveRecentRatingFeatures(createRecentRatingAccumulator());
  const modelInputs = useMemo(
    () =>
      pool.candidates.map((candidate) => ({
        candidateId: candidate.id,
        features: buildModelSemanticFeatures(
          {
            profileForRoom: request.effectiveProfile,
            healthBefore: request.recovery?.currentHealth ?? 6,
            maximumHealth: request.recovery?.maximumHealth ?? 6,
            recentDamage:
              request.recovery?.recentGeneratedDamage.reduce((sum, value) => sum + value, 0) ?? 0,
            recentAverageRoomDuration: 0,
            recentDurationRoomCount: 0,
            roomsCompletedInSession: 0,
            experiencePreset: request.experiencePreset,
            incomingEntranceDirection: request.entranceDirection,
            recentRatings,
          },
          {
            featureVector: candidate.featureVector,
            fountainPlacement: candidate.save.details.recoveryDecision?.placementStyle ?? 'none',
          },
        ),
      })),
    [pool.candidates, recentRatings, request],
  );
  const modelResult = useMemo(
    () =>
      selectedArtifact
        ? scoreModelCandidates(selectedArtifact, modelInputs)
        : ({ status: 'unavailable' } as const),
    [modelInputs, selectedArtifact],
  );
  const rulesRanks = useMemo(() => {
    const adjusted = createRules2Profile(request.effectiveProfile, request.mode, pool.roomSeed);
    return new Map(
      pool.candidates
        .map((candidate) => ({
          id: candidate.id,
          score: scoreRoomFeatureVector(candidate.featureVector, adjusted.profile),
        }))
        .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
        .map((candidate, index) => [candidate.id, index + 1]),
    );
  }, [pool, request.effectiveProfile, request.mode]);
  const neutralRanks = useMemo(
    () =>
      new Map(
        rankNeutralCandidates(pool.candidates, {
          sharedPoolId: pool.poolId,
          selectionSeed: pool.roomSeed,
        }).map((candidate, index) => [candidate.id, index + 1]),
      ),
    [pool],
  );
  const selectedPreview =
    pool.candidates.find((candidate) => candidate.id === previewCandidateId) ?? pool.candidates[0]!;
  const shadows = useMemo(
    () =>
      researchExport?.sessions.flatMap((session) =>
        session.runs.flatMap((run) =>
          run.rooms.flatMap((room) => (room.shadow ? [room.shadow] : [])),
        ),
      ) ?? [],
    [researchExport],
  );
  const importedRooms =
    researchExport?.sessions.reduce(
      (total, session) =>
        total + session.runs.reduce((runTotal, run) => runTotal + run.rooms.length, 0),
      0,
    ) ?? 0;
  const selectedPrediction =
    modelResult.status === 'success'
      ? modelResult.predictions.find((prediction) => prediction.candidateId === selectedPreview.id)
      : null;
  const coefficientRows = selectedArtifact
    ? selectedArtifact.encodedFeatureOrder
        .map((feature, index) => ({
          feature,
          coefficient:
            selectedArtifact.coefficients[selectedArtifact.classOrder.indexOf(targetClass)]![
              index
            ]!,
        }))
        .sort(
          (left, right) =>
            Math.abs(right.coefficient) - Math.abs(left.coefficient) ||
            left.feature.localeCompare(right.feature),
        )
        .slice(0, 12)
    : [];

  function selectFixture() {
    selectDevelopmentShadowArtifact(fixtureArtifact);
    setSelectedArtifact(fixtureArtifact);
    setArtifactMessage(
      'Synthetic development fixture selected explicitly. Pilot shadow scoring may use it until this page reloads.',
    );
  }

  function selectNoModel() {
    clearDevelopmentShadowArtifact();
    setSelectedArtifact(null);
    setArtifactMessage('No model selected. Official Research has no approved model installed.');
  }

  async function importArtifact(file: File | undefined) {
    if (!file) return;
    const started = performance.now();
    try {
      const parsed = ModelArtifactSchema.safeParse(JSON.parse(await file.text()));
      setArtifactValidationMs(performance.now() - started);
      if (!parsed.success) {
        setArtifactMessage(
          `Artifact rejected: ${parsed.error.issues[0]?.message ?? 'schema validation failed'}`,
        );
        return;
      }
      setSelectedArtifact(parsed.data);
      if (parsed.data.status === 'development') selectDevelopmentShadowArtifact(parsed.data);
      setArtifactMessage(
        `${parsed.data.status} artifact ${parsed.data.artifactId} loaded in memory. No file was persisted.`,
      );
    } catch {
      setArtifactValidationMs(performance.now() - started);
      setArtifactMessage('Artifact rejected: file is not valid JSON.');
    }
  }

  async function importResearch(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = ResearchExportSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        setResearchMessage(
          `ResearchExport rejected: ${parsed.error.issues[0]?.message ?? 'schema validation failed'}`,
        );
        return;
      }
      setResearchExport(parsed.data as ResearchExport);
      setResearchMessage(
        'ResearchExport validated in memory. Participant-linked fields are not displayed or persisted.',
      );
    } catch {
      setResearchMessage('ResearchExport rejected: file is not valid JSON.');
    }
  }

  function launchSandbox(rewardOverride: 'force' | 'disable' = 'disable') {
    const token = createCounterfactualSandbox(
      selectedPreview.save,
      selectedPreview.id,
      Date.now(),
      rewardOverride,
    );
    navigate(`/model-lab/sandbox?token=${encodeURIComponent(token)}`);
  }

  return (
    <PageContainer
      eyebrow="Local and Preview development instrument"
      title="Model Comparison Lab"
      intro="Compare the unchanged Rules and Neutral selectors with a local shadow model. The model has zero gameplay authority in mvp-0.5."
    >
      <div className="sandbox-banner model-lab-warning" role="status">
        <strong>Development-only model instrument.</strong>
        <span>Imports and experiments stay in memory; no learned model controls gameplay.</span>
        <span className="model-lab-badges" aria-label="Model limitations">
          <b>DEVELOPMENT</b>
          <b>SYNTHETIC</b>
          <b>SHADOW ONLY</b>
        </span>
      </div>

      <nav className="model-lab-section-nav" aria-label="Model Lab sections">
        <a href="#model-overview">Overview</a>
        <a href="#candidate-comparison">Candidate Comparison</a>
        <a href="#model-explainability">Explainability</a>
        <a href="#model-imports">Imports and Shadow Records</a>
      </nav>

      <section id="model-overview" className="model-lab-panel" aria-labelledby="registry-heading">
        <div className="model-lab-heading">
          <div>
            <p className="kicker">Overview</p>
            <h2 id="registry-heading">Model state</h2>
          </div>
          <span>{selectedArtifact ? selectedArtifact.status : 'unavailable'}</span>
        </div>
        <div className="model-lab-actions">
          <button className="button button--secondary" type="button" onClick={selectNoModel}>
            Use no model
          </button>
          <button className="button button--secondary" type="button" onClick={selectFixture}>
            Select synthetic fixture
          </button>
          <label className="model-file-input">
            Import artifact JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importArtifact(event.target.files?.[0])}
            />
          </label>
        </div>
        <p className="form-message" role="status">
          {artifactMessage}
        </p>
        <details className="model-technical-details">
          <summary>Registry and artifact metadata</summary>
          <dl className="model-lab-metrics">
            {createModelRegistry([fixtureArtifact]).map((entry) => (
              <div key={entry.id}>
                <dt>{entry.label}</dt>
                <dd>{entry.reason}</dd>
              </div>
            ))}
          </dl>
          {selectedArtifact && (
            <dl className="model-lab-metrics">
              <div>
                <dt>Artifact</dt>
                <dd>{selectedArtifact.artifactId}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{`${selectedArtifact.modelId} · ${selectedArtifact.modelVersion}`}</dd>
              </div>
              <div>
                <dt>Dataset fingerprint</dt>
                <dd>{selectedArtifact.datasetFingerprint}</dd>
              </div>
              <div>
                <dt>Evaluation</dt>
                <dd>
                  <pre>{safeJson(selectedArtifact.groupedEvaluation)}</pre>
                </dd>
              </div>
            </dl>
          )}
        </details>
      </section>

      <section
        id="candidate-comparison"
        className="model-lab-panel"
        aria-labelledby="candidate-heading"
      >
        <div className="model-lab-heading">
          <div>
            <p className="kicker">Candidate Comparison</p>
            <h2 id="candidate-heading">Rules · Neutral · Model</h2>
          </div>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setSeed(`model-lab-${Date.now()}`)}
          >
            Generate pool
          </button>
        </div>
        <label className="model-seed-input">
          Deterministic seed
          <input value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>
        <div className="model-table-wrap">
          <table className="model-comparison-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Archetype</th>
                <th>Rules rank</th>
                <th>Neutral rank</th>
                <th>Model rank</th>
                <th>Too Easy</th>
                <th>About Right</th>
                <th>Too Hard</th>
              </tr>
            </thead>
            <tbody>
              {pool.candidates.map((candidate) => {
                const prediction =
                  modelResult.status === 'success'
                    ? modelResult.predictions.find((item) => item.candidateId === candidate.id)
                    : null;
                return (
                  <tr key={candidate.id}>
                    <td>
                      <button
                        className="model-candidate-link"
                        type="button"
                        onClick={() => setPreviewCandidateId(candidate.id)}
                      >
                        {candidate.id.split(':').at(-1)}
                      </button>
                    </td>
                    <td>{candidate.archetype}</td>
                    <td>{rulesRanks.get(candidate.id) ?? '—'}</td>
                    <td>{neutralRanks.get(candidate.id) ?? '—'}</td>
                    <td>{prediction?.rank ?? '—'}</td>
                    <td>
                      {prediction ? formatProbability(prediction.probabilities.too_easy) : '—'}
                    </td>
                    <td>
                      {prediction ? formatProbability(prediction.probabilities.about_right) : '—'}
                    </td>
                    <td>
                      {prediction ? formatProbability(prediction.probabilities.too_hard) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="model-lab-output">
          <pre aria-label="Selected candidate ASCII preview">
            {asciiRoom(selectedPreview.save.roomSnapshot)}
          </pre>
          <div>
            <h3>{selectedPreview.archetype}</h3>
            <p>
              Exact generator-4 geometry exists in memory, so this candidate is eligible for a
              sandbox-only counterfactual run.
            </p>
            <button className="button" type="button" onClick={() => launchSandbox()}>
              Launch Counterfactual Sandbox
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => launchSandbox('force')}
            >
              Launch with forced Resonance Cache
            </button>
            <button
              className="button button--secondary"
              type="button"
              onClick={() => launchSandbox('disable')}
            >
              Launch with rewards disabled
            </button>
            {selectedPrediction && (
              <div className="model-explanation">
                <h3>Candidate explanation</h3>
                <p>
                  Predicted {targetLabels[selectedPrediction.predictedClass]} at{' '}
                  {formatProbability(selectedPrediction.confidence)} confidence. These values are
                  associations, not causes.
                </p>
                <ul>
                  {strongestContributions(selectedPrediction.contributions[targetClass]).map(
                    (contribution) => (
                      <li key={`${targetClass}-${contribution.feature}`}>{contribution.phrase}</li>
                    ),
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        id="model-explainability"
        className="model-lab-panel"
        aria-labelledby="coefficient-heading"
      >
        <div className="model-lab-heading">
          <div>
            <p className="kicker">Explainability</p>
            <h2 id="coefficient-heading">Coefficient explorer</h2>
          </div>
          <select
            aria-label="Coefficient target class"
            value={targetClass}
            onChange={(event) => setTargetClass(event.target.value as ModelTargetClass)}
          >
            <option value="too_easy">Too Easy</option>
            <option value="about_right">About Right</option>
            <option value="too_hard">Too Hard</option>
          </select>
        </div>
        <details className="model-technical-details">
          <summary>Coefficient table and intercept</summary>
          {selectedArtifact ? (
            <>
              <p>
                Intercept:{' '}
                {selectedArtifact.intercepts[
                  selectedArtifact.classOrder.indexOf(targetClass)
                ]!.toFixed(5)}
              </p>
              <ol className="model-coefficients">
                {coefficientRows.map((row) => (
                  <li key={row.feature}>
                    <span>{row.feature}</span>
                    <strong>{row.coefficient.toFixed(5)}</strong>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p>Select a compatible artifact to inspect coefficients.</p>
          )}
        </details>
      </section>

      <section
        id="model-imports"
        className="model-lab-panel"
        aria-labelledby="research-import-heading"
      >
        <div className="model-lab-heading">
          <div>
            <p className="kicker">Imports and Shadow Records</p>
            <h2 id="research-import-heading">Memory-only inspection</h2>
          </div>
          <label className="model-file-input">
            Import ResearchExport JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void importResearch(event.target.files?.[0])}
            />
          </label>
        </div>
        <p className="form-message" role="status">
          {researchMessage}
        </p>
        <p>
          {importedRooms} imported rooms · {shadows.length} shadow records. Imported v0.4/v0.5
          records do not contain complete candidate geometry, so replay is disabled.
        </p>
        {shadows.length > 0 && <ShadowInspector evidence={shadows[0]!} />}
      </section>

      <details className="model-lab-panel model-technical-details">
        <summary id="performance-heading">Local performance diagnostics</summary>
        <dl className="model-lab-metrics">
          <div>
            <dt>Artifact validation/load</dt>
            <dd>
              {artifactValidationMs === null
                ? 'not measured'
                : `${artifactValidationMs.toFixed(2)} ms`}
            </dd>
          </div>
          <div>
            <dt>Candidate construction</dt>
            <dd>{poolMeasurement.durationMs.toFixed(2)} ms</dd>
          </div>
          <div>
            <dt>Full-pool scoring</dt>
            <dd>
              {modelResult.status === 'success'
                ? `${modelResult.scoringDurationMs.toFixed(2)} ms`
                : 'model unavailable'}
            </dd>
          </div>
          <div>
            <dt>Per-candidate scoring</dt>
            <dd>
              {modelResult.status === 'success'
                ? `${(modelResult.scoringDurationMs / modelResult.predictions.length).toFixed(3)} ms`
                : 'model unavailable'}
            </dd>
          </div>
          <div>
            <dt>Initial Lab render</dt>
            <dd>{renderDuration === null ? 'measuring' : `${renderDuration.toFixed(2)} ms`}</dd>
          </div>
        </dl>
      </details>
    </PageContainer>
  );
}

function ShadowInspector({ evidence }: { evidence: ShadowRoomEvidence }) {
  return (
    <details className="model-shadow-inspector">
      <summary>Inspect first shadow record</summary>
      <dl className="model-lab-metrics">
        <div>
          <dt>Status</dt>
          <dd>{evidence.status}</dd>
        </div>
        <div>
          <dt>Artifact</dt>
          <dd>{evidence.artifactId ?? 'none'}</dd>
        </div>
        <div>
          <dt>Agreement</dt>
          <dd>
            {evidence.agreesWithActiveSelector === null
              ? 'unavailable'
              : String(evidence.agreesWithActiveSelector)}
          </dd>
        </div>
        <div>
          <dt>Observed rating</dt>
          <dd>{evidence.observedRating ?? 'not attached'}</dd>
        </div>
      </dl>
    </details>
  );
}
