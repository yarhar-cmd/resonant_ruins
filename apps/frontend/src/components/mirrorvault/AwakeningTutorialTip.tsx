import { useEffect, useState } from 'react';
import type { GridPosition } from '../../types/player';
import type { RunMode } from '../../types/runMode';
import { getAwakeningTutorial, PERFECT_BLOCK_TUTORIAL } from '../../data/rooms/awakeningTutorial';

const MOVEMENT_TILES_BEFORE_DISMISSAL = 4;
const RUNE_SECTION_COMPLETION_COLUMN = 10;

function positionKey(position: GridPosition): string {
  return `${position.column},${position.row}`;
}

export function AwakeningTutorialTip({
  roomId,
  runMode,
  inGeneratedDungeon,
  playerPosition,
  fountainUsed,
  ratTelegraphing,
}: {
  roomId: string;
  runMode: RunMode;
  inGeneratedDungeon: boolean;
  playerPosition: GridPosition;
  fountainUsed: boolean;
  ratTelegraphing: boolean;
}) {
  const tutorial = getAwakeningTutorial(roomId, runMode, inGeneratedDungeon);
  const [dismissed, setDismissed] = useState(false);
  const [visitedTiles, setVisitedTiles] = useState(
    () => new Set<string>([positionKey(playerPosition)]),
  );
  const [perfectBlockTipShown, setPerfectBlockTipShown] = useState(false);

  useEffect(() => {
    const key = positionKey(playerPosition);
    setVisitedTiles((current) => {
      if (current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, [playerPosition]);

  useEffect(() => {
    if (tutorial?.kind === 'combat' && ratTelegraphing) setPerfectBlockTipShown(true);
  }, [ratTelegraphing, tutorial?.kind]);

  if (!tutorial || dismissed) return null;

  const completed =
    (tutorial.kind === 'movement' && visitedTiles.size >= MOVEMENT_TILES_BEFORE_DISMISSAL) ||
    (tutorial.kind === 'runes' && playerPosition.column >= RUNE_SECTION_COMPLETION_COLUMN) ||
    (tutorial.kind === 'fountain' && fountainUsed);
  if (completed) return null;

  const message =
    tutorial.kind === 'combat' && perfectBlockTipShown ? PERFECT_BLOCK_TUTORIAL : tutorial.message;

  return (
    <aside
      className={`awakening-tutorial awakening-tutorial--${tutorial.kind}`}
      data-awakening-tutorial={tutorial.kind}
      aria-label="Awakening Chamber tutorial"
    >
      <p
        className="awakening-tutorial__message"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span aria-hidden="true">Tip</span>
        {message}
      </p>
      <button
        className="awakening-tutorial__dismiss"
        type="button"
        aria-label="Dismiss tutorial tip"
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </aside>
  );
}
