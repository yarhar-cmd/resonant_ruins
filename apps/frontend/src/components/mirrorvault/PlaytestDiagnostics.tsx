import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { GameplayState } from '../../utils/gameplayState';
import type { RoomDefinition } from '../../types/rooms';
import type { ResearchCondition } from '../../types/research';
import type { RunExecutionPolicy, RunMode } from '../../types/runMode';
import { SHADOW_MODEL_STATUS } from '../../research/shadowModel';
import {
  formatDiagnosticTile,
  formatPlaytestDiagnosticSummary,
  selectPlaytestDiagnostics,
} from '../../utils/playtestDiagnostics';
import './PlaytestDiagnostics.css';

export interface ResearchPlaytestDiagnostics {
  runMode: RunMode;
  pilot: boolean;
  sessionId: string;
  participantCodePresent: boolean;
  condition: ResearchCondition;
  assignmentMethod: string;
  selectorId: string;
  selectorVersion: string;
  profileConsumed: boolean;
  sharedPoolId: string;
  requestedCandidateCount: number;
  validCandidateCount: number;
  rejectedCandidateCount: number;
  pendingFeedbackRoom: string | null;
  pendingOutcomeStatus: string | null;
  finalizedRecordStatus: 'none' | 'pending' | 'finalized';
  recordCount: number;
  invalidRecordCount: number;
  researchSchema: string;
  feedbackSchema: string;
  storageSizeBytes: number;
  activePersistenceKey: string;
  writePolicy: RunExecutionPolicy;
}

