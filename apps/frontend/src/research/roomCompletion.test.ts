import { describe, expect, it } from 'vitest';
import { shouldRequestResearchFeedback } from './roomCompletion';

const completedGeneratedRoom = {
  runMode: 'research' as const,
  roomPhase: 'dungeon' as const,
  feedbackFinalized: false,
  pendingFeedback: false,
  livingEnemyCount: 0,
  hasGeneratedSave: true,
  hasRoomStart: true,
  hasResearchContext: true,
};

describe('research room completion gate', () => {
  it('pauses only a completed generated research room before finalization', () => {
    expect(shouldRequestResearchFeedback(completedGeneratedRoom)).toBe(true);
    expect(
      shouldRequestResearchFeedback({ ...completedGeneratedRoom, roomPhase: 'evaluation' }),
    ).toBe(false);
    expect(shouldRequestResearchFeedback({ ...completedGeneratedRoom, runMode: 'normal' })).toBe(
      false,
    );
    expect(shouldRequestResearchFeedback({ ...completedGeneratedRoom, runMode: 'sandbox' })).toBe(
      false,
    );
  });

  it('does not request feedback during combat, twice, or after finalization', () => {
    expect(shouldRequestResearchFeedback({ ...completedGeneratedRoom, livingEnemyCount: 1 })).toBe(
      false,
    );
    expect(
      shouldRequestResearchFeedback({ ...completedGeneratedRoom, pendingFeedback: true }),
    ).toBe(false);
    expect(
      shouldRequestResearchFeedback({ ...completedGeneratedRoom, feedbackFinalized: true }),
    ).toBe(false);
  });
});
