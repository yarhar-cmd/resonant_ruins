import { beforeEach, describe, expect, it } from 'vitest';
import { RoomResearchRecordSchema, PendingRoomFeedbackSchema } from './schemas';
import { buildRoomResearchRecord } from './roomRecord';
import { researchFixture } from '../test/researchFixtures';
import { finalizeRoomResearchRecord, saveResearchStorage } from '../services/researchStorage';
import { applyRewardLayer } from '../utils/rewardGeneration';
import { createInteractableRuntimeStates, getResonanceCaches } from '../utils/interactions';

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

  it('records rewards-1 spawn, encounter, opening, Resonance, and cancellation telemetry', () => {
    const fixture = researchFixture({ rewardOverride: 'force' });
    const cache = getResonanceCaches(fixture.generated.roomSnapshot)[0];
    expect(cache).toBeDefined();
    if (!cache) throw new Error('Forced research Cache fixture did not spawn.');
    const interactables = createInteractableRuntimeStates(fixture.generated.roomSnapshot);
    interactables[cache.id] = {
      ...interactables[cache.id]!,
      depleted: true,
      encounteredAt: 6_000,
      usedAt: 6_400,
      healthWhenUsed: 5,
      resonanceAwarded: true,
      cancellationReasons: ['movement'],
    };
    const record = buildRoomResearchRecord({
      session: fixture.session,
      run: fixture.run,
      condition: fixture.run.condition,
      gameplay: { ...fixture.gameplay, resonance: 1, interactables },
      generated: fixture.generated,
      roomStart: { ...fixture.roomStart, resonanceBefore: 0 },
      profileAfter: fixture.gameplay.adaptation.currentRunProfile,
      status: 'completed',
      exit: fixture.generated.roomSnapshot.exits[0],
      capturedAt: '2026-01-01T00:00:10.000Z',
    });

    expect(record).toMatchObject({
      rewardSystemVersion: 'rewards-1',
      cacheEligible: true,
      cacheSpawned: true,
      cacheSpawnReason: 'sandbox-forced',
      cacheCoordinate: cache.tile,
      outcome: {
        cacheEncountered: true,
        cacheOpened: true,
        cacheSkipped: false,
        healthWhenCacheOpened: 5,
        resonanceBefore: 0,
        resonanceAfter: 1,
        resonanceEarned: 1,
        cacheChannelCancellationReasons: ['movement'],
      },
    });
    expect(RoomResearchRecordSchema.safeParse(record).success).toBe(true);
  });

  it('uses identical post-selection reward outcomes across condition/profile-only changes', () => {
    const fixture = researchFixture({ rewardOverride: 'force' });
    const selectedRoom = {
      ...fixture.generated,
      roomSnapshot: {
        ...fixture.generated.roomSnapshot,
        features: fixture.generated.roomSnapshot.features?.filter(
          (feature) => feature.kind !== 'resonance-cache',
        ),
      },
      details: { ...fixture.generated.details, rewardDecision: undefined },
    };
    const rules = applyRewardLayer(selectedRoom, { override: 'force' });
    const neutral = applyRewardLayer(
      {
        ...selectedRoom,
        details: {
          ...selectedRoom.details,
          selectorId: 'neutral-procedural',
          selectorProfileConsumed: false,
        },
      },
      { override: 'force' },
    );
    expect(neutral.details.rewardDecision).toEqual(rules.details.rewardDecision);
    expect(getResonanceCaches(neutral.roomSnapshot)).toEqual(
      getResonanceCaches(rules.roomSnapshot),
    );
  });

  it('keeps rewards optional so pre-rewards research-1 records remain valid', () => {
    const fixture = researchFixture();
    const legacy = structuredClone(fixture.record) as unknown as Record<string, unknown>;
    delete legacy.rewardSystemVersion;
    delete legacy.cacheEligible;
    delete legacy.eligiblePlacementCount;
    delete legacy.cacheSpawnRoll;
    delete legacy.cacheSpawned;
    delete legacy.cacheSpawnReason;
    delete legacy.cacheCoordinate;
    delete legacy.cachePlacementCategory;
    delete legacy.cacheOptionalRouteScore;
    delete legacy.cacheInteractionTileCount;
    if (typeof legacy.outcome === 'object' && legacy.outcome) {
      for (const key of [
        'cacheEncountered',
        'cacheOpened',
        'cacheSkipped',
        'timeFromRoomStartToOpeningMs',
        'healthWhenCacheOpened',
        'resonanceBefore',
        'resonanceAfter',
        'resonanceEarned',
        'cacheChannelCancellationReasons',
      ])
        delete (legacy.outcome as Record<string, unknown>)[key];
    }
    expect(RoomResearchRecordSchema.safeParse(legacy).success).toBe(true);
  });
});
