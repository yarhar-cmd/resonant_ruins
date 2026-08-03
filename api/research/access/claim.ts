import type { VercelRequest, VercelResponse } from '@vercel/node';
import { claimAccessCode } from '../../_lib/pipeline.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const { code, researchSessionId, recoverySecret } = request.body ?? {};
  try {
    const claim = await claimAccessCode(
      String(code ?? ''),
      String(researchSessionId ?? ''),
      String(recoverySecret ?? ''),
    );
    return response.status(200).json(claim);
  } catch (error) {
    if (error instanceof Error && error.message === 'This study access code cannot be used.')
      return response.status(400).json({ error: error.message });
    console.error('Study access claim failed.');
    return response.status(503).json({ error: 'Study access is temporarily unavailable.' });
  }
}
