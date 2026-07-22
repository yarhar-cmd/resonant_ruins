import type { AdaptiveProfile, ExperiencePreset } from '../types/adaptation';
import type { ValidatedRoomCandidate } from '../types/generation';
import type { ExitDirection } from '../types/rooms';
import type { RoomFeatureVector } from '../types/topology';
import { getRestorationFountains } from '../utils/interactions';
import type { FountainPlacementFeature, ModelSemanticFeatures } from './featureManifest';
import type { RecentRatingFeatures } from './recentRatings';

export interface ModelPreRoomContext {
  profileForRoom: AdaptiveProfile;
  healthBefore: number;
  maximumHealth: number;
  recentDamage: number;
  recentAverageRoomDuration: number;
  recentDurationRoomCount: number;
  roomsCompletedInSession: number;
  experiencePreset: ExperiencePreset;
  incomingEntranceDirection: ExitDirection;
  recentRatings: RecentRatingFeatures;
}

export interface ModelCandidateContext {
  featureVector: RoomFeatureVector;
  fountainPlacement: FountainPlacementFeature;
}

export function candidateContextFromValidatedRoom(
  candidate: ValidatedRoomCandidate,
): ModelCandidateContext {
  const fountain = getRestorationFountains(candidate.save.roomSnapshot)[0];
  return {
    featureVector: candidate.featureVector,
    fountainPlacement: fountain?.placementStyle ?? 'none',
  };
}

export function buildModelSemanticFeatures(
  context: ModelPreRoomContext,
  candidate: ModelCandidateContext,
): ModelSemanticFeatures {
  const feature = candidate.featureVector;
  return {
    ...context.profileForRoom,
    currentHealthPercentage: context.healthBefore / context.maximumHealth,
    recentDamage: context.recentDamage,
    recentAverageRoomDuration: context.recentAverageRoomDuration,
    recentDurationRoomCount: context.recentDurationRoomCount,
    roomsCompletedInSession: context.roomsCompletedInSession,
    experiencePreset: context.experiencePreset,
    incomingEntranceDirection: context.incomingEntranceDirection,
    ...context.recentRatings,
    archetype: feature.archetype,
    boundaryFamily: feature.boundaryFamily,
    floorArea: feature.floorArea,
    openFloorPercentage: feature.openFloorPercentage,
    oneTileChokepointCount: feature.oneTileChokepointCount,
    maximumDeadEndLength: feature.maximumDeadEndLength,
    safePathDistance: feature.safePathDistance,
    directnessRatio: feature.directnessRatio,
    ratCount: feature.ratCount,
    runeCount: feature.runeCount,
    averageRatSpawnDistance: feature.averageRatSpawnDistance,
    fountainPlacement: candidate.fountainPlacement,
  };
}

export function assertValidModelSemanticFeatures(features: ModelSemanticFeatures): void {
  for (const [name, value] of Object.entries(features)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`Model feature ${name} must be finite.`);
    }
  }
  if (features.currentHealthPercentage < 0 || features.currentHealthPercentage > 1) {
    throw new Error('Current health percentage must be between zero and one.');
  }
}
