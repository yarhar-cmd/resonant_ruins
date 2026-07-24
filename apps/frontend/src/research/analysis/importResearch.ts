import { ResearchExportSchema } from '../schemas';
import type {
  ResearchExport,
  ResearchRun,
  ResearchSession,
  RoomResearchRecord,
} from '../../types/research';
import type {
  AnalysisConflict,
  AnalysisDataset,
  AnalysisImportAudit,
  ImportValidationFailure,
  ValidatedResearchSource,
} from './types';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function validationMessages(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): string[] {
  return error.issues.slice(0, 12).map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : 'export';
    return `${path}: ${issue.message}`;
  });
}

export function parseResearchExportText(
  filename: string,
  source: string,
): { source: ValidatedResearchSource | null; failure: ImportValidationFailure | null } {
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    return {
      source: null,
      failure: { filename, messages: ['File is not valid JSON.'] },
    };
  }
  const parsed = ResearchExportSchema.safeParse(value);
  if (!parsed.success) {
    return {
      source: null,
      failure: { filename, messages: validationMessages(parsed.error) },
    };
  }
  return {
    source: {
      filename,
      researchExport: parsed.data as ResearchExport,
    },
    failure: null,
  };
}

function withoutRooms(run: ResearchRun): Omit<ResearchRun, 'rooms'> {
  const { rooms, ...metadata } = run;
  void rooms;
  return metadata;
}

function withoutRuns(session: ResearchSession): Omit<ResearchSession, 'runs'> {
  const { runs, ...metadata } = session;
  void runs;
  return metadata;
}

function conflict(
  conflicts: AnalysisConflict[],
  kind: AnalysisConflict['kind'],
  durableId: string,
  message: string,
  sourceFilenames: string[],
) {
  const existing = conflicts.find((item) => item.kind === kind && item.durableId === durableId);
  if (existing) {
    existing.sourceFilenames = [
      ...new Set([...existing.sourceFilenames, ...sourceFilenames]),
    ].sort();
    return;
  }
  conflicts.push({
    kind,
    durableId,
    message,
    sourceFilenames: [...new Set(sourceFilenames)].sort(),
  });
}

interface MergeExclusions {
  runs: Set<string>;
  rooms: Set<string>;
}

function mergeRooms(
  accepted: RoomResearchRecord[],
  incoming: RoomResearchRecord[],
  sources: string[],
  incomingFilename: string,
  conflicts: AnalysisConflict[],
  audit: AnalysisImportAudit,
  exclusions: MergeExclusions,
): RoomResearchRecord[] {
  const rooms = new Map(accepted.map((room) => [room.roomDecisionId, room]));
  for (const room of incoming) {
    if (exclusions.rooms.has(room.roomDecisionId)) {
      conflict(
        conflicts,
        'room',
        room.roomDecisionId,
        'Another conflicting copy of this room was ignored.',
        [...sources, incomingFilename],
      );
      continue;
    }
    const existing = rooms.get(room.roomDecisionId);
    if (!existing) {
      rooms.set(room.roomDecisionId, room);
      continue;
    }
    if (canonical(existing) === canonical(room)) {
      audit.duplicateRooms += 1;
      continue;
    }
    exclusions.rooms.add(room.roomDecisionId);
    rooms.delete(room.roomDecisionId);
    conflict(
      conflicts,
      'room',
      room.roomDecisionId,
      'Conflicting roomDecisionId evidence was excluded from analysis.',
      [...sources, incomingFilename],
    );
  }
  return [...rooms.values()].filter((room) => !exclusions.rooms.has(room.roomDecisionId));
}

