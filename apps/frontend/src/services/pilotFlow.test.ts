import { describe, expect, it } from 'vitest';
import { researchFixture } from '../test/researchFixtures';
import {
  appendResearchRun,
  createResearchRun,
  endPilotIncomplete,
  finalizeRoomResearchRecord,
  loadResearchStorage,
  saveResearchStorage,
  startResearchSession,
  updatePilotProfile,
} from './researchStorage';
import { loadResearchActiveRun } from './researchActiveRunStorage';
import { pilotWriterState, startPilotRunA } from './pilotCoordinator';
import { NEUTRAL_ADAPTIVE_PROFILE } from './playerProfileStorage';
import type { RoomResearchRecord } from '../types/research';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function fixedPilot(storage: Storage, sequence = 1) {
  const { session } = startResearchSession(
    {
      pilot: true,
      participantCode: 'PILOT_1',
      participantSequence: sequence,
      experiencePreset: 'seasoned-adventurer',
      id: 'fixed-session',
      sessionSeed: 'fixed-seed',
      now: 1_000,
    },
    storage,
  );
  const run = createResearchRun({
    session,
    characterId: 'warden',
    experiencePreset: 'seasoned-adventurer',
    id: 'fixed-run-a',
    now: 2_000,
  });
  expect(appendResearchRun(session.id, run, storage)).toBeNull();
  return { session: loadResearchStorage(storage).data.sessions[0]!, run };
}

function pilotRecord(
  template: RoomResearchRecord,
  run: ReturnType<typeof fixedPilot>['run'],
  index: number,
  status: 'completed' | 'defeated' = 'completed',
): RoomResearchRecord {
  return {
    ...template,
    researchSessionId: 'fixed-session',
    runId: run.id,
    participantCode: 'PILOT_1',
    condition: run.condition,
    assignmentMethodId: 'pilot-sequence-alternation-1',
    protocolId: 'fixed-pilot-1',
    runLabel: 'Run A',
    conditionBlockIndex: 0,
    gameplayAttemptId: run.gameplayAttemptIds![0]!,
    gameplayAttemptIndex: 1,
    roomId: `room-${index}`,
    roomDecisionId: `decision-${index}`,
    roomSequence: index,
    roomOpportunityId: `${run.id}:opportunity:${index}`,
    roomOpportunityIndex: index,
    capturedAt: new Date(10_000 + index * 1_000).toISOString(),
    outcome: {
      ...template.outcome,
      status,
      chosenExitId: status === 'defeated' ? null : template.outcome.chosenExitId,
      outgoingDirection: status === 'defeated' ? null : template.outcome.outgoingDirection,
      healthAfter: status === 'defeated' ? 0 : template.outcome.healthAfter,
    },
    feedback: {
      ...template.feedback,
      status: 'skipped',
      difficulty: null,
      fullDialogSkipped: true,
      submittedAt: new Date(10_500 + index * 1_000).toISOString(),
    },
  };
}

