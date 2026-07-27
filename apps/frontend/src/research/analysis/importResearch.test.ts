import { describe, expect, it } from 'vitest';
import { createResearchExport, researchExportJson } from '../export';
import { combineResearchSources, parseResearchExportText } from './importResearch';
import { completeConditionSession } from './testFixtures';

function validSource(filename = 'participant.json') {
  const researchExport = createResearchExport(
    [
      completeConditionSession({
        id: 'session-1',
        participantCode: 'P001',
        condition: 'RULES_ADAPTIVE',
        difficulties: ['about_right'],
      }),
    ],
    'session',
    '2026-06-02T00:00:00.000Z',
  );
  return parseResearchExportText(filename, researchExportJson(researchExport));
}

describe('local research export import', () => {
  it('accepts canonical ResearchExport JSON and reports malformed input per filename', () => {
    const valid = validSource();
    const malformed = parseResearchExportText('broken.json', '{not-json');
    const wrongSchema = parseResearchExportText(
      'wrong-schema.json',
      JSON.stringify({ researchSchemaVersion: 'research-99' }),
    );

    expect(valid.source?.researchExport.sessions).toHaveLength(1);
    expect(valid.failure).toBeNull();
    expect(malformed.failure).toEqual({
      filename: 'broken.json',
      messages: ['File is not valid JSON.'],
    });
    expect(wrongSchema.failure?.filename).toBe('wrong-schema.json');
    expect(wrongSchema.failure?.messages.join(' ')).toContain('researchSchemaVersion');
  });

  it('accepts a canonical multi-session export without flattening its hierarchy', () => {
    const researchExport = createResearchExport(
      [
        completeConditionSession({
          id: 'session-1',
          participantCode: 'P001',
          condition: 'RULES_ADAPTIVE',
          difficulties: ['about_right'],
        }),
        completeConditionSession({
          id: 'session-2',
          participantCode: 'P002',
          condition: 'NEUTRAL_PROCEDURAL',
          difficulties: ['too_hard'],
        }),
      ],
      'all-sessions',
      '2026-06-02T00:00:00.000Z',
    );
    const parsed = parseResearchExportText('all-sessions.json', researchExportJson(researchExport));
    expect(parsed.source?.researchExport.sessions).toHaveLength(2);
    expect(combineResearchSources([parsed.source!]).audit).toMatchObject({
      acceptedSessions: 2,
      acceptedRuns: 2,
      acceptedRooms: 2,
    });
  });

  it('combines multiple files and deduplicates identical sessions and rooms', () => {
    const first = validSource('first.json').source!;
    const duplicate = validSource('duplicate.json').source!;
    const dataset = combineResearchSources([first, duplicate]);

    expect(dataset.sessions).toHaveLength(1);
    expect(dataset.audit).toMatchObject({
      acceptedFiles: 2,
      acceptedSessions: 1,
      acceptedRuns: 1,
      acceptedRooms: 1,
      duplicateSessions: 1,
      duplicateRuns: 0,
      duplicateRooms: 1,
      conflictingRecords: 0,
    });
    expect(dataset.sourceFilenamesBySessionId['session-1']).toEqual([
      'first.json',
      'duplicate.json',
    ]);
  });

  it('deduplicates run and room IDs across different imported sessions', () => {
    const first = validSource('first.json').source!;
    const duplicateRun = structuredClone(first);
    duplicateRun.filename = 'duplicate-run.json';
    duplicateRun.researchExport.sessions[0]!.id = 'session-2';
    const uniqueRunDuplicateRoom = structuredClone(first);
    uniqueRunDuplicateRoom.filename = 'duplicate-room.json';
    uniqueRunDuplicateRoom.researchExport.sessions[0]!.id = 'session-3';
    uniqueRunDuplicateRoom.researchExport.sessions[0]!.runs[0]!.id = 'unique-run';

    const dataset = combineResearchSources([first, duplicateRun, uniqueRunDuplicateRoom]);

    expect(dataset.audit).toMatchObject({
      acceptedSessions: 3,
      acceptedRuns: 2,
      acceptedRooms: 1,
      duplicateRuns: 1,
      duplicateRooms: 2,
      conflictingRecords: 0,
    });
  });

  it('excludes conflicting durable IDs instead of silently choosing one file', () => {
    const first = validSource('first.json').source!;
    const second = structuredClone(first);
    second.filename = 'changed.json';
    second.researchExport.sessions[0]!.runs[0]!.rooms[0]!.outcome.damageTaken += 1;
    const third = structuredClone(first);
    third.filename = 'third.json';
    const dataset = combineResearchSources([first, second, third]);

    expect(dataset.audit.acceptedRooms).toBe(0);
    expect(dataset.audit.conflictingRecords).toBe(1);
    expect(dataset.conflicts[0]).toMatchObject({
      kind: 'room',
      durableId: 'session-1-room-1',
      sourceFilenames: ['changed.json', 'first.json', 'third.json'],
    });
  });

  it('deduplicates identical room IDs while retaining unique rooms from another export', () => {
    const first = validSource('first.json').source!;
    const second = structuredClone(first);
    second.filename = 'extended.json';
    const uniqueRoom = structuredClone(second.researchExport.sessions[0]!.runs[0]!.rooms[0]!);
    uniqueRoom.roomDecisionId = 'session-1-room-2';
    uniqueRoom.roomId = 'room-session-1-room-2';
    second.researchExport.sessions[0]!.runs[0]!.rooms.push(uniqueRoom);
    const dataset = combineResearchSources([first, second]);

    expect(dataset.audit).toMatchObject({
      acceptedRooms: 2,
      duplicateRooms: 1,
      conflictingRecords: 0,
    });
  });

  it('keeps rejected-file details in the combined audit', () => {
    const source = validSource().source!;
    const dataset = combineResearchSources(
      [source],
      [{ filename: 'bad.json', messages: ['export: required'] }],
    );
    expect(dataset.audit).toMatchObject({ acceptedFiles: 1, rejectedFiles: 1 });
    expect(dataset.validationFailures[0]?.filename).toBe('bad.json');
  });
});
