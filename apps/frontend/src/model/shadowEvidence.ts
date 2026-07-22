import type { RoomSelectionDecision } from '../types/generation';
import type { CandidateModelScoringResult } from '../types/model';
import type { DifficultyRating, ShadowRoomEvidence } from '../types/research';
import { strongestContributions } from './explanations';

export function createShadowRoomEvidence(input: {
  roomDecisionId: string;
  sharedPoolId: string;
  activeDecision: RoomSelectionDecision;
  result: CandidateModelScoringResult;
  priorRatingAvailable: boolean;
}): ShadowRoomEvidence | null {
  if (input.result.status === 'unavailable') return null;
  if (input.result.status !== 'success') {
    return {
      schemaVersion: 'shadow-1',
      status: input.result.status,
      roomDecisionId: input.roomDecisionId,
      sharedPoolId: input.sharedPoolId,
      artifactId: input.result.artifactId,
      modelId: null,
      modelVersion: null,
      featureSchemaVersion: 'model-features-1',
      activeSelectorId: input.activeDecision.selectorId,
      activeSelectedCandidateId: input.activeDecision.selectedCandidateId,
      candidates: [],
      modelPreferredCandidateId: null,
      agreesWithActiveSelector: null,
      priorRatingAvailable: input.priorRatingAvailable,
      scoringDurationMs: null,
      failure: { stage: input.result.stage, reasonCode: input.result.reasonCode },
      observedRating: null,
      predictedObservedClass: null,
      predictionCorrect: null,
    };
  }
  return {
    schemaVersion: 'shadow-1',
    status: 'scored',
    roomDecisionId: input.roomDecisionId,
    sharedPoolId: input.sharedPoolId,
    artifactId: input.result.artifactId,
    modelId: input.result.modelId,
    modelVersion: input.result.modelVersion,
    featureSchemaVersion: 'model-features-1',
    activeSelectorId: input.activeDecision.selectorId,
    activeSelectedCandidateId: input.activeDecision.selectedCandidateId,
    candidates: input.result.predictions.map((prediction) => ({
      candidateId: prediction.candidateId,
      probabilities: prediction.probabilities,
      predictedClass: prediction.predictedClass,
      confidence: prediction.confidence,
      rank: prediction.rank,
      topContributions: (['too_easy', 'about_right', 'too_hard'] as const).flatMap((targetClass) =>
        strongestContributions(prediction.contributions[targetClass], 2).map((contribution) => ({
          targetClass,
          feature: contribution.feature,
          contribution: contribution.contribution,
          phrase: contribution.phrase,
        })),
      ),
    })),
    modelPreferredCandidateId: input.result.preferredCandidateId,
    agreesWithActiveSelector:
      input.result.preferredCandidateId === input.activeDecision.selectedCandidateId,
    priorRatingAvailable: input.priorRatingAvailable,
    scoringDurationMs: input.result.scoringDurationMs,
    failure: null,
    observedRating: null,
    predictedObservedClass: null,
    predictionCorrect: null,
  };
}

export function attachObservedShadowRating(
  shadow: ShadowRoomEvidence,
  rating: DifficultyRating | null,
): ShadowRoomEvidence {
  const activePrediction = shadow.candidates.find(
    (candidate) => candidate.candidateId === shadow.activeSelectedCandidateId,
  );
  return {
    ...shadow,
    observedRating: rating,
    predictedObservedClass: activePrediction?.predictedClass ?? null,
    predictionCorrect:
      rating !== null && activePrediction ? activePrediction.predictedClass === rating : null,
  };
}
