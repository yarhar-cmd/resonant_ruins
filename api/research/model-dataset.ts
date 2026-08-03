import type { VercelRequest, VercelResponse } from '@vercel/node';
import { safeSecretMatches } from '../_lib/research.js';
import { approvedModelDataset } from '../_lib/pipeline.js';

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
    const includePilot = request.query.includePilot === 'true';
    return response.status(200).json(await approvedModelDataset(includePilot));
  } catch {
    console.error('Model dataset export failed.');
    return response.status(503).json({ error: 'Research storage is unavailable.' });
  }
}