export function PlaytestDiagnostics({
  gameplay,
  room,
  isInvulnerable,
  now = Date.now(),
  effectsSetting = 'full',
  reducedMotion = false,
  research = null,
}: {
  gameplay: GameplayState;
  room: RoomDefinition;
  isInvulnerable: boolean;
  now?: number;
  effectsSetting?: 'full' | 'reduced' | 'off';
  reducedMotion?: boolean;
  research?: ResearchPlaytestDiagnostics | null;
}) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyOpenRef = useRef(false);
  const snapshot = useMemo(
    () =>
      selectPlaytestDiagnostics(gameplay, room, now, isInvulnerable, effectsSetting, reducedMotion),
    [effectsSetting, gameplay, isInvulnerable, now, reducedMotion, room],
  );

  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (previouslyOpenRef.current) triggerRef.current?.focus();
    previouslyOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.code !== 'Escape' || event.repeat) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setOpen(false);
    }
    window.addEventListener('keydown', closeOnEscape, { capture: true });
    return () => window.removeEventListener('keydown', closeOnEscape, { capture: true });
  }, [open]);

  async function copySummary() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable.');
      const researchSummary = research
        ? `\nresearch=${research.pilot ? 'Pilot' : 'Official'} condition=${research.condition} selector=${research.selectorId}/${research.selectorVersion} pool=${research.sharedPoolId} feedback=${research.finalizedRecordStatus} records=${research.recordCount} invalid=${research.invalidRecordCount} model=${SHADOW_MODEL_STATUS.message}`
        : '';
      await navigator.clipboard.writeText(
        `${formatPlaytestDiagnosticSummary(snapshot)}${researchSummary}`,
      );
      setCopyStatus('Diagnostic summary copied.');
    } catch {
      setCopyStatus('Unable to copy diagnostic summary.');
    }
  }

  const metricRows = [
    ['Alerted Rats', snapshot.combat.alertedRats],
    ['Telegraphing Rats', snapshot.combat.telegraphingRats],
    ['Lunging Rats', snapshot.combat.lungingRats],
    ['Recovering Rats', snapshot.combat.recoveringRats],
    ['Rat attacks started', snapshot.combat.attacksStarted],
    ['Rat attacks landed', snapshot.combat.attacksLanded],
    ['Rat attacks dodged', snapshot.combat.attacksDodged],
    ['Regular blocks', snapshot.combat.regularBlocks],
    ['Perfect blocks', snapshot.combat.perfectBlocks],
    ['Sword swings', snapshot.combat.swordSwings],
    ['Sword hits', snapshot.combat.swordHits],
    ['Player damage taken', snapshot.combat.playerDamageTaken],
    ['Body-lock adjustments', snapshot.combat.bodyLockPreventionActivations],
    ['Maximum simultaneously alerted Rats', snapshot.combat.maximumSimultaneouslyAlertedRats],
    ['Combat duration', `${snapshot.combat.combatDurationMs} ms`],
  ] as const;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="playtest-diagnostics__trigger"
        aria-expanded={open}
        aria-controls="playtest-diagnostics-panel"
        onClick={() => setOpen((current) => !current)}
      >
        PLAYTEST DIAGNOSTICS
      </button>
      {open && (
        <aside
          id="playtest-diagnostics-panel"
          className="playtest-diagnostics"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <header className="playtest-diagnostics__header">
            <h2 id={titleId}>Playtest Diagnostics</h2>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close Playtest Diagnostics"
              onClick={() => setOpen(false)}
            >
              X
            </button>
          </header>
          <div className="playtest-diagnostics__body">
            <section aria-labelledby={`${titleId}-room`}>
              <h3 id={`${titleId}-room`}>Room</h3>
              <dl>
                <div>
                  <dt>Room number</dt>
                  <dd>{snapshot.room.number}</dd>
                </div>
                <div>
                  <dt>Room seed</dt>
                  <dd>{snapshot.room.seed}</dd>
                </div>
                <div>
                  <dt>Game version</dt>
                  <dd>{snapshot.room.gameVersion}</dd>
                </div>
                <div>
                  <dt>Generator version</dt>
                  <dd>{snapshot.room.generatorVersion}</dd>
                </div>
                <div>
                  <dt>Adaptation version</dt>
                  <dd>{snapshot.room.adaptationVersion}</dd>
                </div>
                <div>
                  <dt>Room type</dt>
                  <dd>{snapshot.room.type}</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{snapshot.room.mode}</dd>
                </div>
                <div>
                  <dt>Archetype / boundary</dt>
                  <dd>
                    {snapshot.room.archetype} / {snapshot.room.boundaryFamily}
                  </dd>
                </div>
                <div>
                  <dt>Candidates valid / requested / rejected</dt>
                  <dd>
                    {snapshot.room.validCandidates} / {snapshot.room.requestedCandidates} /{' '}
                    {snapshot.room.rejectedCandidates}
                  </dd>
                </div>
                <div>
                  <dt>Selection rank / score</dt>
                  <dd>
                    {snapshot.room.selectedCandidateRank ?? 'none'} /{' '}
                    {snapshot.room.selectedCandidateScore ?? 'none'}
                  </dd>
                </div>
                <div>
                  <dt>Reduced diversity / fallback</dt>
                  <dd>
                    {String(snapshot.room.reducedDiversity)} / {String(snapshot.room.fallbackUsed)}
                  </dd>
                </div>
                <div>
                  <dt>Available exits</dt>
                  <dd>
                    {snapshot.room.availableExitIds
                      .map(
                        (id, index) =>
                          `${id} (${snapshot.room.availableExitDirections[index] ?? 'unknown'})`,
                      )
                      .join(', ')}
                  </dd>
                </div>
                <div>
                  <dt>Chosen exit ID / direction</dt>
                  <dd>
                    {snapshot.room.chosenExitId ?? 'none'} /{' '}
                    {snapshot.room.chosenExitDirection ?? 'none'}
                  </dd>
                </div>
                <div>
                  <dt>Previous / next entrance</dt>
                  <dd>
                    {snapshot.room.previousEntranceDirection ?? 'none'} /{' '}
                    {snapshot.room.nextEntranceDirection ?? 'none'}
                  </dd>
                </div>
                <div>
                  <dt>Mixed generator provenance</dt>
                  <dd>{String(snapshot.room.mixedGeneratorProvenance)}</dd>
                </div>
              </dl>
              {snapshot.room.exitDecisions.length > 0 && (
                <ul aria-label="Directional exit decisions">
                  {snapshot.room.exitDecisions.map((exit) => (
                    <li key={exit.exitId}>
                      {exit.exitId}: {exit.direction} · path {exit.pathDistance} · safe{' '}
                      {exit.safePathDistance ?? 'none'} · {exit.route}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {snapshot.topology && (
              <section aria-labelledby={`${titleId}-topology`}>
                <h3 id={`${titleId}-topology`}>Topology</h3>
                <dl>
                  <div>
                    <dt>Floor / internal walls</dt>
                    <dd>
                      {snapshot.topology.floorArea} / {snapshot.topology.internalWallCount}
                    </dd>
                  </div>
                  <div>
                    <dt>Loops / branches</dt>
                    <dd>
                      {snapshot.topology.loopCount} / {snapshot.topology.branchCount}
                    </dd>
                  </div>
                  <div>
                    <dt>Articulation points</dt>
                    <dd>{snapshot.topology.articulationPointCount}</dd>
                  </div>
                  <div>
                    <dt>Safe route</dt>
                    <dd>
                      {String(snapshot.topology.safeRouteExists)} /{' '}
                      {snapshot.topology.safePathDistance ?? 'none'}
                    </dd>
                  </div>
                </dl>
                <pre aria-label="ASCII room representation">{snapshot.asciiMap}</pre>
              </section>
            )}

            <section aria-labelledby={`${titleId}-player`}>
              <h3 id={`${titleId}-player`}>Player</h3>
              <dl>
                <div>
                  <dt>Tile position</dt>
                  <dd>{formatDiagnosticTile(snapshot.player.position)}</dd>
                </div>
                <div>
                  <dt>Facing</dt>
                  <dd>{snapshot.player.facing}</dd>
                </div>
                <div>
                  <dt>Shielding active</dt>
                  <dd>{String(snapshot.player.shielding)}</dd>
                </div>
                <div>
                  <dt>Legal escape tiles</dt>
                  <dd>
                    {snapshot.player.legalEscapeTiles.map(formatDiagnosticTile).join(' / ') ||
                      'none'}
                  </dd>
                </div>
                <div>
                  <dt>Health</dt>
                  <dd>
                    {snapshot.player.currentHealth} / {snapshot.player.maximumHealth}
                  </dd>
                </div>
                <div>
                  <dt>Invulnerable</dt>
                  <dd>{String(snapshot.player.invulnerable)}</dd>
                </div>
                <div>
                  <dt>Resonance</dt>
                  <dd>{snapshot.player.resonance}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby={`${titleId}-combat`}>
              <h3 id={`${titleId}-combat`}>Combat summary</h3>
              <dl>
                {metricRows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby={`${titleId}-fountain`}>
              <h3 id={`${titleId}-fountain`}>Restoration Fountain</h3>
              <dl>
                <div>
                  <dt>Spawned / source</dt>
                  <dd>
                    {String(snapshot.fountain.spawned)} / {snapshot.fountain.source}
                  </dd>
                </div>
                <div>
                  <dt>Coordinate / variant</dt>
                  <dd>
                    {formatDiagnosticTile(snapshot.fountain.coordinate)} /{' '}
                    {snapshot.fountain.variant}
                  </dd>
                </div>
                <div>
                  <dt>Placement / depleted</dt>
                  <dd>
                    {snapshot.fountain.placementStyle} / {String(snapshot.fountain.depleted)}
                  </dd>
                </div>
                <div>
                  <dt>Probability / roll</dt>
                  <dd>
                    {snapshot.fountain.probability ?? 'n/a'} / {snapshot.fountain.roll ?? 'n/a'}
                  </dd>
                </div>
                <div>
                  <dt>Cooldown</dt>
                  <dd>{snapshot.fountain.cooldown}</dd>
                </div>
                <div>
                  <dt>Combat lock</dt>
                  <dd>{String(snapshot.fountain.combatLock)}</dd>
                </div>
                <div>
                  <dt>Channel / remaining</dt>
                  <dd>
                    {snapshot.fountain.channelStatus} / {snapshot.fountain.channelRemainingMs} ms
                  </dd>
                </div>
                <div>
                  <dt>Latest cancellation</dt>
                  <dd>{snapshot.fountain.cancellationReason}</dd>
                </div>
                <div>
                  <dt>Reasons</dt>
                  <dd>{snapshot.fountain.reasons.join(', ') || 'none'}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby={`${titleId}-reward`}>
              <h3 id={`${titleId}-reward`}>Resonance Cache · rewards-1</h3>
              <dl>
                <div>
                  <dt>Enabled / eligible</dt>
                  <dd>
                    {String(snapshot.reward.enabled)} / {String(snapshot.reward.eligible)}
                  </dd>
                </div>
                <div>
                  <dt>Placements / roll</dt>
                  <dd>
                    {snapshot.reward.eligiblePlacementCount} / {snapshot.reward.spawnRoll ?? 'n/a'}
                  </dd>
                </div>
                <div>
                  <dt>Spawned / reason</dt>
                  <dd>
                    {String(snapshot.reward.spawned)} / {snapshot.reward.spawnReason}
                  </dd>
                </div>
                <div>
                  <dt>Coordinate / placement</dt>
                  <dd>
                    {formatDiagnosticTile(snapshot.reward.coordinate)} /{' '}
                    {snapshot.reward.placementCategory}
                  </dd>
                </div>
                <div>
                  <dt>Optional score / interaction tiles</dt>
                  <dd>
                    {snapshot.reward.optionalRouteScore ?? 'n/a'} /{' '}
                    {snapshot.reward.interactionTiles.map(formatDiagnosticTile).join(' · ') ||
                      'none'}
                  </dd>
                </div>
                <div>
                  <dt>Status / combat lock</dt>
                  <dd>
                    {snapshot.reward.status} / {String(snapshot.reward.combatLock)}
                  </dd>
                </div>
                <div>
                  <dt>Channel / latest cancellation</dt>
                  <dd>
                    {snapshot.reward.channelRemainingMs} ms /{' '}
                    {snapshot.reward.latestCancellationReason}
                  </dd>
                </div>
                <div>
                  <dt>Awarded</dt>
                  <dd>{String(snapshot.reward.resonanceAwarded)}</dd>
                </div>
                <div>
                  <dt>Model isolation</dt>
                  <dd>
                    features-1 excluded {String(snapshot.reward.excludedFromModelFeatures1)} /
                    pool-shadow unchanged {String(snapshot.reward.sharedPoolAndShadowUnchanged)}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby={`${titleId}-effects`}>
              <h3 id={`${titleId}-effects`}>Effects and run mode</h3>
              <dl>
                <div>
                  <dt>Visual Effects</dt>
                  <dd>{snapshot.effects.setting}</dd>
                </div>
                <div>
                  <dt>Reduced motion / effective</dt>
                  <dd>
                    {String(snapshot.effects.reducedMotion)} / {snapshot.effects.effectiveMode}
                  </dd>
                </div>
                <div>
                  <dt>Run mode</dt>
                  <dd>{snapshot.sandbox.mode}</dd>
                </div>
                <div>
                  <dt>Sandbox guards</dt>
                  <dd>{String(snapshot.sandbox.persistenceGuardsActive)}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby={`${titleId}-rats`}>
              <h3 id={`${titleId}-rats`}>Per Rat</h3>
              {snapshot.rats.length === 0 ? (
                <p>No Rats in the current room.</p>
              ) : (
                <ul className="playtest-diagnostics__rats">
                  {snapshot.rats.map((rat) => (
                    <li key={rat.id}>
                      <strong>{rat.id}</strong>
                      <span>
                        tile {formatDiagnosticTile(rat.position)} / facing {rat.facing} /{' '}
                        {rat.awareness} / {rat.state}
                      </span>
                      <span>
                        distance {rat.pathDistanceToPlayer ?? 'unreachable'} / target{' '}
                        {formatDiagnosticTile(rat.lockedTarget)} / next{' '}
                        {formatDiagnosticTile(rat.nextMovementTile)}
                      </span>
                      <span>
                        telegraph {rat.telegraphRemainingMs} ms / lunge {rat.lungeRemainingMs} ms /
                        recovery {rat.recoveryRemainingMs} ms
                      </span>
                      <span>
                        path blocked {String(rat.pathBlocked)} / body-lock adjusted{' '}
                        {String(rat.bodyLockPreventionApplied)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {research && (
              <section aria-labelledby={`${titleId}-research`}>
                <h3 id={`${titleId}-research`}>Research session</h3>
                <dl>
                  <div>
                    <dt>Run mode / session type</dt>
                    <dd>
                      {research.runMode} / {research.pilot ? 'Pilot' : 'Official'}
                    </dd>
                  </div>
                  <div>
                    <dt>Session ID</dt>
                    <dd>{research.sessionId}</dd>
                  </div>
                  <div>
                    <dt>Participant code</dt>
                    <dd>{research.participantCodePresent ? 'present' : 'absent'}</dd>
                  </div>
                  <div>
                    <dt>Condition / assignment</dt>
                    <dd>
                      {research.condition} / {research.assignmentMethod}
                    </dd>
                  </div>
                  <div>
                    <dt>Selector / profile consumed</dt>
                    <dd>
                      {research.selectorId} / {research.selectorVersion} /{' '}
                      {String(research.profileConsumed)}
                    </dd>
                  </div>
                  <div>
                    <dt>Shared pool</dt>
                    <dd>{research.sharedPoolId}</dd>
                  </div>
                  <div>
                    <dt>Candidates valid / requested / rejected</dt>
                    <dd>
                      {research.validCandidateCount} / {research.requestedCandidateCount} /{' '}
                      {research.rejectedCandidateCount}
                    </dd>
                  </div>
                  <div>
                    <dt>Pending feedback / outcome</dt>
                    <dd>
                      {research.pendingFeedbackRoom ?? 'none'} /{' '}
                      {research.pendingOutcomeStatus ?? 'none'}
                    </dd>
                  </div>
                  <div>
                    <dt>Record status / valid / invalid</dt>
                    <dd>
                      {research.finalizedRecordStatus} / {research.recordCount} /{' '}
                      {research.invalidRecordCount}
                    </dd>
                  </div>
                  <div>
                    <dt>Research / feedback schemas</dt>
                    <dd>
                      {research.researchSchema} / {research.feedbackSchema}
                    </dd>
                  </div>
                  <div>
                    <dt>Research storage</dt>
                    <dd>
                      {research.storageSizeBytes} bytes / {research.activePersistenceKey}
                    </dd>
                  </div>
                  <div>
                    <dt>Model / shadow mode</dt>
                    <dd>
                      {SHADOW_MODEL_STATUS.availability} ({SHADOW_MODEL_STATUS.message}) /{' '}
                      {SHADOW_MODEL_STATUS.shadowMode}
                    </dd>
                  </div>
                  <div>
                    <dt>Reward telemetry</dt>
                    <dd>
                      cache {snapshot.reward.status}; Resonance {snapshot.player.resonance}; spawned{' '}
                      {String(snapshot.reward.spawned)}; awarded{' '}
                      {String(snapshot.reward.resonanceAwarded)}
                    </dd>
                  </div>
                  <div>
                    <dt>Reward condition independence</dt>
                    <dd>rewards-1 inputs exclude condition and profile</dd>
                  </div>
                  <div>
                    <dt>Write policy</dt>
                    <dd>
                      normal active {String(research.writePolicy.writeNormalActiveRun)}; research
                      active {String(research.writePolicy.writeResearchActiveRun)}; permanent
                      profile {String(research.writePolicy.writePermanentProfile)}; session profile{' '}
                      {String(research.writePolicy.writeResearchSessionProfile)}; normal history{' '}
                      {String(research.writePolicy.writeNormalHistory)}; research dataset{' '}
                      {String(research.writePolicy.writeResearchDataset)}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            <button type="button" className="playtest-diagnostics__copy" onClick={copySummary}>
              Copy Diagnostic Summary
            </button>
            <p className="playtest-diagnostics__copy-status" role="status" aria-live="polite">
              {copyStatus}
            </p>
          </div>
        </aside>
      )}
    </>
  );
}
