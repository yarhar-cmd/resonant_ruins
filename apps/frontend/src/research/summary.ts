import type {
  ResearchCondition,
  ResearchSession,
  ResearchSummary,
  ResearchSummaryGroup,
  RoomResearchRecord,
} from '../types/research';

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function group(rooms: RoomResearchRecord[]): ResearchSummaryGroup {
  const rated = rooms.filter(
    (room) => room.feedback.status === 'submitted' && room.feedback.difficulty !== null,
  );
  const aboutRightCount = rated.filter((room) => room.feedback.difficulty === 'about_right').length;
  const tooEasyCount = rated.filter((room) => room.feedback.difficulty === 'too_easy').length;
  const tooHardCount = rated.filter((room) => room.feedback.difficulty === 'too_hard').length;
  const rate = (count: number) => (rated.length ? count / rated.length : null);
  return {
    roomCount: rooms.length,
    ratedRooms: rated.length,
    aboutRightCount,
    aboutRightRate: rate(aboutRightCount),
    tooEasyCount,
    tooEasyRate: rate(tooEasyCount),
    tooHardCount,
    tooHardRate: rate(tooHardCount),
    averageFairness: average(
      rated.flatMap((room) => (room.feedback.fairness === null ? [] : [room.feedback.fairness])),
    ),
    averageEnjoyment: average(
      rated.flatMap((room) => (room.feedback.enjoyment === null ? [] : [room.feedback.enjoyment])),
    ),
  };
}

export function createResearchSummary(
  sessions: readonly ResearchSession[],
  includePilot = false,
): ResearchSummary {
  const included = sessions.filter((session) => includePilot || !session.pilot);
  const runs = included.flatMap((session) => session.runs);
  const rooms = runs.flatMap((run) => run.rooms);
  const conditions: ResearchCondition[] = ['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL'];
  const base = group(rooms);
  return {
    ...base,
    sessionCount: included.length,
    runCount: runs.length,
    skippedRooms: rooms.filter((room) => room.feedback.status === 'skipped').length,
    participantCodeCount: new Set(
      included.flatMap((session) => (session.participantCode ? [session.participantCode] : [])),
    ).size,
    byCondition: Object.fromEntries(
      conditions.map((condition) => [
        condition,
        group(rooms.filter((room) => room.condition === condition)),
      ]),
    ) as Record<ResearchCondition, ResearchSummaryGroup>,
    versionBreakdown: rooms.reduce<Record<string, number>>((counts, room) => {
      const key = `${room.gameVersion}/${room.generatorVersion}/${room.selectorVersion}`;
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
    archetypeDistribution: rooms.reduce<Record<string, number>>((counts, room) => {
      counts[room.archetype] = (counts[room.archetype] ?? 0) + 1;
      return counts;
    }, {}),
  };
}
