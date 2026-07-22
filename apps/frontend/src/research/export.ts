import { RESEARCH_SCHEMA_VERSION } from '../config/research';
import { ResearchExportSchema } from './schemas';
import type { ResearchExport, ResearchSession, RoomResearchRecord } from '../types/research';

export const RESEARCH_CSV_COLUMNS = [
  'research_schema_version',
  'feedback_schema_version',
  'session_id',
  'pilot',
  'participant_code',
  'run_id',
  'room_id',
  'room_decision_id',
  'room_sequence',
  'captured_at',
  'condition',
  'assignment_method_id',
  'game_version',
  'generator_version',
  'adaptation_version',
  'selector_id',
  'selector_version',
  'profile_consumed',
  'shared_pool_id',
  'requested_candidate_count',
  'valid_candidate_count',
  'rejected_candidate_count',
  'rejection_counts_json',
  'reduced_diversity',
  'fallback_used',
  'top_candidates_json',
  'selected_candidate_id',
  'selected_rank',
  'selected_score',
  'deterministic_roll',
  'explanation_tokens_json',
  'experience_preset',
  'health_before',
  'maximum_health',
  'health_after',
  'profile_before_json',
  'profile_after_json',
  'archetype',
  'boundary_family',
  'width',
  'height',
  'floor_area',
  'floor_ratio',
  'internal_wall_coverage',
  'open_floor_percentage',
  'loop_count',
  'branch_count',
  'articulation_point_count',
  'chokepoint_count',
  'dead_end_count',
  'exit_count',
  'exit_directions_json',
  'rune_count',
  'rat_count',
  'fountain_spawned',
  'fountain_placement',
  'safe_route_exists',
  'reward_system_version',
  'cache_eligible',
  'eligible_placement_count',
  'cache_spawn_roll',
  'cache_spawned',
  'cache_spawn_reason',
  'cache_coordinate_json',
  'cache_placement_category',
  'cache_optional_route_score',
  'cache_interaction_tile_count',
  'outcome_status',
  'duration_ms',
  'damage_taken',
  'rune_contacts',
  'rats_defeated',
  'sword_attacks',
  'blocks',
  'perfect_blocks',
  'shield_time_ms',
  'movement_steps',
  'blocked_movement',
  'floor_tiles_visited',
  'direction_changes',
  'chosen_exit_id',
  'outgoing_direction',
  'fountain_encountered',
  'fountain_used',
  'fountain_skipped',
  'cache_encountered',
  'cache_opened',
  'cache_skipped',
  'time_from_room_start_to_opening_ms',
  'health_when_cache_opened',
  'resonance_before',
  'resonance_after',
  'resonance_earned',
  'cache_channel_cancellation_reasons_json',
  'feedback_status',
  'difficulty',
  'fairness',
  'enjoyment',
  'skipped_fields_json',
  'full_dialog_skipped',
  'submitted_at',
  'response_duration_ms',
  'not_requested_reason',
] as const;

export function createResearchExport(
  sessions: ResearchSession[],
  scope: ResearchExport['scope'],
  exportedAt = new Date().toISOString(),
): ResearchExport {
  const researchExport: ResearchExport = {
    researchSchemaVersion: RESEARCH_SCHEMA_VERSION,
    exportedAt,
    scope,
    sessions,
  };
  const validated = ResearchExportSchema.safeParse(researchExport);
  if (!validated.success) throw new Error('Research data failed export validation.');
  return validated.data as ResearchExport;
}

export function researchExportJson(researchExport: ResearchExport): string {
  if (!ResearchExportSchema.safeParse(researchExport).success)
    throw new Error('Research data failed export validation.');
  return JSON.stringify(researchExport, null, 2);
}

function formulaSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = formulaSafe(
    typeof value === 'object' ? JSON.stringify(value) : String(value),
  );
  return /[",\r\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function roomRow(room: RoomResearchRecord): Record<(typeof RESEARCH_CSV_COLUMNS)[number], unknown> {
  const feature = room.selectedFeatureVector;
  const outcome = room.outcome;
  const feedback = room.feedback;
  return {
    research_schema_version: room.researchSchemaVersion,
    feedback_schema_version: room.feedbackSchemaVersion,
    session_id: room.researchSessionId,
    pilot: room.pilot,
    participant_code: room.participantCode,
    run_id: room.runId,
    room_id: room.roomId,
    room_decision_id: room.roomDecisionId,
    room_sequence: room.roomSequence,
    captured_at: room.capturedAt,
    condition: room.condition,
    assignment_method_id: room.assignmentMethodId,
    game_version: room.gameVersion,
    generator_version: room.generatorVersion,
    adaptation_version: room.adaptationVersion,
    selector_id: room.selectorId,
    selector_version: room.selectorVersion,
    profile_consumed: room.selectorProfileConsumed,
    shared_pool_id: room.sharedPoolId,
    requested_candidate_count: room.requestedCandidateCount,
    valid_candidate_count: room.validCandidateCount,
    rejected_candidate_count: room.rejectedCandidateCount,
    rejection_counts_json: room.rejectionCounts,
    reduced_diversity: room.reducedDiversity,
    fallback_used: room.fallbackUsed,
    top_candidates_json: room.topCandidates,
    selected_candidate_id: room.selectedCandidateId,
    selected_rank: room.selectedRank,
    selected_score: room.selectedScore,
    deterministic_roll: room.deterministicRoll,
    explanation_tokens_json: room.explanationTokens,
    experience_preset: room.experiencePreset,
    health_before: room.healthBefore,
    maximum_health: room.maximumHealth,
    health_after: outcome.healthAfter,
    profile_before_json: room.profileBefore,
    profile_after_json: room.profileAfter,
    archetype: room.archetype,
    boundary_family: room.boundaryFamily,
    width: feature.width,
    height: feature.height,
    floor_area: feature.floorArea,
    floor_ratio: feature.floorRatio,
    internal_wall_coverage: feature.internalWallCoverage,
    open_floor_percentage: feature.openFloorPercentage,
    loop_count: feature.loopCount,
    branch_count: feature.branchCount,
    articulation_point_count: feature.articulationPointCount,
    chokepoint_count: feature.oneTileChokepointCount,
    dead_end_count: feature.deadEndCount,
    exit_count: feature.exitCount,
    exit_directions_json: room.exitDirections,
    rune_count: feature.runeCount,
    rat_count: feature.ratCount,
    fountain_spawned: room.fountainSpawned,
    fountain_placement: room.fountainPlacement,
    safe_route_exists: room.safeRouteExists,
    reward_system_version: room.rewardSystemVersion,
    cache_eligible: room.cacheEligible,
    eligible_placement_count: room.eligiblePlacementCount,
    cache_spawn_roll: room.cacheSpawnRoll,
    cache_spawned: room.cacheSpawned,
    cache_spawn_reason: room.cacheSpawnReason,
    cache_coordinate_json: room.cacheCoordinate,
    cache_placement_category: room.cachePlacementCategory,
    cache_optional_route_score: room.cacheOptionalRouteScore,
    cache_interaction_tile_count: room.cacheInteractionTileCount,
    outcome_status: outcome.status,
    duration_ms: outcome.durationMs,
    damage_taken: outcome.damageTaken,
    rune_contacts: outcome.runeContacts,
    rats_defeated: outcome.ratsDefeated,
    sword_attacks: outcome.swordAttacks,
    blocks: outcome.blocks,
    perfect_blocks: outcome.perfectBlocks,
    shield_time_ms: outcome.shieldTimeMs,
    movement_steps: outcome.movementSteps,
    blocked_movement: outcome.blockedMovement,
    floor_tiles_visited: outcome.floorTilesVisited,
    direction_changes: outcome.directionChanges,
    chosen_exit_id: outcome.chosenExitId,
    outgoing_direction: outcome.outgoingDirection,
    fountain_encountered: outcome.fountainEncountered,
    fountain_used: outcome.fountainUsed,
    fountain_skipped: outcome.fountainSkipped,
    cache_encountered: outcome.cacheEncountered,
    cache_opened: outcome.cacheOpened,
    cache_skipped: outcome.cacheSkipped,
    time_from_room_start_to_opening_ms: outcome.timeFromRoomStartToOpeningMs,
    health_when_cache_opened: outcome.healthWhenCacheOpened,
    resonance_before: outcome.resonanceBefore,
    resonance_after: outcome.resonanceAfter,
    resonance_earned: outcome.resonanceEarned,
    cache_channel_cancellation_reasons_json: outcome.cacheChannelCancellationReasons,
    feedback_status: feedback.status,
    difficulty: feedback.difficulty,
    fairness: feedback.fairness,
    enjoyment: feedback.enjoyment,
    skipped_fields_json: feedback.skippedFields,
    full_dialog_skipped: feedback.fullDialogSkipped,
    submitted_at: feedback.submittedAt,
    response_duration_ms: feedback.responseDurationMs,
    not_requested_reason: feedback.notRequestedReason,
  };
}

export function researchExportCsv(researchExport: ResearchExport): string {
  if (!ResearchExportSchema.safeParse(researchExport).success)
    throw new Error('Research data failed export validation.');
  const rooms = researchExport.sessions.flatMap((session) =>
    session.runs.flatMap((run) => run.rooms),
  );
  return [
    RESEARCH_CSV_COLUMNS.join(','),
    ...rooms.map((room) => {
      const row = roomRow(room);
      return RESEARCH_CSV_COLUMNS.map((column) => csvCell(row[column])).join(',');
    }),
  ].join('\r\n');
}

export function researchExportFilename(input: {
  format: 'json' | 'csv';
  exportedAt: string;
  sessionId?: string;
}): string {
  const date = input.exportedAt.slice(0, 10);
  const safeSessionId = input.sessionId?.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  const scope = safeSessionId ? `session-${safeSessionId}` : 'all-sessions';
  return `resonant-ruins-research-${date}-${scope}.${input.format}`;
}

export function downloadResearchFile(filename: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
