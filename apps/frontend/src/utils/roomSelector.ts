import { TOPOLOGY_CONFIG } from '../config/topology';
import type { AdaptiveProfile, AdaptiveTrait } from '../types/adaptation';
import type { RoomCandidateSummary } from '../types/generation';
import type { RoomFeatureVector } from '../types/topology';
import { createSeededRandom } from './seededRandom';

const traits: AdaptiveTrait[] = ['pace', 'caution', 'aggression', 'hazardTolerance', 'exploration'];
const centered = (value: number) => (value - 0.5) * 2;

export function createRules2Profile(
  profile: AdaptiveProfile,
  mode: 'reinforce' | 'poke',
  seed: string,
): { profile: AdaptiveProfile; challengedTraits: AdaptiveTrait[] } {
  if (mode === 'reinforce') return { profile: { ...profile }, challengedTraits: [] };
  const random = createSeededRandom(`${seed}:rules-2-poke`);
  const first = traits[Math.floor(random() * traits.length)]!;
  const challengedTraits = [first];
  if (random() < TOPOLOGY_CONFIG.rules2SecondTraitChance) {
    const remaining = traits.filter((trait) => trait !== first);
    challengedTraits.push(remaining[Math.floor(random() * remaining.length)]!);
  }
  const adjusted = { ...profile };
  for (const trait of challengedTraits) {
    const contrast = 1 - profile[trait];
    adjusted[trait] =
      profile[trait] + (contrast - profile[trait]) * TOPOLOGY_CONFIG.rules2PokeContrast;
  }
  return { profile: adjusted, challengedTraits };
}

export function scoreRoomFeatureVector(
  feature: RoomFeatureVector,
  profile: AdaptiveProfile,
): number {
  const exploration = centered(profile.exploration);
  const pace = centered(profile.pace);
  const caution = centered(profile.caution);
  const aggression = centered(profile.aggression);
  const hazardTolerance = centered(profile.hazardTolerance);
  const directness = 1 - Math.min(1, feature.directnessRatio - 1);
  const irregular = feature.boundaryFamily === 'rectangle' ? 0 : 1;
  const alternateRoutes = Math.min(1, (feature.loopCount + feature.branchCount / 8) / 3);
  const openness = Math.min(1, feature.openFloorPercentage * 2);
  const chokePenalty = Math.min(1, feature.oneTileChokepointCount / 3);
  const deadEndPenalty = Math.min(1, feature.maximumDeadEndLength / 5);
  const optionalHazards = Math.min(1, feature.runeDensity * 12);
  const directionalOptions = Math.min(1, Math.max(0, feature.directionalExitCount - 1) / 2);
  const score =
    1 +
    exploration * (irregular * 0.18 + alternateRoutes * 0.22 + directionalOptions * 0.1) +
    pace * (directness * 0.2 - deadEndPenalty * 0.18 - directionalOptions * 0.05) +
    caution * (feature.entranceClearArea / 20) * 0.18 -
    Math.max(0, caution) * chokePenalty * 0.25 +
    aggression * (openness * 0.2 + alternateRoutes * 0.12) +
    hazardTolerance * optionalHazards * 0.18;
  return Math.round(score * 10_000) / 10_000;
}

export function selectRankedCandidate<T extends RoomCandidateSummary>(
  candidates: T[],
  seed: string,
): { selected: T; roll: number; reducedDiversity: boolean; ranked: T[] } {
  if (!candidates.length) throw new Error('Cannot select from an empty candidate list.');
  const ranked = [...candidates]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 })) as T[];
  const top = ranked.slice(0, TOPOLOGY_CONFIG.topCandidateCount);
  const random = createSeededRandom(`${seed}:top-three-selection`);
  const roll = random();
  if (top.length < 3) {
    const selected = top[Math.min(top.length - 1, Math.floor(roll * top.length))]!;
    return { selected, roll, reducedDiversity: true, ranked };
  }
  let cursor = roll;
  for (let index = 0; index < top.length; index += 1) {
    cursor -= TOPOLOGY_CONFIG.topCandidateWeights[index]!;
    if (cursor <= 0) return { selected: top[index]!, roll, reducedDiversity: false, ranked };
  }
  return { selected: top[top.length - 1]!, roll, reducedDiversity: false, ranked };
}
