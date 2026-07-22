import { beforeEach, describe, expect, it } from 'vitest';
import { RoomResearchRecordSchema, PendingRoomFeedbackSchema } from './schemas';
import { buildRoomResearchRecord } from './roomRecord';
import { researchFixture } from '../test/researchFixtures';
import { finalizeRoomResearchRecord, saveResearchStorage } from '../services/researchStorage';

describe('room research records and exactly-once finalization', () => {
  beforeEach(() => localStorage.clear());

  it('captures compact selection evidence, outcome metrics, and pending identity', () => {
    const fixture = researchFixture();
    expect(RoomResearchRecordSchema.safeParse(fixture.record).success).toBe(true);
    expect(PendingRoomFeedbackSchema.safeParse(fixture.pending).success).toBe(true);
    expect(fixture.record).toMatchObject({
      researchSessionId: fixture.session.id,
      runId: fixture.run.id,
      roomDecisionId: fixture.roomStart.roomDecisionId,
      generatorVersion: 'generator-4',
      selectorProfileConsumed: fixture.run.condition === 'RULES_ADAPTIVE',
      outcome: { status: 'completed', damageTaken: 1, chosenExitId: expect.any(String) },
      feedback: { status: 'pending' },
    });
    expect(JSON.stringify(fixture.record)).not.toContain('"floorTiles":');
  });

  it('finalizes a matching room at most once and rejects contradictory duplicates', () => {
    const fixture = researchFixture();
    expect(
      saveResearchStorage({
        researchSchemaVersion: 'research-1',
        activeSessionId: fixture.session.id,
        sessions: [fixture.session],
      }),
    ).toBeNull();
    const finalized = {
      ...fixture.record,
      feedback: {
        ...fixture.record.feedback,
        status: 'submitted' as const,
        difficulty: 'about_right' as const,
        submittedAt: '2026-01-01T00:00:12.000Z',
        responseDurationMs: 2_000,
      },
    };
    expect(finalizeRoomResearchRecord(finalized)).toEqual({ issue: null, duplicate: false });
    expect(finalizeRoomResearchRecord(finalized)).toEqual({ issue: null, duplicate: true });
    expect(
      finalizeRoomResearchRecord({
        ...finalized,
        feedback: { ...finalized.feedback, difficulty: 'too_hard' },
      }),
    ).toEqual({ issue: 'conflict', duplicate: true });
  });

  it('records defeat without fabricating an exit or feedback', () => {
    const fixture = researchFixture();
    const defeated = buildRoomResearchRecord({
      session: fixture.session,
      run: fixture.run,
      condition: fixture.run.condition,
      gameplay: { ...fixture.gameplay, status: 'defeated' },
      generated: fixture.generated,
      roomStart: fixture.roomStart,
      profileAfter: fixture.gameplay.adaptation.currentRunProfile,
      status: 'defeated',
      capturedAt: '2026-01-01T00:00:15.000Z',
    });
    expect(defeated).toMatchObject({
      outcome: { status: 'defeated', chosenExitId: null, outgoingDirection: null },
      feedback: {
        status: 'not_requested_due_to_defeat',
        difficulty: null,
        notRequestedReason: 'defeat',
      },
    });
    expect(RoomResearchRecordSchema.safeParse(defeated).success).toBe(true);
  });
});
