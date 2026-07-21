import { describe, expect, it } from 'vitest';
import { createRecoveryDecision } from './recoverySelection';

const profile = {
  pace: 0.5,
  caution: 0.5,
  aggression: 0.5,
  hazardTolerance: 0.5,
  exploration: 0.5,
};

function recovery(overrides: Record<string, unknown> = {}) {
  return {
    currentHealth: 2,
    maximumHealth: 4,
    recentGeneratedDamage: [1, 0],
    damageStreak: 1,
    roomsSinceLastGeneratedSpawn: 4,
    roomsSinceLastUse: 4,
    previousSkipped: false,
    recentCombatPressure: 1,
    cooldownRemaining: 0,
    ...overrides,
  };
}

describe('generator-3 Restoration Fountain recovery selection', () => {
  it('is deterministic, bounded, and independent of room depth', () => {
    const input = {
      seed: 'recovery-seed',
      preset: 'seasoned-adventurer' as const,
      profile,
      recovery: recovery(),
      validPlacementCount: 9,
    };
    const first = createRecoveryDecision(input);
    expect(createRecoveryDecision(input)).toEqual(first);
    expect(first.probability).toBeGreaterThanOrEqual(0);
    expect(first.probability).toBeLessThanOrEqual(0.56);
  });

  it('raises opportunity continuously with health deficit and recent damage', () => {
    const healthy = createRecoveryDecision({
      seed: 'same',
      preset: 'new-delver',
      profile,
      recovery: recovery({ currentHealth: 4, recentGeneratedDamage: [0], damageStreak: 0 }),
      validPlacementCount: 3,
    });
    const pressured = createRecoveryDecision({
      seed: 'same',
      preset: 'new-delver',
      profile,
      recovery: recovery({ currentHealth: 1, recentGeneratedDamage: [2, 1], damageStreak: 3 }),
      validPlacementCount: 3,
    });
    expect(pressured.probability).toBeGreaterThan(healthy.probability);
  });

  it('suppresses during cooldown and starts two-room cooldown on a forced spawn', () => {
    const suppressed = createRecoveryDecision({
      seed: 'cooldown',
      preset: 'new-delver',
      profile,
      recovery: recovery({ cooldownRemaining: 2, placementOverride: 'force' }),
      validPlacementCount: 3,
    });
    expect(suppressed).toMatchObject({ spawned: false, cooldownAfter: 1 });
    expect(suppressed.reasons).toContain('cooldown-suppressed');
    const spawned = createRecoveryDecision({
      seed: 'spawn',
      preset: 'new-delver',
      profile,
      recovery: recovery({ placementOverride: 'force' }),
      validPlacementCount: 3,
    });
    expect(spawned).toMatchObject({ spawned: true, cooldownAfter: 2 });
  });
});
