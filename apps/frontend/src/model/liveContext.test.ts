import { describe, expect, it } from 'vitest';
import { researchFixture } from '../test/researchFixtures';
import { deriveLiveModelPreRoomContext } from './liveContext';

describe('live model pre-room context', () => {
  it('uses finalized prior rooms and the explicit profileForRoom only', () => {
    const fixture = researchFixture();
    const prior = {
      ...fixture.record,
      feedback: {
        ...fixture.record.feedback,
        status: 'submitted' as const,
        difficulty: 'too_hard' as const,
      },
      profileAfter: { ...fixture.record.profileAfter, pace: 0.99 },
    };
    const session = {
      ...fixture.session,
      runs: [{ ...fixture.run, rooms: [prior] }],
    };
    const profileForRoom = {
      pace: 0.2,
      caution: 0.3,
      aggression: 0.4,
      hazardTolerance: 0.5,
      exploration: 0.6,
    };
    const context = deriveLiveModelPreRoomContext({
      session,
      profileForRoom,
      healthBefore: 4,
      maximumHealth: 6,
      recentDamage: 2,
      experiencePreset: 'seasoned-adventurer',
      incomingEntranceDirection: 'east',
    });
    expect(context.profileForRoom).toEqual(profileForRoom);
    expect(context.profileForRoom.pace).not.toBe(prior.profileAfter.pace);
    expect(context.recentRatings.previousDifficultyRating).toBe('too_hard');
    expect(context.roomsCompletedInSession).toBe(1);
  });
});
