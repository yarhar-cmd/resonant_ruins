import type { AdaptiveProfile, ExperiencePreset } from '../types/adaptation';
import type {
  PilotPhase,
  PilotRunLabel,
  ResearchCondition,
  ResearchRun,
  ResearchSession,
} from '../types/research';

export const PILOT_PROTOCOL_ID = 'fixed-pilot-1' as const;
export const PILOT_ASSIGNMENT_METHOD_ID = 'pilot-sequence-alternation-1' as const;
export const PILOT_TARGET_OUTCOMES = 10 as const;
export const PILOT_CHARACTER_ID = 'warden' as const;
export const PILOT_PRACTICE_CHAMBERS = 5 as const;

const LEGAL_TRANSITIONS: Record<PilotPhase, readonly PilotPhase[]> = {
  setup: ['practice', 'session_incomplete', 'recoverable_error'],
  practice: ['run_a_active', 'session_incomplete', 'recoverable_error'],
  run_a_active: ['run_a_feedback', 'session_incomplete', 'recoverable_error'],
  run_a_feedback: ['run_a_active', 'run_a_complete', 'session_incomplete', 'recoverable_error'],
  run_a_complete: ['break', 'run_b_active', 'session_incomplete', 'recoverable_error'],
  break: ['run_b_active', 'session_incomplete', 'recoverable_error'],
  run_b_active: ['run_b_feedback', 'session_incomplete', 'recoverable_error'],
  run_b_feedback: ['run_b_active', 'session_complete', 'session_incomplete', 'recoverable_error'],
  session_complete: [],
  session_incomplete: [],
  recoverable_error: [
    'practice',
    'run_a_active',
    'run_a_feedback',
    'run_a_complete',
    'break',
    'run_b_active',
    'run_b_feedback',
    'session_incomplete',
  ],
};

export function canTransitionPilot(from: PilotPhase, to: PilotPhase): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export function transitionPilot(from: PilotPhase, to: PilotPhase): PilotPhase {
  if (!canTransitionPilot(from, to)) throw new Error(`Illegal Pilot transition: ${from} -> ${to}`);
  return to;
}

export function pilotConditionOrder(sequence: number): [ResearchCondition, ResearchCondition] {
  if (!Number.isSafeInteger(sequence) || sequence <= 0)
    throw new Error('Participant sequence must be a positive integer.');
  return sequence % 2 === 1
    ? ['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL']
    : ['NEUTRAL_PROCEDURAL', 'RULES_ADAPTIVE'];
}

export function pilotRunLabel(index: number): PilotRunLabel {
  if (index === 0) return 'Run A';
  if (index === 1) return 'Run B';
  throw new Error('Fixed Pilot sessions contain exactly two condition blocks.');
}

export function finalizedOutcomeCount(run: Pick<ResearchRun, 'rooms'>): number {
  return run.rooms.length;
}

export function nextRoomOpportunityIndex(run: Pick<ResearchRun, 'rooms'>): number | null {
  const count = finalizedOutcomeCount(run);
  return count >= PILOT_TARGET_OUTCOMES ? null : count + 1;
}

export function isPilotBlockComplete(run: Pick<ResearchRun, 'rooms'>): boolean {
  return finalizedOutcomeCount(run) === PILOT_TARGET_OUTCOMES;
}

export function mayGeneratePilotRoom(run: Pick<ResearchRun, 'rooms' | 'status'>): boolean {
  return run.status === 'active' && finalizedOutcomeCount(run) < PILOT_TARGET_OUTCOMES;
}

export function profilesEqual(a: AdaptiveProfile, b: AdaptiveProfile): boolean {
  return (
    a.pace === b.pace &&
    a.caution === b.caution &&
    a.aggression === b.aggression &&
    a.hazardTolerance === b.hazardTolerance &&
    a.exploration === b.exploration
  );
}

export function validatePilotSession(session: ResearchSession): string[] {
  if (session.protocolId !== PILOT_PROTOCOL_ID) return [];
  const issues: string[] = [];
  if (
    !session.participantSequence ||
    session.hiddenConditionOrder?.join('|') !==
      pilotConditionOrder(session.participantSequence).join('|')
  )
    issues.push('Participant sequence and hidden condition order do not match.');
  if (session.assignmentMethodId !== PILOT_ASSIGNMENT_METHOD_ID)
    issues.push('Pilot assignment method is invalid.');
  if (session.lockedCharacterId !== PILOT_CHARACTER_ID)
    issues.push('Pilot character must be the Warden.');
  if (!session.lockedExperiencePreset) issues.push('Pilot experience preset is not locked.');
  if (session.runs.length > 2) issues.push('Pilot sessions may contain only Run A and Run B.');
  session.runs.forEach((run, index) => {
    if (run.rooms.length > PILOT_TARGET_OUTCOMES)
      issues.push(`${pilotRunLabel(index)} contains more than 10 finalized outcomes.`);
    if (run.characterId !== PILOT_CHARACTER_ID)
      issues.push(`${pilotRunLabel(index)} is not Warden.`);
    if (run.experiencePreset !== session.lockedExperiencePreset)
      issues.push(`${pilotRunLabel(index)} does not use the locked preset.`);
    if (run.condition !== session.hiddenConditionOrder?.[index])
      issues.push(`${pilotRunLabel(index)} condition does not match assignment order.`);
    if (
      session.sharedPracticeBaseline &&
      run.startingProfile &&
      !profilesEqual(run.startingProfile, session.sharedPracticeBaseline)
    )
      issues.push(`${pilotRunLabel(index)} does not start from the shared practice baseline.`);
    for (const room of run.rooms) {
      if (room.experiencePreset !== session.lockedExperiencePreset)
        issues.push(`${pilotRunLabel(index)} contains a room with a mismatched preset.`);
      if (room.maximumHealth <= 0)
        issues.push(`${pilotRunLabel(index)} has invalid Warden health.`);
    }
  });
  if (session.completionStatus === 'complete') {
    if (session.runs.length !== 2 || session.runs.some((run) => !isPilotBlockComplete(run)))
      issues.push('Completed Pilot session does not contain two complete blocks.');
    if (!session.completedAt) issues.push('Completed Pilot session has no completion timestamp.');
    if (session.incompleteAt || session.incompleteReason)
      issues.push('Completed Pilot session is also marked incomplete.');
  }
  if (session.completionStatus === 'incomplete') {
    if (!session.incompleteAt || !session.incompleteReason)
      issues.push('Incomplete Pilot session lacks termination details.');
    if (session.completedAt) issues.push('Incomplete Pilot session has a completion timestamp.');
  }
  return issues;
}

export function assertLockedPilotPreset(
  session: ResearchSession,
  preset: ExperiencePreset,
): boolean {
  return session.protocolId !== PILOT_PROTOCOL_ID || session.lockedExperiencePreset === preset;
}
