import { ARCHETYPE_IDS, ARCHETYPE_UNLOCK_ROOM, TOPOLOGY_CONFIG } from '../config/topology';
import type { AdaptiveProfile } from '../types/adaptation';
import type {
  GeneratedRoomSave,
  GenerationRequest,
  RoomSelectionDecision,
  ValidatedRoomCandidate,
} from '../types/generation';
import type { RestorationFountainFeature, RoomArchetype } from '../types/topology';
import { generateTopologyCandidate } from './generatedRoomGeneratorV3';
import { selectNeutralRoom } from './neutralRoomSelector';
import { selectRuleBasedRoom } from './ruleBasedRoomSelector';
import { hashSeed } from './seededRandom';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';

export const GENERATOR_4_CONSTRUCTION_PROFILE: Readonly<AdaptiveProfile> = Object.freeze({
  pace: 0.5,
  caution: 0.5,
  aggression: 0.5,
  hazardTolerance: 0.5,
  exploration: 0.5,
});

export interface SharedCandidatePoolV4 {
  poolId: string;
  roomSeed: string;
  requestedCandidateCount: number;
  validCandidateCount: number;
  rejectedCandidateCount: number;
  rejectionCounts: Record<string, number>;
  fallbackUsed: boolean;
  candidates: ValidatedRoomCandidate[];
}

export function deriveRoomSeedV4(
  request: Pick<
    GenerationRequest,
    'runSeed' | 'dungeonRoomNumber' | 'chosenExitId' | 'entranceDirection' | 'experiencePreset'
  >,
): string {
  return `${request.runSeed}:${request.dungeonRoomNumber}:${request.chosenExitId}:${request.entranceDirection}:${request.experiencePreset}:generator-4`;
}

function candidateEvidence(candidate: ValidatedRoomCandidate) {
  const room = candidate.save.roomSnapshot;
  return {
    id: candidate.id,
    seed: candidate.save.roomSeed,
    archetype: candidate.archetype,
    featureVector: candidate.featureVector,
    floor: room.floorTiles,
    outerWalls: room.outerWallTiles ?? [],
    internalWalls: room.internalWallTiles ?? [],
    exits: room.exits.map(({ id, direction, tile }) => ({ id, direction, tile })),
    runes: room.hazards ?? [],
    rats: (room.enemySpawns ?? []).map(({ id, tile }) => ({ id, tile })),
    fountains: (room.features ?? [])
      .filter(
        (feature): feature is RestorationFountainFeature =>
          feature.kind === 'restoration-fountain' && 'placementStyle' in feature,
      )
      .map((feature) => ({
        id: feature.id,
        tile: feature.tile,
        placementStyle: feature.placementStyle,
        interactionTiles: feature.interactionTiles,
      })),
  };
}

export function createSharedPoolIdV4(candidates: readonly ValidatedRoomCandidate[]): string {
  const canonical = JSON.stringify(candidates.map(candidateEvidence));
  return `generator-4-pool-${hashSeed(canonical).toString(16).padStart(8, '0')}`;
}

