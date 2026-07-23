import { describe, expect, it } from 'vitest';
import {
  canTransitionPilot,
  finalizedOutcomeCount,
  nextRoomOpportunityIndex,
  pilotConditionOrder,
  transitionPilot,
} from './pilotProtocol';

describe('fixed Pilot protocol', () => {
  it('allows only legal state transitions', () => {
    expect(canTransitionPilot('setup', 'practice')).toBe(true);
    expect(canTransitionPilot('practice', 'run_b_active')).toBe(false);
    expect(() => transitionPilot('session_complete', 'run_a_active')).toThrow();
  });

  it('counterbalances exactly by positive odd/even sequence', () => {
    expect(pilotConditionOrder(1)).toEqual(['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL']);
    expect(pilotConditionOrder(2)).toEqual(['NEUTRAL_PROCEDURAL', 'RULES_ADAPTIVE']);
    expect(pilotConditionOrder(999)).toEqual(['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL']);
    expect(() => pilotConditionOrder(0)).toThrow();
  });

  it('derives progress from finalized records and stops before room 11', () => {
    const rooms = Array.from({ length: 9 }, (_, index) => ({ roomDecisionId: `${index}` }));
    expect(finalizedOutcomeCount({ rooms } as never)).toBe(9);
    expect(nextRoomOpportunityIndex({ rooms } as never)).toBe(10);
    expect(nextRoomOpportunityIndex({ rooms: [...rooms, { roomDecisionId: '9' }] } as never)).toBe(
      null,
    );
  });
});