function mergeRuns(
  accepted: ResearchRun[],
  incoming: ResearchRun[],
  sources: string[],
  incomingFilename: string,
  conflicts: AnalysisConflict[],
  audit: AnalysisImportAudit,
  exclusions: MergeExclusions,
): ResearchRun[] {
  const runs = new Map(accepted.map((run) => [run.id, run]));
  for (const run of incoming) {
    if (exclusions.runs.has(run.id)) {
      conflict(conflicts, 'run', run.id, 'Another conflicting copy of this run was ignored.', [
        ...sources,
        incomingFilename,
      ]);
      continue;
    }
    const existing = runs.get(run.id);
    if (!existing) {
      runs.set(run.id, structuredClone(run));
      continue;
    }
    if (canonical(existing) === canonical(run)) {
      audit.duplicateRooms += run.rooms.length;
      continue;
    }
    if (canonical(withoutRooms(existing)) !== canonical(withoutRooms(run))) {
      exclusions.runs.add(run.id);
      runs.delete(run.id);
      conflict(conflicts, 'run', run.id, 'Conflicting run metadata was excluded from analysis.', [
        ...sources,
        incomingFilename,
      ]);
      continue;
    }
    runs.set(run.id, {
      ...existing,
      rooms: mergeRooms(
        existing.rooms,
        run.rooms,
        sources,
        incomingFilename,
        conflicts,
        audit,
        exclusions,
      ),
    });
  }
  return [...runs.values()].filter((run) => !exclusions.runs.has(run.id));
}

export function combineResearchSources(
  sources: ValidatedResearchSource[],
  validationFailures: ImportValidationFailure[] = [],
): AnalysisDataset {
  const audit: AnalysisImportAudit = {
    acceptedFiles: sources.length,
    rejectedFiles: validationFailures.length,
    acceptedSessions: 0,
    acceptedRuns: 0,
    acceptedRooms: 0,
    duplicateSessions: 0,
    duplicateRooms: 0,
    conflictingRecords: 0,
  };
  const sessions = new Map<string, ResearchSession>();
  const sourceNames = new Map<string, string[]>();
  const excludedSessions = new Set<string>();
  const mergeExclusions: MergeExclusions = {
    runs: new Set<string>(),
    rooms: new Set<string>(),
  };
  const conflicts: AnalysisConflict[] = [];

  for (const source of sources) {
    for (const session of source.researchExport.sessions) {
      if (excludedSessions.has(session.id)) {
        conflict(
          conflicts,
          'session',
          session.id,
          'Another conflicting copy of this session was ignored.',
          [...(sourceNames.get(session.id) ?? []), source.filename],
        );
        continue;
      }
      const existing = sessions.get(session.id);
      if (!existing) {
        sessions.set(session.id, structuredClone(session));
        sourceNames.set(session.id, [source.filename]);
        continue;
      }
      const existingSources = sourceNames.get(session.id) ?? [];
      if (canonical(existing) === canonical(session)) {
        audit.duplicateSessions += 1;
        audit.duplicateRooms += session.runs.reduce((sum, run) => sum + run.rooms.length, 0);
        sourceNames.set(session.id, [...new Set([...existingSources, source.filename])]);
        continue;
      }
      if (canonical(withoutRuns(existing)) !== canonical(withoutRuns(session))) {
        sessions.delete(session.id);
        excludedSessions.add(session.id);
        sourceNames.set(session.id, [...new Set([...existingSources, source.filename])]);
        conflict(
          conflicts,
          'session',
          session.id,
          'Conflicting session metadata was excluded from analysis.',
          [...existingSources, source.filename],
        );
        continue;
      }
      sessions.set(session.id, {
        ...existing,
        runs: mergeRuns(
          existing.runs,
          session.runs,
          existingSources,
          source.filename,
          conflicts,
          audit,
          mergeExclusions,
        ),
      });
      sourceNames.set(session.id, [...new Set([...existingSources, source.filename])]);
    }
  }

  const acceptedSessions = [...sessions.values()];
  audit.acceptedSessions = acceptedSessions.length;
  audit.acceptedRuns = acceptedSessions.reduce((sum, session) => sum + session.runs.length, 0);
  audit.acceptedRooms = acceptedSessions.reduce(
    (sum, session) => sum + session.runs.reduce((runSum, run) => runSum + run.rooms.length, 0),
    0,
  );
  audit.conflictingRecords = conflicts.length;

  return {
    sources,
    sessions: acceptedSessions,
    sourceFilenamesBySessionId: Object.fromEntries(sourceNames),
    conflicts,
    validationFailures,
    audit,
  };
}
