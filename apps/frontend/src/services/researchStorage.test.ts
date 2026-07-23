import { beforeEach, describe, expect, it } from 'vitest';
import { RESEARCH_STORAGE_KEY, RESEARCH_STORAGE_WARNING_BYTES } from '../config/research';
import { researchFixture } from '../test/researchFixtures';
import { PLAYER_PROFILE_KEY } from './playerProfileStorage';
import { RUN_ARCHIVE_KEY } from './runArchive';
import {
  appendResearchRun,
  clearAllResearchData,
  createResearchRun,
  createResearchSession,
  deletePilotResearchData,
  deleteResearchSession,
  endResearchSession,
  finalizeRoomResearchRecord,
  loadResearchStorage,
  parseResearchStorage,
  researchStorageSize,
  saveResearchStorage,
  startResearchSession,
} from './researchStorage';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  failWrites = false;

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
    if (this.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    this.values.set(key, value);
  }
}

describe('research session storage', () => {
  beforeEach(() => localStorage.clear());

  it('requires valid opt-in input and stores Pilot and Official sessions separately', () => {
    expect(() =>
      createResearchSession({ pilot: false, participantCode: 'name with spaces' }),
    ).toThrow('Invalid participant code.');
    const pilot = startResearchSession({
      pilot: true,
      participantCode: '  PILOT_01  ',
      id: 'pilot-session',
      sessionSeed: 'pilot-seed',
      now: 1_000,
    });
    expect(pilot.issue).toBeNull();
    expect(pilot.session).toMatchObject({ pilot: true, participantCode: 'PILOT_01' });
    const official = startResearchSession({
      pilot: false,
      id: 'official-session',
      sessionSeed: 'official-seed',
      now: 2_000,
    });
    expect(official.issue).toBeNull();
    expect(loadResearchStorage().data.sessions).toHaveLength(2);
  });

  it('stores deterministic assigned runs and restores incomplete sessions', () => {
    const { session } = startResearchSession({
      pilot: false,
      id: 'session',
      sessionSeed: 'seed',
      now: 1_000,
    });
    const first = createResearchRun({
      session,
      characterId: 'warden',
      experiencePreset: 'seasoned-adventurer',
      id: 'run-1',
      now: 2_000,
    });
    expect(appendResearchRun(session.id, first)).toBeNull();
    const restored = loadResearchStorage().data.sessions[0]!;
    const second = createResearchRun({
      session: restored,
      characterId: 'warden',
      experiencePreset: 'seasoned-adventurer',
      id: 'run-2',
      now: 3_000,
    });
    expect(new Set([first.condition, second.condition])).toEqual(
      new Set(['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL']),
    );
    expect(appendResearchRun(session.id, second)).toBeNull();
    expect(appendResearchRun(session.id, second)).toBe('conflict');
    expect(loadResearchStorage().data.activeSessionId).toBe('session');
  });

  it('deletes only Pilot data and preserves Official and normal data', () => {
    localStorage.setItem(PLAYER_PROFILE_KEY, '{"normal":true}');
    localStorage.setItem(RUN_ARCHIVE_KEY, '{"normal":true}');
    startResearchSession({ pilot: true, id: 'pilot', sessionSeed: 'pilot' });
    startResearchSession({ pilot: false, id: 'official', sessionSeed: 'official' });
    expect(deletePilotResearchData()).toBeNull();
    expect(loadResearchStorage().data.sessions.map(({ id }) => id)).toEqual(['official']);
    expect(localStorage.getItem(PLAYER_PROFILE_KEY)).toBe('{"normal":true}');
    expect(localStorage.getItem(RUN_ARCHIVE_KEY)).toBe('{"normal":true}');
    expect(deleteResearchSession('official')).toBeNull();
    expect(loadResearchStorage().data.sessions).toEqual([]);
  });

  it('ends active work without inventing completion and supports research-only clear', () => {
    const { session } = startResearchSession({
      pilot: false,
      id: 'ending-session',
      sessionSeed: 'ending-seed',
      now: 1_000,
    });
    const run = createResearchRun({
      session,
      characterId: 'warden',
      experiencePreset: 'new-delver',
      id: 'active-run',
      now: 2_000,
    });
    appendResearchRun(session.id, run);
    expect(endResearchSession(session.id, 3_000)).toBeNull();
    expect(loadResearchStorage().data.sessions[0]).toMatchObject({
      status: 'ended',
      runs: [{ status: 'interrupted' }],
    });
    expect(researchStorageSize(loadResearchStorage().data)).toBeGreaterThan(0);
    expect(clearAllResearchData()).toBeNull();
    expect(localStorage.getItem(RESEARCH_STORAGE_KEY)).toBeNull();
  });

  it('rejects malformed versions and duplicate room identities', () => {
    expect(parseResearchStorage({ researchSchemaVersion: 'research-99', sessions: [] })).toBeNull();
    localStorage.setItem(RESEARCH_STORAGE_KEY, '{');
    expect(loadResearchStorage().issue).toBe('invalid');
  });

  it('treats a completed write under storage pressure as saved with a separate warning', () => {
    const storage = new MemoryStorage();
    const fixture = researchFixture();
    expect(
      saveResearchStorage(
        {
          researchSchemaVersion: 'research-1',
          activeSessionId: fixture.session.id,
          sessions: [fixture.session],
        },
        storage,
      ),
    ).toBeNull();
    const record = {
      ...fixture.record,
      explanationTokens: ['x'.repeat(RESEARCH_STORAGE_WARNING_BYTES)],
      feedback: {
        ...fixture.record.feedback,
        status: 'submitted' as const,
        difficulty: 'about_right' as const,
        submittedAt: '2026-01-01T00:00:12.000Z',
        responseDurationMs: 2_000,
      },
    };

    expect(finalizeRoomResearchRecord(record, storage)).toEqual({
      status: 'saved',
      issue: null,
      warning: 'storage-pressure',
      duplicate: false,
    });
    expect(loadResearchStorage(storage).data.sessions[0]!.runs[0]!.rooms).toHaveLength(1);
    expect(finalizeRoomResearchRecord(record, storage)).toEqual({
      status: 'identical-duplicate',
      issue: null,
      warning: null,
      duplicate: true,
    });
    expect(loadResearchStorage(storage).data.sessions[0]!.runs[0]!.rooms).toHaveLength(1);
  });

  it('reports a failed write separately from duplicates and storage warnings', () => {
    const storage = new MemoryStorage();
    const fixture = researchFixture();
    expect(
      saveResearchStorage(
        {
          researchSchemaVersion: 'research-1',
          activeSessionId: fixture.session.id,
          sessions: [fixture.session],
        },
        storage,
      ),
    ).toBeNull();
    storage.failWrites = true;
    expect(
      finalizeRoomResearchRecord(
        {
          ...fixture.record,
          feedback: {
            ...fixture.record.feedback,
            status: 'submitted',
            difficulty: 'about_right',
            submittedAt: '2026-01-01T00:00:12.000Z',
            responseDurationMs: 2_000,
          },
        },
        storage,
      ),
    ).toEqual({
      status: 'write-failed',
      issue: 'write-failed',
      warning: null,
      duplicate: false,
    });
    expect(loadResearchStorage(storage).data.sessions[0]!.runs[0]!.rooms).toHaveLength(0);
  });
});
