import { describe, expect, it } from 'vitest';
import {
  failedSyncState,
  loadResearchSyncStates,
  pendingSyncState,
  receiptSyncState,
  saveResearchSyncState,
} from './researchSync';

describe('research sync state', () => {
  it('stores sync metadata separately and transitions without evidence', () => {
    const storage = window.localStorage;
    const pending = pendingSyncState(new Date('2026-01-01T00:00:00.000Z'));
    saveResearchSyncState('session-1', pending, storage);
    expect(loadResearchSyncStates(storage)['session-1']?.status).toBe('upload_pending');

    const failed = failedSyncState(pending, 'offline');
    expect(failed.status).toBe('upload_failed');
    expect(failed.lastAttemptAt).toBe(pending.lastAttemptAt);

    const synced = receiptSyncState(
      {
        researchSessionId: 'session-1',
        status: 'saved',
        payloadSha256: 'a'.repeat(64),
        receivedAt: '2026-01-01T00:00:01.000Z',
        serverRecordId: 'record-1',
        message: 'saved',
      },
      pending.lastAttemptAt!,
    );
    expect(synced.status).toBe('synced');
  });
});
