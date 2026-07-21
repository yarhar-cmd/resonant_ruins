export const RESEARCH_SCHEMA_VERSION = 'research-1' as const;
export const FEEDBACK_SCHEMA_VERSION = 'feedback-1' as const;
export const RESEARCH_ASSIGNMENT_METHOD_ID = 'balanced-two-run-blocks-1' as const;
export const DEFAULT_ASSIGNMENT_UNIT = 'per-run' as const;
export const RESEARCH_STORAGE_KEY = 'resonant-ruins:research:v1' as const;
export const RESEARCH_ACTIVE_RUN_KEY = 'resonant-ruins:research-active-run:v1' as const;
export const PARTICIPANT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
export const RESEARCH_STORAGE_WARNING_BYTES = 4_000_000;

export const RESEARCH_FEEDBACK_QUESTIONS = {
  difficulty: {
    prompt: 'How did the difficulty of that room feel?',
    options: ['too_easy', 'about_right', 'too_hard'] as const,
  },
  fairness: {
    prompt: 'How fair did that room feel?',
    options: [1, 2, 3, 4, 5] as const,
  },
  enjoyment: {
    prompt: 'How enjoyable was that room?',
    options: [1, 2, 3, 4, 5] as const,
  },
} as const;

export function normalizeParticipantCode(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  return PARTICIPANT_CODE_PATTERN.test(normalized) ? normalized : null;
}
