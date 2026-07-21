import { describe, expect, it } from 'vitest';
import { assignResearchCondition } from './conditionAssignment';

describe('balanced research condition assignment', () => {
  it('is deterministic and balances every two-run block', () => {
    for (let block = 0; block < 20; block += 1) {
      const first = assignResearchCondition({
        sessionSeed: 'balanced-session',
        runIndex: block * 2,
      });
      const second = assignResearchCondition({
        sessionSeed: 'balanced-session',
        runIndex: block * 2 + 1,
      });
      expect(new Set([first.condition, second.condition])).toEqual(
        new Set(['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL']),
      );
      expect(first.blockIndex).toBe(block);
      expect(second.blockIndex).toBe(block);
      expect(first.roll).toBe(second.roll);
      expect(
        assignResearchCondition({ sessionSeed: 'balanced-session', runIndex: block * 2 }),
      ).toEqual(first);
    }
  });

  it('holds a per-session assignment stable across runs', () => {
    const conditions = Array.from({ length: 8 }, (_, runIndex) =>
      assignResearchCondition({ sessionSeed: 'session-unit', runIndex, unit: 'per-session' }),
    );
    expect(new Set(conditions.map((item) => item.condition)).size).toBe(1);
    expect(conditions.every((item) => item.unit === 'per-session')).toBe(true);
  });
});
