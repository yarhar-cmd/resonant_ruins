import { describe, expect, it } from 'vitest';
import {
  advanceRecentRatingAccumulator,
  createRecentRatingAccumulator,
  deriveRecentRatingFeatures,
} from './recentRatings';
import type { RoomResearchRecord } from '../types/research';

const feedback = (difficulty: 'too_easy' | 'about_right' | 'too_hard' | null) => ({
  feedback: {
    status: difficulty === null ? ('skipped' as const) : ('submitted' as const),
    difficulty,
  } as RoomResearchRecord['feedback'],
});

describe('recent rating features', () => {
  it('uses only prior submitted ratings and a last-three window', () => {
    let state = createRecentRatingAccumulator();
    expect(deriveRecentRatingFeatures(state)).toMatchObject({
      previousDifficultyRating: '__missing__',
      previousRatingAvailable: 0,
      ratedRoomsAvailableInWindow: 0,
    });

    for (const rating of ['too_easy', 'about_right', null, 'too_hard', 'about_right'] as const) {
      state = advanceRecentRatingAccumulator(state, feedback(rating));
    }

    expect(deriveRecentRatingFeatures(state)).toEqual({
      previousDifficultyRating: 'about_right',
      previousRatingAvailable: 1,
      aboutRightRateLast3RatedRooms: 2 / 3,
      tooEasyCountLast3RatedRooms: 0,
      tooHardCountLast3RatedRooms: 1,
      ratedRoomsAvailableInWindow: 3,
      roomsSinceLastSubmittedDifficultyRating: 0,
    });
  });

  it('counts skipped and defeat-unrated rooms since the last rating', () => {
    let state = advanceRecentRatingAccumulator(
      createRecentRatingAccumulator(),
      feedback('too_easy'),
    );
    state = advanceRecentRatingAccumulator(state, feedback(null));
    state = advanceRecentRatingAccumulator(state, feedback(null));
    expect(deriveRecentRatingFeatures(state).roomsSinceLastSubmittedDifficultyRating).toBe(2);
  });
});
