import type { VercelRequest, VercelResponse } from '@vercel/node';
import { safeSecretMatches } from '../_lib/research.js';
import { randomUUID, researchPool, setReviewStatus, type ReviewStatus } from '../_lib/pipeline.js';
function auth(r: VercelRequest) {
  return safeSecretMatches(
    r.headers.authorization?.replace(/^Bearer\s+/i, ''),
    process.env.RESEARCH_ADMIN_TOKEN,
  );
}
export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (!auth(request))
    return response.status(401).json({ error: 'Missing or incorrect research admin token.' });
  try {
    if (request.method === 'GET') {
      const status = typeof request.query.status === 'string' ? request.query.status : null;
      const result = await researchPool().query(
        `select s.research_session_id,s.participant_code,s.participant_sequence,
        s.pilot,s.completion_status,s.uploaded_at,s.game_version,s.protocol_id,s.research_schema_version,
        s.data_quality_warnings,s.payload_json,r.review_status,r.model_eligible,r.reason_code,r.updated_at
        from research_sessions s join research_session_reviews r using(research_session_id)
        where ($1::text is null or r.review_status=$1) order by s.uploaded_at desc`,
        [status],
      );
      return response.status(200).json({ sessions: result.rows });
    }
    if (request.method === 'POST') {
      const b = request.body ?? {};
      if (b.action === 'status')
        await setReviewStatus(b.researchSessionId, b.status as ReviewStatus, b.reasonCode);
      else if (b.action === 'comment')
        await researchPool().query(
          `insert into research_review_comments
        (id,research_session_id,category,comment_text,researcher_label) values($1,$2,$3,$4,$5)`,
          [randomUUID(), b.researchSessionId, b.category, b.commentText, b.researcherLabel ?? null],
        );
      else if (b.action === 'room')
        await researchPool().query(
          `insert into research_room_reviews
        (research_session_id,room_decision_id,status,reason_code,note) values($1,$2,$3,$4,$5)
        on conflict(research_session_id,room_decision_id) do update set status=excluded.status,
        reason_code=excluded.reason_code,note=excluded.note,updated_at=now()`,
          [b.researchSessionId, b.roomDecisionId, b.status, b.reasonCode ?? null, b.note ?? null],
        );
      else return response.status(400).json({ error: 'Unknown review action.' });
      return response.status(200).json({ saved: true });
    }
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch {
    console.error('Review operation failed.');
    return response.status(503).json({ error: 'Research storage is unavailable.' });
  }
}
