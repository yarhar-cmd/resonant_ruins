import { createHash, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import { ResearchSessionSchema } from '../../apps/frontend/src/research/schemas.js';
import type { ResearchSession } from '../../apps/frontend/src/types/research.js';

export const MAX_RESEARCH_BODY_BYTES = 1024 * 1024;

export type ReceiptStatus = 'saved' | 'identical_duplicate' | 'conflict' | 'rejected';

export interface ResearchReceipt {
  researchSessionId: string;
  status: ReceiptStatus;
  payloadSha256: string | null;
  receivedAt: string;
  serverRecordId: string | null;
  message: string;
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalPayloadHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function safeSecretMatches(
  actual: string | undefined,
  expected: string | undefined,
): boolean {
  if (!actual || !expected) return false;
  const actualHash = createHash('sha256').update(actual).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function validateResearchSession(input: unknown): ResearchSession {
  return ResearchSessionSchema.parse(input) as ResearchSession;
}

export interface StoredResearchSession {
  id: string;
  payloadSha256: string;
  payload: ResearchSession;
  uploadedAt: Date;
}

export interface ResearchRepository {
  find(id: string): Promise<StoredResearchSession | null>;
  insert(session: ResearchSession, hash: string, sourceDeviceLabel: string | null): Promise<string>;
  list(filters: ResearchExportFilters): Promise<StoredResearchSession[]>;
  recordIdenticalRetry(id: string): Promise<void>;
}

export interface ResearchExportFilters {
  pilot?: boolean;
  completionStatus?: 'active' | 'complete' | 'incomplete';
  uploadedFrom?: string;
  uploadedTo?: string;
  gameVersion?: string;
  protocolId?: string;
}

let pool: Pool | undefined;

function databasePool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    max: 3,
  });
  return pool;
}

export class PostgresResearchRepository implements ResearchRepository {
  async find(id: string): Promise<StoredResearchSession | null> {
    const result = await databasePool().query(
      `select research_session_id, payload_sha256, payload_json, uploaded_at
       from research_sessions where research_session_id = $1`,
      [id],
    );
    if (!result.rows[0]) return null;
    return {
      id: result.rows[0].research_session_id,
      payloadSha256: result.rows[0].payload_sha256,
      payload: result.rows[0].payload_json,
      uploadedAt: result.rows[0].uploaded_at,
    };
  }

  async insert(session: ResearchSession, hash: string, sourceDeviceLabel: string | null) {
    const completionStatus =
      session.completionStatus ?? (session.status === 'ended' ? 'complete' : 'active');
    const result = await databasePool().query(
      `insert into research_sessions (
         research_session_id, participant_code, participant_sequence, pilot, protocol_id,
         completion_status, selected_preset, game_version, research_schema_version,
         started_at, ended_at, payload_sha256, source_device_label, payload_json
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning id`,
      [
        session.id,
        session.participantCode,
        session.participantSequence ?? null,
        session.pilot,
        session.protocolId ?? null,
        completionStatus,
        session.lockedExperiencePreset ?? null,
        session.runs.flatMap((run) => run.rooms)[0]?.gameVersion ?? null,
        session.researchSchemaVersion,
        session.startedAt,
        session.endedAt,
        hash,
        sourceDeviceLabel,
        session,
      ],
    );
    return String(result.rows[0].id);
  }

  async recordIdenticalRetry(id: string) {
    await databasePool().query(
      `update research_sessions
       set identical_retry_count = identical_retry_count + 1, last_attempted_at = now()
       where research_session_id = $1`,
      [id],
    );
  }

  async list(filters: ResearchExportFilters) {
    const clauses: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      clauses.push(sql.replace('?', `$${values.length}`));
    };
    if (filters.pilot !== undefined) add('pilot = ?', filters.pilot);
    if (filters.completionStatus) add('completion_status = ?', filters.completionStatus);
    if (filters.uploadedFrom) add('uploaded_at >= ?', filters.uploadedFrom);
    if (filters.uploadedTo) add('uploaded_at <= ?', filters.uploadedTo);
    if (filters.gameVersion) add('game_version = ?', filters.gameVersion);
    if (filters.protocolId) add('protocol_id = ?', filters.protocolId);
    const result = await databasePool().query(
      `select research_session_id, payload_sha256, payload_json, uploaded_at
       from research_sessions ${clauses.length ? `where ${clauses.join(' and ')}` : ''}
       order by uploaded_at asc, research_session_id asc`,
      values,
    );
    return result.rows.map((row) => ({
      id: row.research_session_id,
      payloadSha256: row.payload_sha256,
      payload: row.payload_json,
      uploadedAt: row.uploaded_at,
    }));
  }
}

export async function saveResearchSession(
  input: unknown,
  repository: ResearchRepository,
  sourceDeviceLabel: string | null = null,
  now = new Date(),
): Promise<ResearchReceipt> {
  const session = validateResearchSession(input);
  const hash = canonicalPayloadHash(session);
  const existing = await repository.find(session.id);
  if (existing) {
    if (existing.payloadSha256 === hash) {
      await repository.recordIdenticalRetry(session.id);
      return {
        researchSessionId: session.id,
        status: 'identical_duplicate',
        payloadSha256: hash,
        receivedAt: now.toISOString(),
        serverRecordId: existing.id,
        message: 'This exact session was already collected. The local copy remains available.',
      };
    }
    return {
      researchSessionId: session.id,
      status: 'conflict',
      payloadSha256: hash,
      receivedAt: now.toISOString(),
      serverRecordId: existing.id,
      message: 'The server already contains different evidence for this session ID.',
    };
  }
  let recordId: string;
  try {
    recordId = await repository.insert(session, hash, sourceDeviceLabel);
  } catch (error) {
    if ((error as { code?: string }).code !== '23505') throw error;
    const raced = await repository.find(session.id);
    if (!raced || raced.payloadSha256 !== hash) {
      return {
        researchSessionId: session.id,
        status: 'conflict',
        payloadSha256: hash,
        receivedAt: now.toISOString(),
        serverRecordId: raced?.id ?? null,
        message: 'The server already contains different evidence for this session ID.',
      };
    }
    await repository.recordIdenticalRetry(session.id);
    return {
      researchSessionId: session.id,
      status: 'identical_duplicate',
      payloadSha256: hash,
      receivedAt: now.toISOString(),
      serverRecordId: raced.id,
      message: 'This exact session was already collected. The local copy remains available.',
    };
  }
  return {
    researchSessionId: session.id,
    status: 'saved',
    payloadSha256: hash,
    receivedAt: now.toISOString(),
    serverRecordId: recordId,
    message: 'Session collected. The local copy remains the authoritative backup.',
  };
}
