import { z } from 'zod';

const CONDITIONS = ['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL'];

const ResearchAnalysisInputSchema = z
  .object({
    researchSchemaVersion: z.literal('research-1'),
    sessions: z.array(
      z
        .object({
          id: z.string().min(1),
          pilot: z.boolean(),
          participantCode: z.string().nullable().optional(),
          status: z.string(),
          runs: z.array(
            z
              .object({
                rooms: z.array(z.record(z.string(), z.unknown())),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough();

const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const rate = (count, total) => (total ? count / total : null);

function roomsFor(sessions) {
  return sessions.flatMap((session) =>
    session.runs.flatMap((run) => run.rooms.map((room) => ({ room, run, session }))),
  );
}

function summarizeRooms(entries) {
  const completed = entries.filter(({ room }) => room.outcome?.status === 'completed');
  const rated = entries.filter(
    ({ room }) => room.feedback?.status === 'submitted' && room.feedback.difficulty,
  );
  const difficultyCount = (value) =>
    rated.filter(({ room }) => room.feedback.difficulty === value).length;
  return {
    roomRecords: entries.length,
    ratedRooms: rated.length,
    aboutRightRate: rate(difficultyCount('about_right'), rated.length),
    tooEasyRate: rate(difficultyCount('too_easy'), rated.length),
    tooHardRate: rate(difficultyCount('too_hard'), rated.length),
    averageFairness: average(
      rated.flatMap(({ room }) =>
        Number.isFinite(room.feedback.fairness) ? [room.feedback.fairness] : [],
      ),
    ),
    averageEnjoyment: average(
      rated.flatMap(({ room }) =>
        Number.isFinite(room.feedback.enjoyment) ? [room.feedback.enjoyment] : [],
      ),
    ),
    completionRate: rate(completed.length, entries.length),
    averageDamage: average(
      entries.flatMap(({ room }) =>
        Number.isFinite(room.outcome?.damageTaken) ? [room.outcome.damageTaken] : [],
      ),
    ),
    averageRoomDurationMs: average(
      entries.flatMap(({ room }) =>
        Number.isFinite(room.outcome?.durationMs) ? [room.outcome.durationMs] : [],
      ),
    ),
  };
}

function grouped(entries, keyFor) {
  const groups = new Map();
  for (const entry of entries) {
    const key = keyFor(entry);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return Object.fromEntries([...groups].map(([key, values]) => [key, summarizeRooms(values)]));
}

export function validateResearchExport(value) {
  const parsed = ResearchAnalysisInputSchema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      `Input is not a valid research-1 JSON export: ${parsed.error.issues[0]?.message}`,
    );
  return parsed.data;
}

export function analyzeResearchExport(value, { includePilot = false } = {}) {
  const researchExport = validateResearchExport(value);
  const allSessions = researchExport.sessions;
  const sessions = allSessions.filter((session) => includePilot || !session.pilot);
  const entries = roomsFor(sessions);
  const allEntries = roomsFor(allSessions);
  const ids = allEntries.map(({ room }) => room.roomDecisionId).filter(Boolean);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  const malformedNumericValues = allEntries.reduce((count, { room }) => {
    const values = [
      room.outcome?.durationMs,
      room.outcome?.damageTaken,
      room.selectedRank,
      room.deterministicRoll,
    ];
    return count + values.filter((item) => item !== undefined && !Number.isFinite(item)).length;
  }, 0);
  const missingVersions = allEntries.filter(
    ({ room }) =>
      !room.gameVersion ||
      !room.generatorVersion ||
      !room.selectorVersion ||
      !room.feedbackSchemaVersion,
  ).length;
  const missingFeedback = entries.filter(
    ({ room }) => !room.feedback || room.feedback.status === 'pending',
  ).length;
  const counts = Object.fromEntries(
    CONDITIONS.map((condition) => [
      condition,
      entries.filter(({ room }) => room.condition === condition).length,
    ]),
  );
  const participantExposure = new Map();
  const participantSessions = new Map();
  for (const { session, room } of entries) {
    const key = session.participantCode ?? session.id;
    const set = participantExposure.get(key) ?? new Set();
    set.add(room.condition);
    participantExposure.set(key, set);
    if (session.participantCode) {
      const sessionsForCode = participantSessions.get(session.participantCode) ?? new Set();
      sessionsForCode.add(session.id);
      participantSessions.set(session.participantCode, sessionsForCode);
    }
  }
  const participantOrSession = Object.fromEntries(
    [...participantExposure].map(([key]) => {
      const values = entries.filter(
        ({ session }) => (session.participantCode ?? session.id) === key,
      );
      return [
        key,
        {
          roomCount: values.length,
          conditionExposure: [...new Set(values.map(({ room }) => room.condition))],
          aboutRightRate: summarizeRooms(values).aboutRightRate,
          missingFeedback: values.filter(
            ({ room }) => !room.feedback || room.feedback.status === 'pending',
          ).length,
        },
      ];
    }),
  );
  const runs = sessions.flatMap((session) => session.runs);
  const submitted = entries.filter(({ room }) => room.feedback?.status === 'submitted').length;
  const overallRoomSummary = summarizeRooms(entries);
  return {
    researchSchemaVersion: 'research-1',
    includePilot,
    overall: {
      sessions: sessions.length,
      runs: runs.length,
      generatedRoomRecords: entries.length,
      ratedRooms: overallRoomSummary.ratedRooms,
      skipRate: rate(entries.length - submitted, entries.length),
      aboutRightRate: overallRoomSummary.aboutRightRate,
      averageFairness: overallRoomSummary.averageFairness,
      averageEnjoyment: overallRoomSummary.averageEnjoyment,
    },
    byCondition: Object.fromEntries(
      CONDITIONS.map((condition) => [
        condition,
        summarizeRooms(entries.filter(({ room }) => room.condition === condition)),
      ]),
    ),
    byArchetype: grouped(entries, ({ room }) => room.archetype ?? 'missing'),
    byParticipantCodeOrSession: participantOrSession,
    dataQuality: {
      duplicateRoomDecisionIds: duplicateIds,
      malformedNumericValues,
      missingVersions,
      incompleteSessions: sessions.filter((session) => session.status !== 'ended').length,
      unevenConditionCounts: Math.abs(counts.RULES_ADAPTIVE - counts.NEUTRAL_PROCEDURAL),
      missingFeedback,
      pilotSessions: allSessions.filter((session) => session.pilot).length,
      pilotRoomRecords: allEntries.filter(({ session }) => session.pilot).length,
      participantSessionLeakageWarning: [...participantSessions.values()].some(
        (sessionIds) => sessionIds.size > 1,
      ),
      selectedCandidatesWithoutOutcomes: allEntries.filter(
        ({ room }) => room.selectedCandidateId && !room.outcome,
      ).length,
      outcomesWithoutFeedback: allEntries.filter(({ room }) => room.outcome && !room.feedback)
        .length,
    },
  };
}

const display = (value) =>
  value === null || value === undefined
    ? 'n/a'
    : typeof value === 'number'
      ? Number.isInteger(value)
        ? String(value)
        : value.toFixed(4)
      : String(value);

export function formatResearchAnalysis(summary) {
  const lines = [
    'Resonant Ruins Research Analysis',
    `Pilot data: ${summary.includePilot ? 'included' : 'excluded (default)'}`,
    '',
    'OVERALL',
    ...Object.entries(summary.overall).map(([key, value]) => `${key}: ${display(value)}`),
    '',
    'BY CONDITION',
  ];
  for (const [condition, values] of Object.entries(summary.byCondition)) {
    lines.push(
      condition,
      ...Object.entries(values).map(([key, value]) => `  ${key}: ${display(value)}`),
    );
  }
  lines.push('', 'BY ARCHETYPE');
  for (const [archetype, values] of Object.entries(summary.byArchetype))
    lines.push(
      archetype,
      ...Object.entries(values).map(([key, value]) => `  ${key}: ${display(value)}`),
    );
  lines.push('', 'BY PARTICIPANT CODE OR SESSION');
  for (const [key, values] of Object.entries(summary.byParticipantCodeOrSession))
    lines.push(
      key,
      ...Object.entries(values).map(
        ([name, value]) => `  ${name}: ${display(Array.isArray(value) ? value.join('|') : value)}`,
      ),
    );
  lines.push(
    '',
    'DATA QUALITY',
    ...Object.entries(summary.dataQuality).map(
      ([key, value]) => `${key}: ${display(Array.isArray(value) ? value.join('|') : value)}`,
    ),
  );
  lines.push(
    '',
    'Descriptive output only: no p-values, significance, causality, or winner declaration.',
  );
  return lines.join('\n');
}

export function researchAnalysisCsv(summary) {
  const rows = [['section', 'group', 'metric', 'value']];
  const add = (section, group, values) => {
    for (const [metric, value] of Object.entries(values))
      rows.push([section, group, metric, Array.isArray(value) ? value.join('|') : display(value)]);
  };
  add('overall', 'all', summary.overall);
  for (const [condition, values] of Object.entries(summary.byCondition))
    add('condition', condition, values);
  for (const [archetype, values] of Object.entries(summary.byArchetype))
    add('archetype', archetype, values);
  add('data_quality', 'all', summary.dataQuality);
  const safeCell = (cell) => {
    const text = String(cell);
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
  };
  return rows
    .map((row) => row.map((cell) => `"${safeCell(cell).replaceAll('"', '""')}"`).join(','))
    .join('\r\n');
}
