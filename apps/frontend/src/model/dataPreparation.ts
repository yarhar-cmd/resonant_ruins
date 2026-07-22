import { ResearchExportSchema } from '../research/schemas';
import type {
  DifficultyRating,
  ResearchExport,
  ResearchSession,
  RoomResearchRecord,
} from '../types/research';
import { assertValidModelSemanticFeatures, buildModelSemanticFeatures } from './featureBuilder';
import {
  MODEL_FEATURE_MANIFEST,
  MODEL_FEATURE_SCHEMA_VERSION,
  MODEL_TARGET_CLASSES,
  type ModelCategoricalFeatureName,
  type ModelSemanticFeatures,
  type ModelTargetClass,
} from './featureManifest';
import {
  advanceRecentRatingAccumulator,
  createRecentRatingAccumulator,
  deriveRecentRatingFeatures,
} from './recentRatings';

export const MODEL_DATASET_SCHEMA_VERSION = 'model-dataset-1' as const;

export const MODEL_TRAINING_THRESHOLDS = Object.freeze({
  ratedOfficialRooms: 100,
  independentGroups: 5,
  labelsPerClass: 10,
});

export interface ModelPreparationConfig {
  includePilot: boolean;
  compatibleGameVersions: readonly ['mvp-0.4', 'mvp-0.5'];
  compatibleGeneratorVersion: 'generator-4';
  compatibleAdaptationVersion: 'rules-2';
}

export const DEFAULT_MODEL_PREPARATION_CONFIG: ModelPreparationConfig = Object.freeze({
  includePilot: false,
  compatibleGameVersions: ['mvp-0.4', 'mvp-0.5'] as const,
  compatibleGeneratorVersion: 'generator-4',
  compatibleAdaptationVersion: 'rules-2',
} satisfies ModelPreparationConfig);

export interface PreparedModelRow {
  roomDecisionId: string;
  groupId: string;
  label: ModelTargetClass;
  features: ModelSemanticFeatures;
  analysis: {
    condition: 'RULES_ADAPTIVE' | 'NEUTRAL_PROCEDURAL';
    experiencePreset: ModelSemanticFeatures['experiencePreset'];
    archetype: ModelSemanticFeatures['archetype'];
    sessionRoomOrdinal: number;
  };
}

export interface ModelReadinessReport {
  readyForOfficialTraining: boolean;
  reasons: string[];
  thresholds: typeof MODEL_TRAINING_THRESHOLDS;
}

export interface PreparedModelDataset {
  datasetSchemaVersion: typeof MODEL_DATASET_SCHEMA_VERSION;
  featureSchemaVersion: typeof MODEL_FEATURE_SCHEMA_VERSION;
  datasetId: string;
  datasetFingerprint: string;
  preparationConfig: ModelPreparationConfig;
  rows: PreparedModelRow[];
  quality: {
    inputExports: number;
    includedSessions: number;
    excludedPilotSessions: number;
    discoveredRoomRecords: number;
    uniqueRoomRecords: number;
    ratedRows: number;
    unlabeledRooms: number;
    duplicateRoomDecisionIds: string[];
    conflictingRoomDecisionIds: string[];
    unsupportedRecords: number;
    rejectedFeatureRows: number;
    classCounts: Record<ModelTargetClass, number>;
    groupCount: number;
    conditionCounts: Record<'RULES_ADAPTIVE' | 'NEUTRAL_PROCEDURAL', number>;
  };
  readiness: ModelReadinessReport;
}

interface DiscoveredRecord {
  session: ResearchSession;
  runIndex: number;
  record: RoomResearchRecord;
  privateGroupIdentity: string;
}

