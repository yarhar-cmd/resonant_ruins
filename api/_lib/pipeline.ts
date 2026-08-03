import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalPayloadHash, validateResearchSession, type ResearchReceipt } from './research.js';
import type { ResearchSession } from '../../apps/frontend/src/types/research.js';
import { researchPool } from './database.js';

export type StudyMode = 'pilot' | 'official';
export type ReviewStatus = 'pending_review' | 'approved' | 'quarantined' | 'rejected';
export const ACCESS_CODE_PATTERN = /^RR-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/;

export function normalizeAccessCode(code: string): string {
  return code.trim().toUpperCase();
}

export function generateAccessCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(15);
  const value = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
  return `RR-${value.slice(0, 5)}-${value.slice(5, 10)}-${value.slice(10)}`;
}

export function generateUploadToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashCredential(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export interface GeneratedAccessCode {
  code: string;
  participantCode: string;
  participantSequence: number;
  studyMode: StudyMode;
  expiresAt: string | null;
}

export async function createAccessCodes(input: {
  count: number;
  firstSequence: number;
  studyMode: StudyMode;
  expiresAt?: string | null;
  createdByLabel?: string | null;
  internalNote?: string | null;
}): Promise<GeneratedAccessCode[]> {
  if (!Number.isSafeInteger(input.count) || input.count < 1 || input.count > 500)
    throw new Error('Count must be between 1 and 500.');
  if (!Number.isSafeInteger(input.firstSequence) || input.firstSequence < 1)
    throw new Error('First sequence must be a positive integer.');
  const client = await researchPool().connect();
  const generated: GeneratedAccessCode[] = [];
  try {
    await client.query('begin');
    for (let offset = 0; offset < input.count; offset += 1) {
      const sequence = input.firstSequence + offset;
      const code = generateAccessCode();
      const participantCode = `RR-${String(sequence).padStart(4, '0')}`;
      await client.query(
        `insert into research_access_codes
          (code_hash, participant_code, participant_sequence, study_mode, expires_at,
           created_by_label, internal_note)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          hashCredential(code),
          participantCode,
          sequence,
          input.studyMode,
          input.expiresAt ?? null,
          input.createdByLabel ?? null,
          input.internalNote ?? null,
        ],
      );
      generated.push({
        code,
        participantCode,
        participantSequence: sequence,
        studyMode: input.studyMode,
        expiresAt: input.expiresAt ?? null,
      });
    }
    await client.query('commit');
    return generated;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

const INVALID_CODE = 'This study access code cannot be used.';

export async function claimAccessCode(code: string, sessionId: string, recoverySecret: string) {
  if (
    !sessionId ||
    sessionId.length > 128 ||
    recoverySecret.length < 32 ||
    !ACCESS_CODE_PATTERN.test(normalizeAccessCode(code))
  )
    throw new Error(INVALID_CODE);
  const client = await researchPool().connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `select id, participant_code, participant_sequence, study_mode, status,
              reserved_session_id, claim_recovery_hash, expires_at
       from research_access_codes where code_hash = $1 for update`,
      [hashCredential(normalizeAccessCode(code))],
    );
    const row = result.rows[0];
    const expired = row?.expires_at && new Date(row.expires_at).getTime() <= Date.now();
    const safeRecovery =
      row?.status === 'reserved' &&
      row.reserved_session_id === sessionId &&
      row.claim_recovery_hash === hashCredential(recoverySecret);
    if (!row || expired || (row.status !== 'active' && !safeRecovery)) {
      await client.query('rollback');
      throw new Error(INVALID_CODE);
    }
    const token = generateUploadToken();
    await client.query(
      `update research_access_codes set status='reserved', reserved_session_id=$1,
         upload_token_hash=$2, claim_recovery_hash=$3,
         reserved_at=coalesce(reserved_at,now()) where id=$4`,
      [sessionId, hashCredential(token), hashCredential(recoverySecret), row.id],
    );
    await client.query('commit');
    return {
      participantCode: row.participant_code as string,
      participantSequence: row.participant_sequence as number,
      studyMode: row.study_mode as StudyMode,
      uploadToken: token,
      researchSessionId: sessionId,
    };
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      /* transaction already closed */
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function saveAuthorizedSession(
  input: unknown,
  token: string | undefined,
  now = new Date(),
): Promise<ResearchReceipt> {
  const session = validateResearchSession(input);
  const hash = canonicalPayloadHash(session);
  if (!token) throw new Error('Submission authorization is invalid.');
  const client = await researchPool().connect();
  try {
    await client.query('begin');
    const access = await client.query(
      `select id, status, reserved_session_id, participant_code, participant_sequence, study_mode
       from research_access_codes where upload_token_hash=$1 for update`,
      [hashCredential(token)],
    );
    const code = access.rows[0];
    if (
      !code ||
      code.reserved_session_id !== session.id ||
      (code.status !== 'reserved' && code.status !== 'consumed')
    )
      throw new Error('Submission authorization is invalid.');
    if (
      session.participantCode !== code.participant_code ||
      session.participantSequence !== code.participant_sequence ||
      session.pilot !== (code.study_mode === 'pilot')
    )
      throw new Error('Submission authorization does not match this session.');
    const existing = await client.query(
      'select id, payload_sha256 from research_sessions where research_session_id=$1',
      [session.id],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].payload_sha256 !== hash) {
        await client.query('rollback');
        return receipt(session.id, 'conflict', hash, String(existing.rows[0].id), now);
      }
      await client.query(
        `update research_sessions set identical_retry_count=identical_retry_count+1,
        last_attempted_at=now() where research_session_id=$1`,
        [session.id],
      );
      await client.query('commit');
      return receipt(session.id, 'identical_duplicate', hash, String(existing.rows[0].id), now);
    }
    const warnings = auditWarnings(session);
    const inserted = await insertSession(client, session, hash, warnings);
    await client.query(
      `insert into research_session_reviews
      (research_session_id, review_status, model_eligible) values ($1,'pending_review',false)`,
      [session.id],
    );
    await client.query(
      `update research_access_codes set status='consumed', consumed_at=now()
      where id=$1`,
      [code.id],
    );
    await client.query('commit');
    return receipt(session.id, 'saved', hash, String(inserted), now);
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      /* transaction already closed */
    }
    throw error;
  } finally {
    client.release();
  }
}

function auditWarnings(session: ResearchSession): string[] {
  const warnings: string[] = [];
  const rooms = session.runs.flatMap((run) => run.rooms);
  if (session.completionStatus !== 'complete') warnings.push('incomplete_flow');
  if (!session.participantSequence) warnings.push('missing_sequence');
  if (session.protocolId === 'fixed-pilot-1' && rooms.length !== 20)
    warnings.push('incorrect_room_count');
  if (session.sessionExit?.technicalProblem === 'yes') warnings.push('technical_problem_reported');
  return warnings;
}

async function insertSession(
  client: PoolClient,
  session: ResearchSession,
  hash: string,
  warnings: string[],
) {
  const completion =
    session.completionStatus ?? (session.status === 'ended' ? 'complete' : 'active');
  const result = await client.query(
    `insert into research_sessions
    (research_session_id,participant_code,participant_sequence,pilot,protocol_id,completion_status,
     selected_preset,game_version,research_schema_version,started_at,ended_at,payload_sha256,payload_json,
     data_quality_warnings)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
    [
      session.id,
      session.participantCode,
      session.participantSequence ?? null,
      session.pilot,
      session.protocolId ?? null,
      completion,
      session.lockedExperiencePreset ?? null,
      session.runs.flatMap((run) => run.rooms)[0]?.gameVersion ?? null,
      session.researchSchemaVersion,
      session.startedAt,
      session.endedAt,
      hash,
      session,
      warnings,
    ],
  );
  return result.rows[0].id as number;
}

function receipt(
  id: string,
  status: ResearchReceipt['status'],
  hash: string,
  recordId: string,
  now: Date,
): ResearchReceipt {
  const messages = {
    saved: 'Session collected. A local backup remains saved.',
    identical_duplicate: 'This exact session was already received. A local backup remains saved.',
    conflict: 'Different evidence already exists for this session ID.',
    rejected: 'Submission rejected.',
  };
  return {
    researchSessionId: id,
    status,
    payloadSha256: hash,
    receivedAt: now.toISOString(),
    serverRecordId: recordId,
    message: messages[status],
  };
}

export async function setReviewStatus(
  sessionId: string,
  status: ReviewStatus,
  reasonCode?: string | null,
) {
  const modelEligible = status === 'approved';
  await researchPool().query(
    `with changed as (
    update research_session_reviews set review_status=$2, model_eligible=$3, reason_code=$4,
      reviewed_at=now(), updated_at=now() where research_session_id=$1 returning *)
    insert into research_review_events(research_session_id,event_type,event_json)
      select $1,$2,jsonb_build_object('reasonCode',$4,'modelEligible',$3) from changed`,
    [sessionId, status, modelEligible, reasonCode ?? null],
  );
}

export async function approvedModelDataset(includePilot = false) {
  const result = await researchPool().query(
    `select s.research_session_id,s.payload_json,s.payload_sha256,
      coalesce(array_agg(rr.room_decision_id) filter(where rr.status='excluded_technical'),'{}') excluded_rooms
    from research_sessions s join research_session_reviews r using(research_session_id)
    left join research_room_reviews rr on rr.research_session_id=s.research_session_id
    where r.review_status='approved' and r.model_eligible=true and ($1 or s.pilot=false)
    group by s.research_session_id,s.payload_json,s.payload_sha256 order by s.research_session_id`,
    [includePilot],
  );
  const sessions = result.rows.map((row) => {
    const session = structuredClone(row.payload_json) as ResearchSession;
    const excluded = new Set(row.excluded_rooms as string[]);
    for (const run of session.runs)
      run.rooms = run.rooms.filter((room) => !excluded.has(room.roomDecisionId));
    return session;
  });
  const excludedRoomCount = result.rows.reduce(
    (sum, row) => sum + (row.excluded_rooms as string[]).length,
    0,
  );
  const manifestBase = {
    includedSessionIds: result.rows.map((row) => row.research_session_id as string),
    includedRoomCount: sessions.flatMap((s) => s.runs.flatMap((r) => r.rooms)).length,
    excludedSessionCount: 0,
    excludedRoomCount,
    excludedReasonCategories: excludedRoomCount ? { excluded_technical: excludedRoomCount } : {},
    schemaVersions: [...new Set(sessions.map((s) => s.researchSchemaVersion))],
    protocolVersions: [...new Set(sessions.map((s) => s.protocolId ?? 'none'))],
    filters: { reviewStatus: 'approved', modelEligible: true, includePilot },
  };
  return {
    sessions,
    manifest: {
      exportedAt: new Date().toISOString(),
      ...manifestBase,
      datasetSha256: canonicalPayloadHash(manifestBase),
    },
  };
}

export { randomUUID, researchPool };
