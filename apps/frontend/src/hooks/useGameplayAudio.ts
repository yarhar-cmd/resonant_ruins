import { useEffect, useRef } from 'react';
import type { GameplayState } from '../utils/gameplayState';
import {
  deriveGameplayAudioEvents,
  type GameplayAudioSnapshot,
} from '../utils/gameplayAudioEvents';
import { useAudio } from './useAudio';

export function useGameplayAudio(gameplay: GameplayState, roomId: string): void {
  const { emit, resetTransientEffects } = useAudio();
  const previousRef = useRef<GameplayAudioSnapshot | null>(null);

  useEffect(() => {
    const next = { gameplay, roomId };
    if (
      previousRef.current?.gameplay.runStats.runId &&
      previousRef.current.gameplay.runStats.runId !== gameplay.runStats.runId
    )
      resetTransientEffects();
    for (const event of deriveGameplayAudioEvents(previousRef.current, next)) emit(event);
    previousRef.current = next;
  }, [emit, gameplay, resetTransientEffects, roomId]);
}
