import type { AdaptiveProfile } from '../types/adaptation';
import type {
  RoomCandidateSummary,
  RoomSelectionDecision,
  RoomSelector,
  ValidatedRoomCandidate,
} from '../types/generation';
import { createRules2Profile, scoreRoomFeatureVector, selectRankedCandidate } from './roomSelector';

export interface RuleBasedSelectorContext {
  sharedPoolId: string;
  selectionSeed: string;
  profile: AdaptiveProfile;
  mode: 'reinforce' | 'poke';
  recentDamage?: number;
}

export const RuleBasedRoomSelector: RoomSelector<RuleBasedSelectorContext> = {
  selectorId: 'rules-adaptive',
  selectorVersion: 'rules-selector-1',
  select(pool, context) {
    if (!pool.length) throw new Error('RuleBasedRoomSelector requires a non-empty pool.');
    const adjusted = createRules2Profile(context.profile, context.mode, context.selectionSeed);
    const summaries: RoomCandidateSummary[] = pool.map((candidate) => ({
      id: candidate.id,
      rank: 0,
      score: scoreRoomFeatureVector(candidate.featureVector, adjusted.profile),
      archetype: candidate.archetype,
      featureVector: candidate.featureVector,
    }));
    const ranked = selectRankedCandidate(summaries, context.selectionSeed);
    return {
      selectorId: 'rules-adaptive',
      selectorVersion: 'rules-selector-1',
      sharedPoolId: context.sharedPoolId,
      candidateCount: pool.length,
      selectedCandidateId: ranked.selected.id,
      selectedCandidateRank: ranked.selected.rank,
      selectedScore: ranked.selected.score,
      deterministicRoll: ranked.roll,
      explanationTokens: [
        `rules-2-${context.mode}`,
        ...(adjusted.challengedTraits.length
          ? adjusted.challengedTraits.map((trait) => `challenged-${trait}`)
          : ['profile-reinforced']),
      ],
      topCandidates: ranked.ranked.slice(0, 3),
      reducedDiversity: ranked.reducedDiversity,
      fallbackUsed: pool.every((candidate) => candidate.archetype === 'safe-fallback'),
      profileConsumed: true,
      challengedTraits: adjusted.challengedTraits,
    };
  },
};

export function selectRuleBasedRoom(
  pool: readonly ValidatedRoomCandidate[],
  context: RuleBasedSelectorContext,
): RoomSelectionDecision {
  return RuleBasedRoomSelector.select(pool, context);
}
