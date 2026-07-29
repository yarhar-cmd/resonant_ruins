import { z } from 'zod';
import type { ResearchExport, ResearchSession } from '../types/research';
import { ResearchExportSchema } from '../research/schemas';

export const RESEARCH_SYNC_STORAGE_KEY = 'resonant-ruins:research-sync:v1';

export type ResearchSyncStatus =
  'local_only' | 'upload_pending' | 'synced' | 'identical_duplicate' | 'conflict' | 'upload_failed';

const ReceiptSchema = z.object({
  researchSessionId: z.string().min(1),
  status: z.enum(['saved', 'identical_duplicate', 'conflict', 'rejected']),
  payloadSha256: z.string().length(64).nullable(),
  receivedAt: z.string().datetime(),
  serverRecordId: z.string().nullable(),
  message: z.string(),
});

export type ResearchSyncReceipt = z.infer<typeof ReceiptSchema>;

export interface ResearchSyncState {
  status: ResearchSyncStatus;
  lastAttemptAt: string | null;
  lastReceipt: ResearchSyncReceipt | null;
  message: string | null;
}

type ResearchSyncEnvelope = Record<string, ResearchSyncState>;

const initialState = (): ResearchSyncState => ({
  status: 'local_only',
  lastAttemptAt: null,
  lastReceipt: null,
  message: null,
});

export function loadResearchSyncStates(
  storage: Storage = window.localStorage,
): ResearchSyncEnvelope {
  try {
    const parsed = JSON.parse(storage.getItem(RESEARCH_SYNC_STORAGE_KEY) ?? '{}') as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as ResearchSyncEnvelope)
      : {};
  } catch {
    return {};
  }
}

export function researchSyncState(sessionId: string, storage?: Storage): ResearchSyncState {
  return loadResearchSyncStates(storage)[sessionId] ?? initialState();
}

export function saveResearchSyncState(
  sessionId: string,
  state: ResearchSyncState,
  storage: Storage = window.localStorage,
) {
  const states = loadResearchSyncStates(storage);
  storage.setItem(RESEARCH_SYNC_STORAGE_KEY, JSON.stringify({ ...states, [sessionId]: state }));
}

export function pendingSyncState(now = new Date()): ResearchSyncState {
  return {
    status: 'upload_pending',
    lastAttemptAt: now.toISOString(),
    lastReceipt: null,
    message: null,
  };
}

export function receiptSyncState(
  receipt: ResearchSyncReceipt,
  attemptedAt: string,
): ResearchSyncState {
  return {
    status:
      receipt.status === 'saved'
        ? 'synced'
        : receipt.status === 'identical_duplicate'
          ? 'identical_duplicate'
          : receipt.status === 'conflict'
            ? 'conflict'
            : 'upload_failed',
    lastAttemptAt: attemptedAt,
    lastReceipt: receipt,
    message: receipt.message,
  };
}

export function failedSyncState(previous: ResearchSyncState, message: string): ResearchSyncState {
  return { ...previous, status: 'upload_failed', message };
}

export async function uploadResearchSession(
  session: ResearchSession,
  uploadKey: string,
  signal?: AbortSignal,
): Promise<ResearchSyncReceipt> {
  const response = await fetch('/api/research/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Research-Upload-Key': uploadKey },
    body: JSON.stringify(session),
    signal,
  });
  const value = (await response.json()) as unknown;
  const parsed = ReceiptSchema.safeParse(value);
  if (!parsed.success) {
    const error = value as { error?: string };
    throw new Error(error.error ?? `Upload failed with HTTP ${response.status}.`);
  }
  if (!response.ok && parsed.data.status !== 'conflict') throw new Error(parsed.data.message);
  return parsed.data;
}

export async function fetchResearchExport(
  adminToken: string,
  filters: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<ResearchExport> {
  const query = new URLSearchParams(
    Object.entries(filters).filter((entry) => entry[1] !== ''),
  ).toString();
  const response = await fetch(`/api/research/export${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    signal,
  });
  const value = (await response.json()) as unknown;
  if (!response.ok) throw new Error((value as { error?: string }).error ?? 'Server import failed.');
  return ResearchExportSchema.parse(value) as ResearchExport;
}
