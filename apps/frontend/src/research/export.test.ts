import { describe, expect, it } from 'vitest';
import { researchFixture } from '../test/researchFixtures';
import { ResearchExportSchema } from './schemas';
import {
  createResearchExport,
  RESEARCH_CSV_COLUMNS,
  researchExportCsv,
  researchExportFilename,
  researchExportJson,
} from './export';

function exportFixture(forceCache = false) {
  const fixture = researchFixture(forceCache ? { rewardOverride: 'force' } : undefined);
  fixture.record.feedback = {
    ...fixture.record.feedback,
    status: 'submitted',
    difficulty: 'about_right',
    fairness: 4,
    enjoyment: 5,
    submittedAt: '2026-01-01T00:00:11.000Z',
    responseDurationMs: 1_000,
  };
  fixture.record.roomId = '=FORMULA()';
  fixture.run.rooms = [fixture.record];
  fixture.session.runs = [fixture.run];
  return createResearchExport([fixture.session], 'session', '2026-01-02T00:00:00.000Z');
}

describe('research JSON and CSV export', () => {
  it('validates and preserves the session-run-room JSON hierarchy', () => {
    const researchExport = exportFixture();
    expect(ResearchExportSchema.safeParse(researchExport).success).toBe(true);
    const parsed = JSON.parse(researchExportJson(researchExport));
    expect(parsed.sessions[0].runs[0].rooms).toHaveLength(1);
    expect(parsed.sessions[0].pilot).toBe(false);
  });

  it('emits stable RFC 4180 columns, one room per row, and no object coercion', () => {
    const csv = researchExportCsv(exportFixture());
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(RESEARCH_CSV_COLUMNS.join(','));
    expect(csv).not.toContain('[object Object]');
    expect(csv).toContain('"[{""id""');
    expect(csv).toContain("'=FORMULA()");
    expect(csv).toContain(',false,');
  });

  it('exports the stable 103-column rewards-1 extension without changing research-1', () => {
    const csv = researchExportCsv(exportFixture(true));
    expect(RESEARCH_CSV_COLUMNS).toHaveLength(103);
    expect(RESEARCH_CSV_COLUMNS).toContain('reward_system_version');
    expect(RESEARCH_CSV_COLUMNS).toContain('cache_channel_cancellation_reasons_json');
    expect(csv).toContain('rewards-1');
    expect(csv).toContain('sandbox-forced');
  });

  it('excludes participant code from sanitized filenames', () => {
    const filename = researchExportFilename({
      format: 'csv',
      exportedAt: '2026-01-02T00:00:00.000Z',
      sessionId: '../session:01',
    });
    expect(filename).toBe('resonant-ruins-research-2026-01-02-session-___session_01.csv');
    expect(filename).not.toContain('TEST_01');
  });

  it('rejects malformed partial data instead of exporting it silently', () => {
    const malformed = { ...exportFixture(), researchSchemaVersion: 'research-99' };
    expect(() => researchExportJson(malformed as never)).toThrow('failed export validation');
    expect(() => researchExportCsv(malformed as never)).toThrow('failed export validation');
  });
});
