import type { RunMode } from '../types/runMode';

export function shouldRequestResearchFeedback(input: {
  runMode: RunMode;
  roomPhase: 'evaluation' | 'dungeon';
  feedbackFinalized: boolean;
  pendingFeedback: boolean;
  livingEnemyCount: number;
  hasGeneratedSave: boolean;
  hasRoomStart: boolean;
  hasResearchContext: boolean;
}): boolean {
  return Boolean(
    input.runMode === 'research' &&
    input.roomPhase === 'dungeon' &&
    !input.feedbackFinalized &&
    !input.pendingFeedback &&
    input.livingEnemyCount === 0 &&
    input.hasGeneratedSave &&
    input.hasRoomStart &&
    input.hasResearchContext,
  );
}
