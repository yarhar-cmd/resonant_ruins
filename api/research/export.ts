import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PostgresResearchRepository, safeSecretMatches } from '../_lib/research.js';

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  if (
    !safeSecretMatches(
      request.headers.authorization?.replace(/^Bearer\s+/i, ''),
      process.env.RESEARCH_ADMIN_TOKEN,
    )
  )
    return response.status(401).json({ error: 'Missing or incorrect research admin token.' });
  try {
    const pilotValue = single(request.query.pilot);
    const completion = single(request.query.completionStatus);
    const records = await new PostgresResearchRepository().list({
      ...(pilotValue === 'true' || pilotValue === 'false' ? { pilot: pilotValue === 'true' } : {}),
      ...(completion === 'active' || completion === 'complete' || completion === 'incomplete'
        ? { completionStatus: completion }
        : {}),
      uploadedFrom: single(request.query.uploadedFrom),
      uploadedTo: single(request.query.uploadedTo),
      gameVersion: single(request.query.gameVersion),
      protocolId: single(request.query.protocolId),
    });
    return response.status(200).json({
      researchSchemaVersion: 'research-1',
      exportedAt: new Date().toISOString(),
      scope: 'all-sessions',
      sessions: records.map((record) => record.payload),
    });
  } catch {
    console.error('Research export failed.');
    return response.status(503).json({ error: 'Research storage is unavailable.' });
  }
}
