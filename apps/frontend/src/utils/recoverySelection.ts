import { RESTORATION_FOUNTAIN_CONFIG } from '../config/recovery';
import type { ExperiencePreset } from '../types/adaptation';
import type {
  RecoveryDecision,
  RecoveryGenerationContext,
  RecoveryInputSnapshot,
} from '../types/generation';
import type { AdaptiveProfile } from '../types/adaptation';
import { createSeededRandom } from './seededRandom';

function bounded(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createRecoveryDecision(input: {
  seed: string;
  preset: ExperiencePreset;
  profile: AdaptiveProfile;
  recovery?: RecoveryGenerationContext;
  validPlacementCount: number;
}): RecoveryDecision {
  const context = input.recovery;
  const maximumHealth = Math.max(1, context?.maximumHealth ?? 1);
  const recentDamageTotal = (context?.recentGeneratedDamage ?? []).reduce(
    (sum, value) => sum + Math.max(0, value),
    0,
  );
  const snapshot: RecoveryInputSnapshot = {
    healthDeficit: bounded(
      (maximumHealth - (context?.currentHealth ?? maximumHealth)) / maximumHealth,
    ),
    recentDamage: bounded(recentDamageTotal / maximumHealth),
    damageStreak: bounded((context?.damageStreak ?? 0) / 3),
    recoveryDrought: bounded(Math.max(0, (context?.roomsSinceLastGeneratedSpawn ?? 0) - 2) / 5),
    caution: bounded(input.profile.caution),
    hazardTolerance: bounded(input.profile.hazardTolerance),
    exploration: bounded(input.profile.exploration),
    recentPressure: bounded((context?.recentCombatPressure ?? 0) / 4),
    previousSkipped: context?.previousSkipped ?? false,
  };
  const ceiling = RESTORATION_FOUNTAIN_CONFIG.probabilityCeilings[input.preset];
  const raw =
    RESTORATION_FOUNTAIN_CONFIG.baseProbability +
    snapshot.healthDeficit * RESTORATION_FOUNTAIN_CONFIG.healthDeficitWeight +
    snapshot.recentDamage * RESTORATION_FOUNTAIN_CONFIG.recentDamageWeight +
    snapshot.damageStreak * RESTORATION_FOUNTAIN_CONFIG.damageStreakWeight +
    snapshot.recoveryDrought * RESTORATION_FOUNTAIN_CONFIG.recoveryDroughtWeight +
    snapshot.caution * RESTORATION_FOUNTAIN_CONFIG.cautionWeight +
    snapshot.recentPressure * RESTORATION_FOUNTAIN_CONFIG.recentPressureWeight -
    (snapshot.previousSkipped ? RESTORATION_FOUNTAIN_CONFIG.skippedPenalty : 0);
  const probability = Math.max(0, Math.min(ceiling, raw));
  const roll = createSeededRandom(`${input.seed}:recovery`)();
  const cooldownBefore = context?.cooldownRemaining ?? 0;
  const placementPossible = input.validPlacementCount > 0;
  const forced = context?.placementOverride === 'force';
  const disabled = context?.placementOverride === 'disable';
  const requested = !disabled && (forced || roll < probability);
  const spawned = requested && placementPossible && cooldownBefore === 0;
  const reasons: string[] = [];
  if (snapshot.healthDeficit >= 0.34) reasons.push('low-health-support');
  if (snapshot.recentDamage > 0) reasons.push('recent-damage');
  if (snapshot.damageStreak > 0) reasons.push('damage-streak');
  if (snapshot.recoveryDrought > 0) reasons.push('recovery-drought');
  if (input.preset === 'new-delver') reasons.push('preset-support');
  if (snapshot.caution > 0.55) reasons.push('profile-aligned-opportunity');
  if (requested) reasons.push('seeded-optional-recovery');
  if (cooldownBefore > 0) reasons.push('cooldown-suppressed');
  if (!placementPossible) reasons.push('no-valid-placement');
  if (snapshot.healthDeficit === 0) reasons.push('full-health-low-need');
  return {
    requested,
    placementPossible,
    spawned,
    probability,
    roll,
    cooldownBefore,
    cooldownAfter: spawned
      ? RESTORATION_FOUNTAIN_CONFIG.generatedCooldownRooms
      : Math.max(0, cooldownBefore - 1),
    reasons,
    inputs: snapshot,
    validPlacementCount: input.validPlacementCount,
    placementStyle: null,
    selectedCoordinate: null,
    visualVariant: null,
  };
}
