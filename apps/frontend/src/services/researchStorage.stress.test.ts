import { beforeEach, describe, expect, it } from 'vitest';
import { createResearchExport, researchExportCsv, researchExportJson } from '../research/export';
import { researchFixture } from '../test/researchFixtures';
import { loadResearchStorage, saveResearchStorage } from './researchStorage';

describe('research storage and export stress verification', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips and exports 500 room records without eviction or identity loss', () => {
    const fixture = researchFixture();
    const sessions = Array.from({ length: 25 }, (_, sessionIndex) => {
      const sessionId = `stress-session-${sessionIndex}`;
      const runId = `stress-run-${sessionIndex}`;
      const rooms = Array.from({ length: 20 }, (_, roomIndex) => ({
        ...fixture.record,
        researchSessionId: sessionId,
        runId,
        roomDecisionId: `${sessionId}:${runId}:room-${roomIndex}`,
        roomId: `stress-room-${sessionIndex}-${roomIndex}`,
        roomSequence: roomIndex + 1,
        pilot: sessionIndex % 5 === 0,
      }));
      return {
        ...fixture.session,
        id: sessionId,
        pilot: sessionIndex % 5 === 0,
        participantCode: `STRESS_${sessionIndex}`,
        status: 'ended' as const,
        endedAt: '2026-01-02T00:00:00.000Z',
        runs: [
          {
            ...fixture.run,
            id: runId,
            pilot: sessionIndex % 5 === 0,
            status: 'completed' as const,
            endedAt: '2026-01-02T00:00:00.000Z',
            rooms,
          },
        ],
      };
    });
    const issue = saveResearchStorage({
      researchSchemaVersion: 'research-1',
      activeSessionId: null,
      sessions,
    });
    expect([null, 'storage-pressure']).toContain(issue);
    const restored = loadResearchStorage();
    expect(restored.issue).toBeNull();
    expect(restored.data.sessions).toHaveLength(25);
    expect(
      restored.data.sessions.flatMap((session) => session.runs.flatMap((run) => run.rooms)),
    ).toHaveLength(500);
    const exported = createResearchExport(
      restored.data.sessions,
      'all-sessions',
      '2026-01-03T00:00:00.000Z',
    );
    expect(researchExportJson(exported).length).toBeGreaterThan(100_000);
    expect(researchExportCsv(exported).split('\r\n')).toHaveLength(501);
  }, 60_000);
});
