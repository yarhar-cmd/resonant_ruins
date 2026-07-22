import { RESEARCH_ACTIVE_RUN_KEY, RESEARCH_SCHEMA_VERSION } from '../config/research';
import {
  PendingRoomFeedbackSchema,
  ResearchRoomStartSnapshotSchema,
  ShadowRoomEvidenceSchema,
} from '../research/schemas';
import type {
  PendingRoomFeedback,
  ResearchRoomStartSnapshot,
  ShadowRoomEvidence,
} from '../types/research';
import { parseActiveRunRecord, type ActiveRunRecord } from './activeRunStorage';

export interface ResearchActiveRunRecord {
  researchSchemaVersion: 'research-1';
  researchSessionId: string;
  researchRunId: string;
  gameplay: ActiveRunRecord;
  pendingFeedback: PendingRoomFeedback | null;
  roomStart: ResearchRoomStartSnapshot | null;
  pendingShadow: ShadowRoomEvidence | null;
}

export type ResearchActiveRunStorageIssue = 'invalid' | 'unavailable' | 'write-failed';

function resolveStorage(storage?: Storage): Storage {
  return storage ?? window.localStorage;
}

export function parseResearchActiveRun(value: unknown): ResearchActiveRunRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const gameplay = parseActiveRunRecord(candidate.gameplay);
  const pending =
    candidate.pendingFeedback === null
      ? null
      : PendingRoomFeedbackSchema.safeParse(candidate.pendingFeedback);
  const roomStart =
    candidate.roomStart === undefined || candidate.roomStart === null
      ? null
      : ResearchRoomStartSnapshotSchema.safeParse(candidate.roomStart);
  const pendingShadow =
    candidate.pendingShadow === undefined || candidate.pendingShadow === null
      ? null
      : ShadowRoomEvidenceSchema.safeParse(candidate.pendingShadow);
  if (
    candidate.researchSchemaVersion !== RESEARCH_SCHEMA_VERSION ||
    typeof candidate.researchSessionId !== 'string' ||
    !candidate.researchSessionId ||
    typeof candidate.researchRunId !== 'string' ||
    !candidate.researchRunId ||
    !gameplay ||
    (pending !== null && !pending.success) ||
    (roomStart !== null && !roomStart.success)
  )
    return null;
  return {
    researchSchemaVersion: RESEARCH_SCHEMA_VERSION,
    researchSessionId: candidate.researchSessionId,
    researchRunId: candidate.researchRunId,
    gameplay,
    pendingFeedback: pending === null ? null : (pending.data as PendingRoomFeedback),
    roomStart: roomStart === null ? null : (roomStart.data as ResearchRoomStartSnapshot),
    pendingShadow:
      pendingShadow === null || !pendingShadow.success
        ? null
        : (pendingShadow.data as ShadowRoomEvidence),
  };
}

export function loadResearchActiveRun(storage?: Storage): {
  record: ResearchActiveRunRecord | null;
  issue: Exclude<ResearchActiveRunStorageIssue, 'write-failed'> | null;
} {
  try {
    const raw = resolveStorage(storage).getItem(RESEARCH_ACTIVE_RUN_KEY);
    if (raw === null) return { record: null, issue: null };
    const record = parseResearchActiveRun(JSON.parse(raw) as unknown);
    return record ? { record, issue: null } : { record: null, issue: 'invalid' };
  } catch (error) {
    return { record: null, issue: error instanceof SyntaxError ? 'invalid' : 'unavailable' };
  }
}

export function saveResearchActiveRun(
  record: ResearchActiveRunRecord,
  storage?: Storage,
): ResearchActiveRunStorageIssue | null {
  if (!parseResearchActiveRun(record)) return 'invalid';
  try {
    resolveStorage(storage).setItem(RESEARCH_ACTIVE_RUN_KEY, JSON.stringify(record));
    return null;
  } catch {
    return 'write-failed';
  }
}

export function clearResearchActiveRun(storage?: Storage): ResearchActiveRunStorageIssue | null {
  try {
    resolveStorage(storage).removeItem(RESEARCH_ACTIVE_RUN_KEY);
    return null;
  } catch {
    return 'unavailable';
  }
}
