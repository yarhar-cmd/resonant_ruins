import type { VercelRequest, VercelResponse } from '@vercel/node';
import { safeSecretMatches } from '../../_lib/research.js';
import { createAccessCodes, researchPool } from '../../_lib/pipeline.js';

function authorized(request: VercelRequest) {
  return safeSecretMatches(
    request.headers.authorization?.replace(/^Bearer\s+/i, ''),
    process.env.RESEARCH_ADMIN_TOKEN,
  );
}
export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (!authorized(request))
    return response.status(401).json({ error: 'Missing or incorrect research admin token.' });
  try {
    if (request.method === 'POST') {
      const body = request.body ?? {};
      const codes = await createAccessCodes({
        count: Number(body.count ?? 1),
        firstSequence: Number(body.firstSequence),
        studyMode: body.studyMode,
        expiresAt: body.expiresAt ?? null,
        createdByLabel: body.createdByLabel ?? null,
        internalNote: body.internalNote ?? null,
      });
      return response
        .status(201)
        .json({ codes, warning: 'Plaintext codes are shown once. Store them securely.' });
    }
    if (request.method === 'GET') {
      const result = await researchPool()
        .query(`select id,participant_code,participant_sequence,study_mode,status,
        expires_at,reserved_session_id,reserved_at,consumed_at,created_at,created_by_label,internal_note
        from research_access_codes order by created_at desc limit 1000`);
      return response.status(200).json({ codes: result.rows });
    }
    if (request.method === 'PATCH') {
      const result = await researchPool().query(
        `update research_access_codes set status='revoked'
        where id=$1 and status='active' returning id,status`,
        [request.body?.id],
      );
      return result.rows[0]
        ? response.status(200).json(result.rows[0])
        : response.status(409).json({ error: 'Only unused active codes may be revoked.' });
    }
    return response.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('Access-code administration failed.');
    return response
      .status(503)
      .json({ error: error instanceof Error ? error.message : 'Research storage is unavailable.' });
  }
}