const FORBIDDEN_MODEL_FIELDS = new Set([
  'difficulty',
  'fairness',
  'enjoyment',
  'profileAfter',
  'durationMs',
  'damageTaken',
  'healthAfter',
  'status',
  'chosenExitId',
  'ratsDefeated',
  'fountainUsed',
  'runeContacts',
  'swordAttacks',
  'blocks',
  'condition',
  'selectedScore',
  'selectedRank',
  'explanationTokens',
  'participantCode',
  'researchSessionId',
  'runId',
]);

function stableCanonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableCanonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableCanonicalize(item)]),
    );
  }
  return value;
}

export function stableModelJson(value: unknown): string {
  return JSON.stringify(stableCanonicalize(value));
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function assertFeatureAllowlist(): void {
  for (const feature of MODEL_FEATURE_MANIFEST.semanticFeatureOrder) {
    if (FORBIDDEN_MODEL_FIELDS.has(feature)) {
      throw new Error(`Forbidden target-leakage field in model allowlist: ${feature}`);
    }
  }
}

function assertCategoricalCompatibility(features: ModelSemanticFeatures): void {
  for (const [name, vocabulary] of Object.entries(MODEL_FEATURE_MANIFEST.categoricalFeatures)) {
    const value = features[name as ModelCategoricalFeatureName];
    if (!vocabulary.includes(String(value))) {
      throw new Error(`Unknown ${name} category: ${String(value)}`);
    }
  }
}

function recordSort(left: DiscoveredRecord, right: DiscoveredRecord): number {
  return (
    left.session.startedAt.localeCompare(right.session.startedAt) ||
    left.runIndex - right.runIndex ||
    left.record.roomSequence - right.record.roomSequence ||
    left.record.capturedAt.localeCompare(right.record.capturedAt) ||
    left.record.roomDecisionId.localeCompare(right.record.roomDecisionId)
  );
}

function createReadinessReport(
  ratedRows: number,
  groupCount: number,
  classCounts: Record<ModelTargetClass, number>,
  conflicts: number,
  unsupportedRecords: number,
  rejectedFeatureRows: number,
): ModelReadinessReport {
  const reasons: string[] = [];
  if (ratedRows < MODEL_TRAINING_THRESHOLDS.ratedOfficialRooms)
    reasons.push(
      `Requires ${MODEL_TRAINING_THRESHOLDS.ratedOfficialRooms} rated Official rooms; found ${ratedRows}.`,
    );
  if (groupCount < MODEL_TRAINING_THRESHOLDS.independentGroups)
    reasons.push(
      `Requires ${MODEL_TRAINING_THRESHOLDS.independentGroups} groups; found ${groupCount}.`,
    );
  for (const label of MODEL_TARGET_CLASSES) {
    if (classCounts[label] < MODEL_TRAINING_THRESHOLDS.labelsPerClass)
      reasons.push(
        `Requires ${MODEL_TRAINING_THRESHOLDS.labelsPerClass} ${label} labels; found ${classCounts[label]}.`,
      );
  }
  if (conflicts > 0) reasons.push('Conflicting duplicate room decisions must be resolved.');
  if (unsupportedRecords > 0)
    reasons.push('Unsupported source versions or categories are present.');
  if (rejectedFeatureRows > 0) reasons.push('One or more rated rows has invalid model features.');
  return {
    readyForOfficialTraining: reasons.length === 0,
    reasons,
    thresholds: MODEL_TRAINING_THRESHOLDS,
  };
}

export async function prepareResearchExports(
  values: readonly unknown[],
  config: ModelPreparationConfig = DEFAULT_MODEL_PREPARATION_CONFIG,
): Promise<PreparedModelDataset> {
  assertFeatureAllowlist();
  const exports = values.map((value, index) => {
    const parsed = ResearchExportSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(
        `Research export ${index + 1} is invalid: ${parsed.error.issues[0]?.message ?? 'unknown schema error'}`,
      );
    }
    return parsed.data as ResearchExport;
  });

  const allSessions = exports.flatMap((item) => item.sessions);
  const includedSessions = allSessions.filter((session) => config.includePilot || !session.pilot);
  const discovered: DiscoveredRecord[] = includedSessions.flatMap((session) =>
    session.runs.flatMap((run) =>
      run.rooms.map((record) => ({
        session,
        runIndex: run.runIndex,
        record,
        privateGroupIdentity: session.participantCode
          ? `participant:${session.participantCode}`
          : `session:${session.id}`,
      })),
    ),
  );

  const byDecision = new Map<string, DiscoveredRecord>();
  const canonicalByDecision = new Map<string, string>();
  const duplicateIds = new Set<string>();
  const conflictIds = new Set<string>();
  for (const item of [...discovered].sort(recordSort)) {
    const canonical = stableModelJson(item.record);
    const previous = canonicalByDecision.get(item.record.roomDecisionId);
    if (previous === undefined) {
      canonicalByDecision.set(item.record.roomDecisionId, canonical);
      byDecision.set(item.record.roomDecisionId, item);
    } else if (previous === canonical) {
      duplicateIds.add(item.record.roomDecisionId);
    } else {
      conflictIds.add(item.record.roomDecisionId);
      byDecision.delete(item.record.roomDecisionId);
    }
  }

  const uniqueRecords = [...byDecision.values()].filter(
    (item) => !conflictIds.has(item.record.roomDecisionId),
  );
  const groupIdentities = [...new Set(uniqueRecords.map((item) => item.privateGroupIdentity))];
  const hashedGroups = await Promise.all(
    groupIdentities.map(async (identity) => ({
      identity,
      hash: await sha256(`model-group-v1\0${identity}`),
    })),
  );
  hashedGroups.sort((left, right) => left.hash.localeCompare(right.hash));
  const groupLabels = new Map(
    hashedGroups.map(({ identity }, index) => [
      identity,
      `group-${String(index + 1).padStart(4, '0')}`,
    ]),
  );

  const rows: PreparedModelRow[] = [];
  let unlabeledRooms = 0;
  let unsupportedRecords = 0;
  let rejectedFeatureRows = 0;
  const bySession = new Map<string, DiscoveredRecord[]>();
  for (const item of uniqueRecords) {
    const records = bySession.get(item.record.researchSessionId) ?? [];
    records.push(item);
    bySession.set(item.record.researchSessionId, records);
  }
  for (const sessionRecords of bySession.values()) {
    const ratingHistory = createRecentRatingAccumulator();
    const previousDurations: number[] = [];
    let roomsCompleted = 0;
    let sessionRoomOrdinal = 0;
    for (const item of sessionRecords.sort(recordSort)) {
      sessionRoomOrdinal += 1;
      const record = item.record;
      const compatible =
        config.compatibleGameVersions.includes(record.gameVersion) &&
        record.generatorVersion === config.compatibleGeneratorVersion &&
        record.adaptationVersion === config.compatibleAdaptationVersion;
      const recentRatings = deriveRecentRatingFeatures(ratingHistory);
      const durationWindow = previousDurations.slice(-3);
      const label = record.feedback.status === 'submitted' ? record.feedback.difficulty : null;

      if (!compatible) unsupportedRecords += 1;
      if (label === null) {
        unlabeledRooms += 1;
      } else if (compatible) {
        try {
          const features = buildModelSemanticFeatures(
            {
              profileForRoom: record.profileBefore,
              healthBefore: record.healthBefore,
              maximumHealth: record.maximumHealth,
              recentDamage: record.performance.recentDamage,
              recentAverageRoomDuration:
                durationWindow.length > 0
                  ? durationWindow.reduce((sum, value) => sum + value, 0) / durationWindow.length
                  : 0,
              recentDurationRoomCount: durationWindow.length,
              roomsCompletedInSession: roomsCompleted,
              experiencePreset: record.experiencePreset,
              incomingEntranceDirection: record.incomingEntranceDirection,
              recentRatings,
            },
            {
              featureVector: record.selectedFeatureVector,
              fountainPlacement: record.fountainPlacement ?? 'none',
            },
          );
          assertValidModelSemanticFeatures(features);
          assertCategoricalCompatibility(features);
          rows.push({
            roomDecisionId: record.roomDecisionId,
            groupId: groupLabels.get(item.privateGroupIdentity)!,
            label,
            features,
            analysis: {
              condition: record.condition,
              experiencePreset: record.experiencePreset,
              archetype: record.archetype,
              sessionRoomOrdinal,
            },
          });
        } catch {
          rejectedFeatureRows += 1;
        }
      }

      if (record.outcome.status === 'completed') {
        previousDurations.push(record.outcome.durationMs);
        roomsCompleted += 1;
      }
      const advanced = advanceRecentRatingAccumulator(ratingHistory, record);
      ratingHistory.submittedRatings = advanced.submittedRatings;
      ratingHistory.roomsSinceLastSubmittedDifficultyRating =
        advanced.roomsSinceLastSubmittedDifficultyRating;
    }
  }

  rows.sort((left, right) => left.roomDecisionId.localeCompare(right.roomDecisionId));
  const classCounts = Object.fromEntries(
    MODEL_TARGET_CLASSES.map((label) => [label, rows.filter((row) => row.label === label).length]),
  ) as Record<ModelTargetClass, number>;
  const conditionCounts = {
    RULES_ADAPTIVE: rows.filter((row) => row.analysis.condition === 'RULES_ADAPTIVE').length,
    NEUTRAL_PROCEDURAL: rows.filter((row) => row.analysis.condition === 'NEUTRAL_PROCEDURAL')
      .length,
  };
  const fingerprintInput = {
    datasetSchemaVersion: MODEL_DATASET_SCHEMA_VERSION,
    featureSchemaVersion: MODEL_FEATURE_SCHEMA_VERSION,
    preparationConfig: config,
    duplicateRoomDecisionIds: [...duplicateIds].sort(),
    conflictingRoomDecisionIds: [...conflictIds].sort(),
    rows: rows.map(({ roomDecisionId, groupId, label, features }) => ({
      roomDecisionId,
      groupId,
      label,
      features: MODEL_FEATURE_MANIFEST.semanticFeatureOrder.map((name) => features[name]),
    })),
  };
  const datasetFingerprint = await sha256(stableModelJson(fingerprintInput));
  const groupCount = new Set(rows.map((row) => row.groupId)).size;
  const readiness = createReadinessReport(
    rows.length,
    groupCount,
    classCounts,
    conflictIds.size,
    unsupportedRecords,
    rejectedFeatureRows,
  );

  return {
    datasetSchemaVersion: MODEL_DATASET_SCHEMA_VERSION,
    featureSchemaVersion: MODEL_FEATURE_SCHEMA_VERSION,
    datasetId: `model-data-${datasetFingerprint.slice(0, 16)}`,
    datasetFingerprint,
    preparationConfig: config,
    rows,
    quality: {
      inputExports: exports.length,
      includedSessions: includedSessions.length,
      excludedPilotSessions: allSessions.length - includedSessions.length,
      discoveredRoomRecords: discovered.length,
      uniqueRoomRecords: uniqueRecords.length,
      ratedRows: rows.length,
      unlabeledRooms,
      duplicateRoomDecisionIds: [...duplicateIds].sort(),
      conflictingRoomDecisionIds: [...conflictIds].sort(),
      unsupportedRecords,
      rejectedFeatureRows,
      classCounts,
      groupCount,
      conditionCounts,
    },
    readiness,
  };
}

export function parseResearchExportForPreparation(value: unknown): ResearchExport {
  return ResearchExportSchema.parse(value) as ResearchExport;
}

export function isDifficultyRating(value: unknown): value is DifficultyRating {
  return MODEL_TARGET_CLASSES.includes(value as ModelTargetClass);
}
