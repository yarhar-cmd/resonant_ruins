import { describe, expect, it } from 'vitest';
import { shouldIncludePlaytestDiagnostics } from './buildEnvironment';

describe('Resonant Ruins diagnostic build gating', () => {
  it('enables diagnostics only for an exact Vercel Preview and exact true flag', () => {
    expect(
      shouldIncludePlaytestDiagnostics({
        VERCEL_ENV: 'preview',
        VITE_ENABLE_PLAYTEST_DIAGNOSTICS: 'true',
      }),
    ).toBe(true);

    for (const value of [undefined, '', 'false', '1', 'yes', 'TRUE']) {
      expect(
        shouldIncludePlaytestDiagnostics({
          VERCEL_ENV: 'preview',
          VITE_ENABLE_PLAYTEST_DIAGNOSTICS: value,
        }),
      ).toBe(false);
    }
  });

  it('never enables diagnostics in local development or production', () => {
    for (const vercelEnvironment of [undefined, 'development', 'production']) {
      expect(
        shouldIncludePlaytestDiagnostics({
          VERCEL_ENV: vercelEnvironment,
          VITE_ENABLE_PLAYTEST_DIAGNOSTICS: 'true',
        }),
      ).toBe(false);
    }
  });

  it('cannot be enabled by a hostname or query-string-shaped value', () => {
    expect(
      shouldIncludePlaytestDiagnostics({
        VERCEL_ENV: 'https://preview.example.test/?VITE_ENABLE_PLAYTEST_DIAGNOSTICS=true',
        VITE_ENABLE_PLAYTEST_DIAGNOSTICS: 'true',
      }),
    ).toBe(false);
  });
});
