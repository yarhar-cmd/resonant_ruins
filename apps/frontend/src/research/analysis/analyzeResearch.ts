import type {
  PilotRunLabel,
  ResearchCondition,
  ResearchRun,
  ResearchSession,
  RoomResearchRecord,
} from '../../types/research';
import type {
  AnalysisFilters,
  ConditionAnalysisSummary,
  PairedAnalysis,
  ParticipantConditionSummary,
  ParticipantRateAggregate,
  PilotQuestionnaireSummary,
  ResearchAnalysis,
} from './types';

const CONDITIONS: ResearchCondition[] = ['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL'];
const RUN_LABELS: PilotRunLabel[] = ['Run A', 'Run B'];

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator ? numerator / denominator : null;
}

export function participantKey(session: ResearchSession): string {
  return session.participantCode?.trim() || `session:${session.id}`;
}

export function sessionIsComplete(session: ResearchSession): boolean {
  if (session.protocolId === 'fixed-pilot-1') return session.completionStatus === 'complete';
  return (
    session.status === 'ended' &&
    session.runs.length > 0 &&
    session.runs.every((run) => run.status === 'completed')
  );
}

export function sessionConditionOrder(
  session: ResearchSession,
): 'adaptive-first' | 'neutral-first' | null {
  const first = session.hiddenConditionOrder?.[0];
  if (first === 'RULES_ADAPTIVE') return 'adaptive-first';
  if (first === 'NEUTRAL_PROCEDURAL') return 'neutral-first';
  if (session.participantSequence)
    return session.participantSequence % 2 === 1 ? 'adaptive-first' : 'neutral-first';
  return null;
}

