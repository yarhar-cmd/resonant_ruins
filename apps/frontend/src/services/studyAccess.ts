import { z } from 'zod';

const ClaimSchema = z.object({
  participantCode: z.string().min(1),
  participantSequence: z.number().int().positive(),
  studyMode: z.enum(['pilot', 'official']),
  uploadToken: z.string().min(32),
  researchSessionId: z.string().min(1),
});
export type StudyClaim = z.infer<typeof ClaimSchema>;
const KEY_PREFIX = 'resonant-ruins:study-upload:v1:';

export async function claimStudyAccess(
  code: string,
  researchSessionId: string,
  recoverySecret: string,
): Promise<StudyClaim> {
  const response = await fetch('/api/research/access/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, researchSessionId, recoverySecret }),
  });
  const value = (await response.json()) as unknown;
  if (!response.ok)
    throw new Error((value as { error?: string }).error ?? 'Study access is unavailable.');
  return ClaimSchema.parse(value);
}
export function saveStudyClaim(claim: StudyClaim, storage: Storage = localStorage) {
  storage.setItem(`${KEY_PREFIX}${claim.researchSessionId}`, JSON.stringify(claim));
}
export function loadStudyClaim(
  sessionId: string,
  storage: Storage = localStorage,
): StudyClaim | null {
  try {
    return ClaimSchema.parse(JSON.parse(storage.getItem(`${KEY_PREFIX}${sessionId}`) ?? 'null'));
  } catch {
    return null;
  }
}
