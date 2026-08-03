import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import { MAX_RESEARCH_BODY_BYTES } from '../_lib/research.js';
import { saveAuthorizedSession } from '../_lib/pipeline.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (Buffer.byteLength(JSON.stringify(request.body)) > MAX_RESEARCH_BODY_BYTES)
    return response.status(413).json({ error: 'Research payload exceeds the 1 MiB limit.' });
  try {
    const receipt = await saveAuthorizedSession(
      request.body,
      request.headers.authorization?.replace(/^Bearer\s+/i, ''),
    );
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
    if (error instanceof Error && error.message.startsWith('Submission authorization'))
      return response
        .status(401)
        .json({ status: 'rejected', error: 'Submission authorization is invalid.' });
    console.error('Research session storage failed.');
    return response
      .status(503)
      .json({ status: 'rejected', error: 'Research storage is unavailable.' });
  }
}
