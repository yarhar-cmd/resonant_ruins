import { describe, expect, it } from 'vitest';
import {
  awardResonance,
  formatResonance,
  normalizeResonance,
  serializeResonance,
} from './resonance';

describe('rewards-1 Resonance resource', () => {
  it('normalizes invalid and negative values to zero', () => {
    expect(normalizeResonance(-4)).toBe(0);
    expect(normalizeResonance(Number.NaN)).toBe(0);
    expect(serializeResonance(3.9)).toBe(3);
    expect(formatResonance(2)).toBe('2');
  });

  it('awards exactly one Resonance once per Cache', () => {
    expect(awardResonance(0, false)).toEqual({ resonance: 1, awarded: true });
    expect(awardResonance(1, true)).toEqual({ resonance: 1, awarded: false });
  });
});
