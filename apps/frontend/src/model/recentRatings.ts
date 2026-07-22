import { MODEL_RATING_HISTORY_WINDOW, type PreviousDifficultyRating } from './featureManifest';
import type { DifficultyRating, RoomResearchRecord } from '../types/research';

export interface RecentRatingFeatures {
  previousDifficultyRating: PreviousDifficultyRating;
  previousRatingAvailable: number;
  aboutRightRateLast3RatedRooms: number;
  tooEasyCountLast3RatedRooms: number;
  tooHardCountLast3RatedRooms: number;
  ratedRoomsAvailableInWindow: number;
  roomsSinceLastSubmittedDifficultyRating: number;
}

export interface RecentRatingAccumulator {
  submittedRatings: DifficultyRating[];
  roomsSinceLastSubmittedDifficultyRating: number;
}

export function createRecentRatingAccumulator(): RecentRatingAccumulator {
  return { submittedRatings: [], roomsSinceLastSubmittedDifficultyRating: 0 };
}

export function deriveRecentRatingFeatures(
  accumulator: RecentRatingAccumulator,
): RecentRatingFeatures {
  const window = accumulator.submittedRatings.slice(-MODEL_RATING_HISTORY_WINDOW);
  const count = (rating: DifficultyRating) => window.filter((value) => value === rating).length;
  const aboutRightCount = count('about_right');
  return {
    previousDifficultyRating: window.at(-1) ?? '__missing__',
    previousRatingAvailable: window.length > 0 ? 1 : 0,
    aboutRightRateLast3RatedRooms: window.length > 0 ? aboutRightCount / window.length : 0,
    tooEasyCountLast3RatedRooms: count('too_easy'),
    tooHardCountLast3RatedRooms: count('too_hard'),
    ratedRoomsAvailableInWindow: window.length,
    roomsSinceLastSubmittedDifficultyRating: accumulator.roomsSinceLastSubmittedDifficultyRating,
  };
}

export function advanceRecentRatingAccumulator(
  accumulator: RecentRatingAccumulator,
  record: Pick<RoomResearchRecord, 'feedback'>,
): RecentRatingAccumulator {
  if (record.feedback.status === 'submitted' && record.feedback.difficulty !== null) {
    return {
      submittedRatings: [...accumulator.submittedRatings, record.feedback.difficulty].slice(
        -MODEL_RATING_HISTORY_WINDOW,
      ),
      roomsSinceLastSubmittedDifficultyRating: 0,
    };
  }
  return {
    submittedRatings: [...accumulator.submittedRatings],
    roomsSinceLastSubmittedDifficultyRating:
      accumulator.roomsSinceLastSubmittedDifficultyRating + 1,
  };
}
