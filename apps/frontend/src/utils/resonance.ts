import { RESONANCE_REWARD_CONFIG } from '../config/rewards';

export function normalizeResonance(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function awardResonance(
  current: number,
  alreadyAwarded: boolean,
): { resonance: number; awarded: boolean } {
  const resonance = normalizeResonance(current);
  if (alreadyAwarded) return { resonance, awarded: false };
  return {
    resonance: resonance + RESONANCE_REWARD_CONFIG.resonancePerCache,
    awarded: true,
  };
}

export function serializeResonance(value: unknown): number {
  return normalizeResonance(value);
}

export function formatResonance(value: unknown): string {
  return String(normalizeResonance(value));
}
