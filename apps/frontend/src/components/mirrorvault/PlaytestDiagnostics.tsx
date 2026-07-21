import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { GameplayState } from '../../utils/gameplayState';
import type { RoomDefinition } from '../../types/rooms';
import {
  formatDiagnosticTile,
  formatPlaytestDiagnosticSummary,
  selectPlaytestDiagnostics,
} from '../../utils/playtestDiagnostics';
import './PlaytestDiagnostics.css';

export function PlaytestDiagnostics({
  gameplay,
  room,
  isInvulnerable,
  now = Date.now(),
}: {
  gameplay: GameplayState;
  room: RoomDefinition;
  isInvulnerable: boolean;
  now?: number;
}) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyOpenRef = useRef(false);
  const snapshot = useMemo(
    () => selectPlaytestDiagnostics(gameplay, room, now, isInvulnerable),
    [gameplay, isInvulnerable, now, room],
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
      await navigator.clipboard.writeText(formatPlaytestDiagnosticSummary(snapshot));
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
              </dl>
            </section>

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
