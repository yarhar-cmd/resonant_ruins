import { describe, expect, it } from 'vitest';
import { researchFixture } from '../../apps/frontend/src/test/researchFixtures';
import {
  canonicalPayloadHash,
  safeSecretMatches,
  saveResearchSession,
  type ResearchRepository,
  type StoredResearchSession,
} from './research';
import {
  ACCESS_CODE_PATTERN,
  generateAccessCode,
  generateUploadToken,
  hashCredential,
} from './pipeline';
import { postgresPoolConfig } from './database';

class MemoryRepository implements ResearchRepository {
  records = new Map<string, StoredResearchSession>();
  retries = 0;

  async find(id: string) {
    return this.records.get(id) ?? null;
  }

  async insert(session: ReturnType<typeof researchFixture>['session'], hash: string) {
    this.records.set(session.id, {
      id: 'record-1',
      payloadSha256: hash,
      payload: structuredClone(session),
      uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    return 'record-1';
  }

  async list() {
    return [...this.records.values()];
  }

  async recordIdenticalRetry() {
    this.retries += 1;
  }
}

function validSession() {
  const fixture = researchFixture();
  fixture.session.status = 'ended';
  fixture.session.endedAt = '2026-01-01T00:01:00.000Z';
  fixture.run.status = 'completed';
  fixture.run.endedAt = '2026-01-01T00:01:00.000Z';
  fixture.run.rooms = [fixture.record];
  return fixture.session;
}

describe('research synchronization core', () => {
  it('uses a bounded transaction-pooler-compatible PostgreSQL client configuration', () => {
    const config = postgresPoolConfig('postgresql://example.invalid/database');
    expect(config).toMatchObject({ max: 3, allowExitOnIdle: true });
    expect(config).not.toHaveProperty('name');
  });

  it('generates high-entropy formatted access codes without embedding participant data', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateAccessCode()));
    expect(codes.size).toBe(1000);
    expect([...codes].every((code) => ACCESS_CODE_PATTERN.test(code))).toBe(true);
  });

  it('hashes access codes and upload tokens without plaintext persistence values', () => {
    const code = generateAccessCode();
    const token = generateUploadToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(hashCredential(code)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashCredential(code)).not.toContain(code);
    expect(hashCredential(token)).not.toContain(token);
  });
  it('hashes canonically regardless of object key order', () => {
    expect(canonicalPayloadHash({ b: 2, a: 1 })).toBe(canonicalPayloadHash({ a: 1, b: 2 }));
  });

  it('inserts once and treats an identical retry as success', async () => {
    const repository = new MemoryRepository();
    const session = validSession();
    expect((await saveResearchSession(session, repository)).status).toBe('saved');
    expect((await saveResearchSession(structuredClone(session), repository)).status).toBe(
      'identical_duplicate',
    );
    expect(repository.records.size).toBe(1);
    expect(repository.retries).toBe(1);
  });

  it('preserves the original when the same ID carries different evidence', async () => {
    const repository = new MemoryRepository();
    const session = validSession();
    await saveResearchSession(session, repository);
    const changed = structuredClone(session);
    changed.participantCode = 'CHANGED';
    expect((await saveResearchSession(changed, repository)).status).toBe('conflict');
    expect(repository.records.get(session.id)?.payload.participantCode).toBe('TEST_01');
  });

  it('rejects malformed or contradictory evidence before storage', async () => {
    const repository = new MemoryRepository();
    await expect(
      saveResearchSession({ ...validSession(), runs: [{ id: 'invalid' }] }, repository),
    ).rejects.toThrow();
    expect(repository.records.size).toBe(0);
  });

  it('compares upload and admin secrets without exposing either value', () => {
    expect(safeSecretMatches('test-key', 'test-key')).toBe(true);
    expect(safeSecretMatches('wrong', 'test-key')).toBe(false);
    expect(safeSecretMatches(undefined, 'test-key')).toBe(false);
  });
});
