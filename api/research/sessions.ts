import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import {
  MAX_RESEARCH_BODY_BYTES,
  PostgresResearchRepository,
  safeSecretMatches,
  saveResearchSession,
} from '../_lib/research.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (
    !safeSecretMatches(
      request.headers['x-research-upload-key'] as string,
      process.env.RESEARCH_UPLOAD_KEY,
    )
  )
    return response.status(401).json({ error: 'Missing or incorrect research upload key.' });
  if (Buffer.byteLength(JSON.stringify(request.body)) > MAX_RESEARCH_BODY_BYTES)
    return response.status(413).json({ error: 'Research payload exceeds the 1 MiB limit.' });
  try {
    const receipt = await saveResearchSession(request.body, new PostgresResearchRepository());
    return response.status(receipt.status === 'conflict' ? 409 : 200).json(receipt);
  } catch (error) {
    if (error instanceof ZodError)
      return response.status(422).json({
        status: 'rejected',
        error: 'Research evidence failed schema validation.',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    console.error('Research session storage failed.');
    return response
      .status(503)
      .json({ status: 'rejected', error: 'Research storage is unavailable.' });
  }
}