function dateIncluded(timestamp: string, from: string, to: string): boolean {
  const date = timestamp.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

export function filterResearchSessions(
  sessions: readonly ResearchSession[],
  filters: AnalysisFilters,
): ResearchSession[] {
  return sessions.flatMap((session) => {
    if (filters.pilot === 'official' && session.pilot) return [];
    if (filters.pilot === 'pilot' && !session.pilot) return [];
    if (filters.completion === 'complete' && !sessionIsComplete(session)) return [];
    if (filters.completion === 'incomplete' && sessionIsComplete(session)) return [];
    if (
      filters.participantSequence !== null &&
      session.participantSequence !== filters.participantSequence
    )
      return [];
    const order = sessionConditionOrder(session);
    if (filters.order !== 'all' && order !== filters.order) return [];
    if (!dateIncluded(session.startedAt, filters.dateFrom, filters.dateTo)) return [];
    if (
      filters.preset !== 'all' &&
      session.lockedExperiencePreset !== filters.preset &&
      !session.runs.some((run) => run.experiencePreset === filters.preset)
    )
      return [];

    const runs = session.runs.flatMap((run) => {
      if (filters.condition !== 'all' && run.condition !== filters.condition) return [];
      if (filters.preset !== 'all' && run.experiencePreset !== filters.preset) return [];
      const rooms = run.rooms.filter(
        (room) =>
          (filters.gameVersion === 'all' || room.gameVersion === filters.gameVersion) &&
          (filters.generatorVersion === 'all' ||
            room.generatorVersion === filters.generatorVersion),
      );
      if (
        (filters.gameVersion !== 'all' || filters.generatorVersion !== 'all') &&
        rooms.length === 0
      )
        return [];
      return [{ ...run, rooms }];
    });
    if (filters.condition !== 'all' && runs.length === 0) return [];
    if ((filters.gameVersion !== 'all' || filters.generatorVersion !== 'all') && runs.length === 0)
      return [];
    return [{ ...session, runs }];
  });
}

interface RoomMetrics {
  roomCount: number;
  aboutRightCount: number;
  validSubmittedDifficultyCount: number;
  aboutRightRate: number | null;
  tooEasyCount: number;
  tooHardCount: number;
  meanFairness: number | null;
  meanEnjoyment: number | null;
  fairnessMissingCount: number;
  enjoymentMissingCount: number;
  explicitFullSkipCount: number;
  explicitFullSkipRate: number | null;
  defeatedRoomCount: number;
  defeatedRoomRate: number | null;
  completedRoomCount: number;
  completedRoomRate: number | null;
  averageDamageTaken: number | null;
  averageRoomDurationMs: number | null;
  averageFeedbackResponseDurationMs: number | null;
}

function roomMetrics(rooms: readonly RoomResearchRecord[]): RoomMetrics {
  const submitted = rooms.filter(
    (room) => room.feedback.status === 'submitted' && room.feedback.difficulty !== null,
  );
  const aboutRightCount = submitted.filter(
    (room) => room.feedback.difficulty === 'about_right',
  ).length;
  const explicitFullSkipCount = rooms.filter(
    (room) => room.feedback.status === 'skipped' && room.feedback.fullDialogSkipped,
  ).length;
  const defeatedRoomCount = rooms.filter((room) => room.outcome.status === 'defeated').length;
  const completedRoomCount = rooms.filter((room) => room.outcome.status === 'completed').length;
  return {
    roomCount: rooms.length,
    aboutRightCount,
    validSubmittedDifficultyCount: submitted.length,
    aboutRightRate: rate(aboutRightCount, submitted.length),
    tooEasyCount: submitted.filter((room) => room.feedback.difficulty === 'too_easy').length,
    tooHardCount: submitted.filter((room) => room.feedback.difficulty === 'too_hard').length,
    meanFairness: average(
      submitted.flatMap((room) =>
        room.feedback.fairness === null ? [] : [room.feedback.fairness],
      ),
    ),
    meanEnjoyment: average(
      submitted.flatMap((room) =>
        room.feedback.enjoyment === null ? [] : [room.feedback.enjoyment],
      ),
    ),
    fairnessMissingCount: submitted.filter((room) => room.feedback.fairness === null).length,
    enjoymentMissingCount: submitted.filter((room) => room.feedback.enjoyment === null).length,
    explicitFullSkipCount,
    explicitFullSkipRate: rate(explicitFullSkipCount, rooms.length),
    defeatedRoomCount,
    defeatedRoomRate: rate(defeatedRoomCount, rooms.length),
    completedRoomCount,
    completedRoomRate: rate(completedRoomCount, rooms.length),
    averageDamageTaken: average(rooms.map((room) => room.outcome.damageTaken)),
    averageRoomDurationMs: average(rooms.map((room) => room.outcome.durationMs)),
    averageFeedbackResponseDurationMs: average(
      submitted.flatMap((room) =>
        room.feedback.responseDurationMs === null ? [] : [room.feedback.responseDurationMs],
      ),
    ),
  };
}

interface ParticipantConditionAccumulator {
  participantKey: string;
  participantCode: string | null;
  condition: ResearchCondition;
  sessions: Set<string>;
  runs: ResearchRun[];
  rooms: RoomResearchRecord[];
}

function conditionRunComplete(run: ResearchRun): boolean {
  return (
    run.status === 'completed' && (run.protocolId !== 'fixed-pilot-1' || run.rooms.length === 10)
  );
}

export function createParticipantConditionSummaries(
  sessions: readonly ResearchSession[],
): ParticipantConditionSummary[] {
  const groups = new Map<string, ParticipantConditionAccumulator>();
  for (const session of sessions) {
    const key = participantKey(session);
    for (const run of session.runs) {
      const groupKey = `${key}|${run.condition}`;
      const group = groups.get(groupKey) ?? {
        participantKey: key,
        participantCode: session.participantCode,
        condition: run.condition,
        sessions: new Set<string>(),
        runs: [],
        rooms: [],
      };
      group.sessions.add(session.id);
      group.runs.push(run);
      group.rooms.push(...run.rooms);
      groups.set(groupKey, group);
    }
  }
  return [...groups.values()]
    .map((group) => ({
      participantKey: group.participantKey,
      participantCode: group.participantCode,
      condition: group.condition,
      sessionIds: [...group.sessions].sort(),
      sessionCount: group.sessions.size,
      conditionComplete:
        group.runs.length > 0 && group.runs.every((run) => conditionRunComplete(run)),
      ...roomMetrics(group.rooms),
    }))
    .sort(
      (left, right) =>
        left.participantKey.localeCompare(right.participantKey) ||
        left.condition.localeCompare(right.condition),
    );
}

function participantAggregate(
  key: string,
  label: string,
  participantMetrics: { participantKey: string; metrics: RoomMetrics }[],
): ParticipantRateAggregate {
  const rates = participantMetrics.flatMap(({ metrics }) =>
    metrics.aboutRightRate === null ? [] : [metrics.aboutRightRate],
  );
  const aboutRightCount = participantMetrics.reduce(
    (sum, item) => sum + item.metrics.aboutRightCount,
    0,
  );
  const validSubmittedDifficultyCount = participantMetrics.reduce(
    (sum, item) => sum + item.metrics.validSubmittedDifficultyCount,
    0,
  );
  return {
    key,
    label,
    participantCount: new Set(participantMetrics.map((item) => item.participantKey)).size,
    analyzableParticipantCount: rates.length,
    aboutRightCount,
    validSubmittedDifficultyCount,
    pooledAboutRightRate: rate(aboutRightCount, validSubmittedDifficultyCount),
    meanParticipantAboutRightRate: average(rates),
    medianParticipantAboutRightRate: median(rates),
  };
}

function conditionSummary(
  condition: ResearchCondition,
  rows: ParticipantConditionSummary[],
  sessions: readonly ResearchSession[],
): ConditionAnalysisSummary {
  const matchingRows = rows.filter((row) => row.condition === condition);
  const rooms = sessions.flatMap((session) =>
    session.runs.filter((run) => run.condition === condition).flatMap((run) => run.rooms),
  );
  const metrics = roomMetrics(rooms);
  return {
    ...participantAggregate(
      condition,
      condition === 'RULES_ADAPTIVE' ? 'Adaptive' : 'Neutral',
      matchingRows.map((row) => ({
        participantKey: row.participantKey,
        metrics: row,
      })),
    ),
    condition,
    tooEasyCount: metrics.tooEasyCount,
    tooHardCount: metrics.tooHardCount,
    meanFairness: metrics.meanFairness,
    meanEnjoyment: metrics.meanEnjoyment,
    fairnessMissingCount: metrics.fairnessMissingCount,
    enjoymentMissingCount: metrics.enjoymentMissingCount,
    explicitFullSkipRate: metrics.explicitFullSkipRate,
    defeatedRoomRate: metrics.defeatedRoomRate,
    completedRoomRate: metrics.completedRoomRate,
    averageDamageTaken: metrics.averageDamageTaken,
    averageRoomDurationMs: metrics.averageRoomDurationMs,
    averageFeedbackResponseDurationMs: metrics.averageFeedbackResponseDurationMs,
  };
}

function groupedParticipantAggregate(
  sessions: readonly ResearchSession[],
  key: PilotRunLabel | 'adaptive-first' | 'neutral-first',
): ParticipantRateAggregate {
  const groups = new Map<string, RoomResearchRecord[]>();
  for (const session of sessions) {
    const matches =
      key === 'Run A' || key === 'Run B'
        ? session.runs.filter((run) => run.runLabel === key)
        : sessionConditionOrder(session) === key
          ? session.runs
          : [];
    if (!matches.length) continue;
    const id = participantKey(session);
    groups.set(id, [...(groups.get(id) ?? []), ...matches.flatMap((run) => run.rooms)]);
  }
  const label =
    key === 'Run A' || key === 'Run B'
      ? key
      : key === 'adaptive-first'
        ? 'Adaptive first'
        : 'Neutral first';
  return participantAggregate(
    key,
    label,
    [...groups].map(([participantKeyValue, rooms]) => ({
      participantKey: participantKeyValue,
      metrics: roomMetrics(rooms),
    })),
  );
}

function pairedAnalysis(rows: ParticipantConditionSummary[]): PairedAnalysis {
  const participants = new Map<
    string,
    Partial<Record<ResearchCondition, ParticipantConditionSummary>>
  >();
  for (const row of rows) {
    const pair = participants.get(row.participantKey) ?? {};
    pair[row.condition] = row;
    participants.set(row.participantKey, pair);
  }
  let incompletePairCount = 0;
  const pairs = [...participants].flatMap(([key, pair]) => {
    const adaptive = pair.RULES_ADAPTIVE;
    const neutral = pair.NEUTRAL_PROCEDURAL;
    if (
      !adaptive ||
      !neutral ||
      !adaptive.conditionComplete ||
      !neutral.conditionComplete ||
      adaptive.aboutRightRate === null ||
      neutral.aboutRightRate === null
    ) {
      incompletePairCount += 1;
      return [];
    }
    return [
      {
        participantKey: key,
        participantCode: adaptive.participantCode ?? neutral.participantCode,
        adaptiveAboutRightRate: adaptive.aboutRightRate,
        neutralAboutRightRate: neutral.aboutRightRate,
        aboutRightDifference: adaptive.aboutRightRate - neutral.aboutRightRate,
        adaptiveFairness: adaptive.meanFairness,
        neutralFairness: neutral.meanFairness,
        fairnessDifference:
          adaptive.meanFairness === null || neutral.meanFairness === null
            ? null
            : adaptive.meanFairness - neutral.meanFairness,
        adaptiveEnjoyment: adaptive.meanEnjoyment,
        neutralEnjoyment: neutral.meanEnjoyment,
        enjoymentDifference:
          adaptive.meanEnjoyment === null || neutral.meanEnjoyment === null
            ? null
            : adaptive.meanEnjoyment - neutral.meanEnjoyment,
      },
    ];
  });
  const aboutRightDifferences = pairs.map((pair) => pair.aboutRightDifference);
  const fairnessDifferences = pairs.flatMap((pair) =>
    pair.fairnessDifference === null ? [] : [pair.fairnessDifference],
  );
  const enjoymentDifferences = pairs.flatMap((pair) =>
    pair.enjoymentDifference === null ? [] : [pair.enjoymentDifference],
  );
  return {
    completePairCount: pairs.length,
    incompletePairCount,
    pairs,
    meanAboutRightDifference: average(aboutRightDifferences),
    medianAboutRightDifference: median(aboutRightDifferences),
    meanFairnessDifference: average(fairnessDifferences),
    medianFairnessDifference: median(fairnessDifferences),
    meanEnjoymentDifference: average(enjoymentDifferences),
    medianEnjoymentDifference: median(enjoymentDifferences),
  };
}

function questionnaireSummary(sessions: readonly ResearchSession[]): PilotQuestionnaireSummary {
  const answers = sessions.flatMap((session) => (session.sessionExit ? [session.sessionExit] : []));
  const technicalProblemCount = answers.filter(
    (answer) => answer.technicalProblem === 'yes',
  ).length;
  return {
    submittedQuestionnaires: answers.length,
    technicalProblemCount,
    technicalProblemRate: rate(technicalProblemCount, answers.length),
    meanInstructionClarity: average(answers.map((answer) => answer.instructionClarity)),
    meanSurveyFatigue: average(answers.map((answer) => answer.surveyFatigue)),
    sessionLengthCounts: {
      too_short: answers.filter((answer) => answer.sessionLength === 'too_short').length,
      about_right: answers.filter((answer) => answer.sessionLength === 'about_right').length,
      too_long: answers.filter((answer) => answer.sessionLength === 'too_long').length,
    },
    preferenceCounts: {
      run_a: answers.filter((answer) => answer.overallPreference === 'run_a').length,
      run_b: answers.filter((answer) => answer.overallPreference === 'run_b').length,
      no_preference: answers.filter((answer) => answer.overallPreference === 'no_preference')
        .length,
    },
  };
}

export function createResearchAnalysis(sessions: readonly ResearchSession[]): ResearchAnalysis {
  const participantConditions = createParticipantConditionSummaries(sessions);
  return {
    participantConditions,
    conditions: Object.fromEntries(
      CONDITIONS.map((condition) => [
        condition,
        conditionSummary(condition, participantConditions, sessions),
      ]),
    ) as Record<ResearchCondition, ConditionAnalysisSummary>,
    runLabels: Object.fromEntries(
      RUN_LABELS.map((label) => [label, groupedParticipantAggregate(sessions, label)]),
    ) as Record<PilotRunLabel, ParticipantRateAggregate>,
    conditionOrders: {
      'adaptive-first': groupedParticipantAggregate(sessions, 'adaptive-first'),
      'neutral-first': groupedParticipantAggregate(sessions, 'neutral-first'),
    },
    paired: pairedAnalysis(participantConditions),
    questionnaire: questionnaireSummary(sessions),
  };
}
