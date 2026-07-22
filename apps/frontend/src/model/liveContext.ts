import type { AdaptiveProfile, ExperiencePreset } from '../types/adaptation';
import type { ExitDirection } from '../types/rooms';
import type { ResearchSession, RoomResearchRecord } from '../types/research';
import type { ModelPreRoomContext } from './featureBuilder';
import {
  advanceRecentRatingAccumulator,
  createRecentRatingAccumulator,
  deriveRecentRatingFeatures,
} from './recentRatings';

function orderedSessionRecords(session: ResearchSession): RoomResearchRecord[] {
  return session.runs
    .flatMap((run) => run.rooms.map((record) => ({ runIndex: run.runIndex, record })))
    .sort(
      (left, right) =>
        left.runIndex - right.runIndex ||
        left.record.roomSequence - right.record.roomSequence ||
        left.record.capturedAt.localeCompare(right.record.capturedAt) ||
        left.record.roomDecisionId.localeCompare(right.record.roomDecisionId),
    )
    .map(({ record }) => record);
}

export function deriveLiveModelPreRoomContext(input: {
  session: ResearchSession;
  profileForRoom: AdaptiveProfile;
  healthBefore: number;
  maximumHealth: number;
  recentDamage: number;
  experiencePreset: ExperiencePreset;
  incomingEntranceDirection: ExitDirection;
}): ModelPreRoomContext {
  const ratingHistory = createRecentRatingAccumulator();
  const durations: number[] = [];
  let roomsCompletedInSession = 0;
  for (const record of orderedSessionRecords(input.session)) {
    if (record.outcome.status === 'completed') {
      durations.push(record.outcome.durationMs);
      roomsCompletedInSession += 1;
    }
    const advanced = advanceRecentRatingAccumulator(ratingHistory, record);
    ratingHistory.submittedRatings = advanced.submittedRatings;
    ratingHistory.roomsSinceLastSubmittedDifficultyRating =
      advanced.roomsSinceLastSubmittedDifficultyRating;
  }
  const recentDurations = durations.slice(-3);
  return {
    profileForRoom: { ...input.profileForRoom },
    healthBefore: input.healthBefore,
    maximumHealth: input.maximumHealth,
    recentDamage: input.recentDamage,
    recentAverageRoomDuration:
      recentDurations.length > 0
        ? recentDurations.reduce((sum, value) => sum + value, 0) / recentDurations.length
        : 0,
    recentDurationRoomCount: recentDurations.length,
    roomsCompletedInSession,
    experiencePreset: input.experiencePreset,
    incomingEntranceDirection: input.incomingEntranceDirection,
    recentRatings: deriveRecentRatingFeatures(ratingHistory),
  };
}