describe('Pilot dataset coordination', () => {
  it('locks the Warden/preset and creates the shared baseline only after practice', () => {
    const storage = new MemoryStorage();
    const { session, run } = fixedPilot(storage);
    expect(session).toMatchObject({
      participantSequence: 1,
      hiddenConditionOrder: ['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL'],
      lockedCharacterId: 'warden',
      lockedExperiencePreset: 'seasoned-adventurer',
      sharedPracticeBaseline: null,
    });
    const baseline = { ...NEUTRAL_ADAPTIVE_PROFILE, pace: 0.71 };
    expect(updatePilotProfile(session.id, run.id, baseline, storage)).toBeNull();
    const afterPractice = loadResearchStorage(storage).data.sessions[0]!;
    expect(afterPractice.practiceChambersCompleted).toBe(5);
    expect(afterPractice.sharedPracticeBaseline).toEqual(baseline);
    expect(afterPractice.runs[0]!.startingProfile).toEqual(baseline);
  });

  it('counts defeated and skipped outcomes once and completes exactly at 10', () => {
    const storage = new MemoryStorage();
    const { run } = fixedPilot(storage);
    const template = researchFixture().record;
    for (let index = 1; index <= 10; index += 1) {
      const record = pilotRecord(template, run, index, index === 4 ? 'defeated' : 'completed');
      expect(finalizeRoomResearchRecord(record, storage).status).toBe('saved');
      expect(finalizeRoomResearchRecord(record, storage).status).toBe('identical-duplicate');
    }
    const saved = loadResearchStorage(storage).data.sessions[0]!.runs[0]!;
    expect(saved.rooms).toHaveLength(10);
    expect(saved.rooms[3]!.outcome).toMatchObject({
      status: 'defeated',
      chosenExitId: null,
      outgoingDirection: null,
    });
    expect(saved.status).toBe('completed');
    expect(finalizeRoomResearchRecord(pilotRecord(template, run, 11), storage)).toMatchObject({
      status: 'write-failed',
      issue: 'invalid',
    });
  });

  it('keeps legacy research-1 data readable', () => {
    const storage = new MemoryStorage();
    const legacy = researchFixture();
    expect(
      saveResearchStorage(
        {
          researchSchemaVersion: 'research-1',
          activeSessionId: legacy.session.id,
          sessions: [legacy.session],
        },
        storage,
      ),
    ).toBeNull();
    expect(loadResearchStorage(storage).data.sessions[0]!.protocolId).toBeUndefined();
  });

  it('starts both conditions from the same saved baseline', () => {
    const storage = new MemoryStorage();
    const { session, run } = fixedPilot(storage);
    const baseline = { ...NEUTRAL_ADAPTIVE_PROFILE, exploration: 0.77 };
    expect(updatePilotProfile(session.id, run.id, baseline, storage)).toBeNull();
    const template = researchFixture().record;
    for (let index = 1; index <= 10; index += 1) {
      const record = pilotRecord(template, run, index);
      record.profileAfter = { ...baseline, aggression: 0.91 };
      expect(finalizeRoomResearchRecord(record, storage).status).toBe('saved');
    }
    const afterRunA = loadResearchStorage(storage).data.sessions[0]!;
    const runB = createResearchRun({
      session: afterRunA,
      characterId: 'warden',
      experiencePreset: 'seasoned-adventurer',
      id: 'fixed-run-b',
    });
    expect(afterRunA.sharedPracticeBaseline).toEqual(baseline);
    expect(runB.startingProfile).toEqual(baseline);
    expect(runB.conditionProfile).toEqual(baseline);
    expect(runB.condition).not.toBe(run.condition);
  });

  it('keeps incomplete termination distinct from completion', () => {
    const storage = new MemoryStorage();
    const { session } = fixedPilot(storage);
    expect(endPilotIncomplete(session.id, 'participant_withdrew', 9_000, storage)).toBeNull();
    expect(loadResearchStorage(storage).data.sessions[0]).toMatchObject({
      completionStatus: 'incomplete',
      completedAt: null,
      incompleteReason: 'participant_withdrew',
      participantPhase: 'session_incomplete',
    });
  });

  it('gives the first tab writer ownership and makes another tab read-only', () => {
    const storage = new MemoryStorage();
    const firstTab = new MemoryStorage();
    const secondTab = new MemoryStorage();
    const { session } = startResearchSession(
      {
        pilot: true,
        participantSequence: 1,
        experiencePreset: 'new-delver',
        id: 'writer-session',
      },
      storage,
    );
    expect(startPilotRunA(session, storage, firstTab)).toBeNull();
    const active = loadResearchActiveRun(storage).record!;
    expect(pilotWriterState(active, firstTab)).toBe('writer');
    expect(pilotWriterState(active, secondTab)).toBe('read-only');
  });
});
