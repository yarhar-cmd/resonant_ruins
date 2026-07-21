import type { AdaptiveProfile } from './adaptation';
import type { RoomFeatureVector } from './topology';

export type CandidateFeatureVector = RoomFeatureVector;

export interface ModelScoringContext {
  runSeed: string;
  roomSequence: number;
  profile: AdaptiveProfile;
}

export type CandidateModelScores =
  | { availability: 'available'; scores: readonly number[] }
  | { availability: 'unavailable'; scores: null };

export interface CandidateScoringModel {
  readonly modelId: string;
  readonly modelVersion: string;
  scoreCandidates(
    context: ModelScoringContext,
    candidates: readonly CandidateFeatureVector[],
  ): CandidateModelScores;
}

export interface LearnedRoomSelectorBoundary {
  readonly selectorId: 'learned-model';
  readonly model: CandidateScoringModel;
}
