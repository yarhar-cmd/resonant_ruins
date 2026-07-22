import type {
  RoomCandidateSummary,
  RoomSelectionDecision,
  RoomSelector,
  ValidatedRoomCandidate,
} from '../types/generation';
import type { RoomArchetype } from '../types/topology';
import { createSeededRandom, shuffleSeeded } from './seededRandom';

export interface NeutralSelectorContext {
  sharedPoolId: string;
  selectionSeed: string;
  recentArchetypes?: readonly RoomArchetype[];
}

export function rankNeutralCandidates(
  pool: readonly ValidatedRoomCandidate[],
  context: NeutralSelectorContext,
): ValidatedRoomCandidate[] {
  const recent = new Set((context.recentArchetypes ?? []).slice(-2));
  const shuffled = shuffleSeeded(
    createSeededRandom(`${context.selectionSeed}:neutral-order`),
    pool,
  );
  return [...shuffled].sort((left, right) => {
    const leftRepeated = recent.has(left.archetype) ? 1 : 0;
    const rightRepeated = recent.has(right.archetype) ? 1 : 0;
    return leftRepeated - rightRepeated;
  });
}

export const NeutralRoomSelector: RoomSelector<NeutralSelectorContext> = {
  selectorId: 'neutral-procedural',
  selectorVersion: 'neutral-selector-1',
  select(pool, context) {
    if (!pool.length) throw new Error('NeutralRoomSelector requires a non-empty pool.');
    const ordered = rankNeutralCandidates(pool, context);
    const random = createSeededRandom(`${context.selectionSeed}:neutral-selection`);
    const roll = random();
    const varietyWindow = ordered.slice(0, Math.min(ordered.length, 4));
    const selected = varietyWindow[Math.floor(roll * varietyWindow.length)]!;
    const summaries: RoomCandidateSummary[] = ordered.map((candidate, index) => ({
      id: candidate.id,
      rank: index + 1,
      score: 1,
      archetype: candidate.archetype,
      featureVector: candidate.featureVector,
    }));
    const selectedRank = summaries.find((candidate) => candidate.id === selected.id)!.rank;
    return {
      selectorId: 'neutral-procedural',
      selectorVersion: 'neutral-selector-1',
      sharedPoolId: context.sharedPoolId,
      candidateCount: pool.length,
      selectedCandidateId: selected.id,
      selectedCandidateRank: selectedRank,
      selectedScore: null,
      deterministicRoll: roll,
      explanationTokens: ['seeded-neutral-variety', 'profile-independent-selection'],
      topCandidates: summaries.slice(0, 3),
      reducedDiversity: pool.length < 3,
      fallbackUsed: pool.every((candidate) => candidate.archetype === 'safe-fallback'),
      profileConsumed: false,
      challengedTraits: [],
    };
  },
};

export function selectNeutralRoom(
  pool: readonly ValidatedRoomCandidate[],
  context: NeutralSelectorContext,
): RoomSelectionDecision {
  return NeutralRoomSelector.select(pool, context);
}