export function buildSharedCandidatePoolV4(
  request: GenerationRequest,
  validator: typeof validateGeneratedRoomV3 = validateGeneratedRoomV3,
): SharedCandidatePoolV4 {
  const roomSeed = deriveRoomSeedV4(request);
  const available = ARCHETYPE_IDS.filter(
    (archetype) =>
      ARCHETYPE_UNLOCK_ROOM[request.experiencePreset][archetype] <= request.dungeonRoomNumber,
  );
  const candidates: ValidatedRoomCandidate[] = [];
  const rejectionCounts: Record<string, number> = {};
  let rejectedCandidateCount = 0;

  for (let attempt = 0; attempt < TOPOLOGY_CONFIG.maximumGenerationAttempts; attempt += 1) {
    if (candidates.length >= TOPOLOGY_CONFIG.requestedCandidateCount) break;
    const archetype = available[attempt % available.length]!;
    try {
      const candidate = generateTopologyCandidate(request, archetype, attempt, {
        roomSeed,
        generatorVersion: 'generator-4',
        gameVersion: 'mvp-0.4',
        constructionProfile: GENERATOR_4_CONSTRUCTION_PROFILE,
        constructionMode: 'reinforce',
        fountainPlacementPreference: attempt % 2 === 0 ? 'safe' : 'risky',
      });
      const validation = validator(candidate.save.roomSnapshot);
      if (!validation.valid) {
        rejectedCandidateCount += 1;
        for (const reason of validation.errors)
          rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
        continue;
      }
      candidates.push({
        id: `${roomSeed}:candidate:${attempt}`,
        save: candidate.save,
        archetype,
        featureVector: candidate.feature,
      });
    } catch (error) {
      rejectedCandidateCount += 1;
      const reason = error instanceof Error ? error.message : 'candidate-error';
      rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
    }
  }

  const validCandidateCount = candidates.length;
  let fallbackUsed = false;
  if (!candidates.length) {
    fallbackUsed = true;
    const fallback = generateTopologyCandidate(request, 'safe-fallback', 10_000, {
      roomSeed,
      generatorVersion: 'generator-4',
      gameVersion: 'mvp-0.4',
      constructionProfile: GENERATOR_4_CONSTRUCTION_PROFILE,
      constructionMode: 'reinforce',
      fountainPlacementPreference: 'safe',
    });
    fallback.save.details.mode = 'fallback';
    fallback.save.details.retryCount = TOPOLOGY_CONFIG.maximumGenerationAttempts;
    fallback.save.details.validationErrors = Object.keys(rejectionCounts);
    candidates.push({
      id: `${roomSeed}:fallback`,
      save: fallback.save,
      archetype: 'safe-fallback',
      featureVector: { ...fallback.feature, fallbackUsed: true },
    });
  }

  return {
    poolId: createSharedPoolIdV4(candidates),
    roomSeed,
    requestedCandidateCount: TOPOLOGY_CONFIG.requestedCandidateCount,
    validCandidateCount,
    rejectedCandidateCount,
    rejectionCounts,
    fallbackUsed,
    candidates,
  };
}

function chooseFromPool(
  request: GenerationRequest,
  pool: SharedCandidatePoolV4,
): RoomSelectionDecision {
  if (request.selectorId === 'neutral-procedural') {
    return selectNeutralRoom(pool.candidates, {
      sharedPoolId: pool.poolId,
      selectionSeed: pool.roomSeed,
      recentArchetypes: request.recentArchetypes,
    });
  }
  return selectRuleBasedRoom(pool.candidates, {
    sharedPoolId: pool.poolId,
    selectionSeed: pool.roomSeed,
    profile: request.effectiveProfile,
    mode: request.mode,
    recentDamage: request.recovery?.recentGeneratedDamage.reduce((sum, value) => sum + value, 0),
  });
}

export function generateDungeonRoomV4(
  request: GenerationRequest,
  validator: typeof validateGeneratedRoomV3 = validateGeneratedRoomV3,
): GeneratedRoomSave {
  const pool = buildSharedCandidatePoolV4(request, validator);
  const decision = chooseFromPool(request, pool);
  const selected = pool.candidates.find(
    (candidate) => candidate.id === decision.selectedCandidateId,
  )!;
  const save = selected.save;
  const effectiveMode = decision.selectorId === 'rules-adaptive' ? request.mode : 'reinforce';
  save.adaptiveInput = { ...save.adaptiveInput, mode: effectiveMode };
  save.details = {
    ...save.details,
    mode: pool.fallbackUsed ? 'fallback' : effectiveMode,
    requestedCandidateCount: pool.requestedCandidateCount,
    validCandidateCount: pool.validCandidateCount,
    rejectedCandidateCount: pool.rejectedCandidateCount,
    reducedDiversity: decision.reducedDiversity,
    fallbackUsed: pool.fallbackUsed,
    challengedTraits: decision.challengedTraits,
    selectedCandidateId: decision.selectedCandidateId,
    selectedCandidateRank: decision.selectedCandidateRank,
    ...(decision.selectedScore === null ? {} : { selectedCandidateScore: decision.selectedScore }),
    seededSelectionRoll: decision.deterministicRoll,
    topCandidates: decision.topCandidates,
    rejectionCounts: pool.rejectionCounts,
    sharedPoolId: pool.poolId,
    selectorId: decision.selectorId,
    selectorVersion: decision.selectorVersion,
    selectorProfileConsumed: decision.profileConsumed,
    selectorExplanation: decision.explanationTokens,
    reasons: [
      ...save.details.reasons,
      ...decision.explanationTokens,
      `Shared candidate pool ${pool.poolId}`,
      `Selected rank ${decision.selectedCandidateRank} of ${pool.candidates.length}`,
    ],
  };
  return save;
}

export type Generator4Archetype = Exclude<RoomArchetype, 'safe-fallback'>;
