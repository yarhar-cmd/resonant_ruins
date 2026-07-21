import { RESEARCH_ASSIGNMENT_METHOD_ID } from '../config/research';
import type {
  ResearchAssignmentUnit,
  ResearchCondition,
  ResearchConditionAssignment,
} from '../types/research';
import { createSeededRandom } from '../utils/seededRandom';

const ADAPTIVE: ResearchCondition = 'RULES_ADAPTIVE';
const NEUTRAL: ResearchCondition = 'NEUTRAL_PROCEDURAL';

export function assignResearchCondition(input: {
  sessionSeed: string;
  runIndex: number;
  unit?: ResearchAssignmentUnit;
}): ResearchConditionAssignment {
  const unit = input.unit ?? 'per-run';
  const blockIndex = unit === 'per-session' ? 0 : Math.floor(input.runIndex / 2);
  const roll = createSeededRandom(`${input.sessionSeed}:condition-block:${blockIndex}`)();
  const first = roll < 0.5 ? ADAPTIVE : NEUTRAL;
  const second = first === ADAPTIVE ? NEUTRAL : ADAPTIVE;
  const condition = unit === 'per-session' ? first : input.runIndex % 2 === 0 ? first : second;
  return {
    unit,
    methodId: RESEARCH_ASSIGNMENT_METHOD_ID,
    sessionSeed: input.sessionSeed,
    runIndex: input.runIndex,
    blockIndex,
    roll,
    condition,
  };
}
