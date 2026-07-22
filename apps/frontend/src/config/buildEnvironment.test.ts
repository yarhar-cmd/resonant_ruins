import { describe, expect, it } from 'vitest';
import {
  shouldIncludeModelLab,
  shouldIncludePlaytestDiagnostics,
  shouldIncludeTopologyLab,
} from './buildEnvironment';

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

describe('Resonant Ruins Model Lab build gating', () => {
  it('is local by default and requires an exact Preview flag in builds', () => {
    expect(shouldIncludeModelLab({}, true)).toBe(true);
    expect(shouldIncludeModelLab({}, false)).toBe(false);
    expect(shouldIncludeModelLab({ VERCEL_ENV: 'preview', VITE_ENABLE_MODEL_LAB: 'true' })).toBe(
      true,
    );
    for (const environment of [undefined, 'development', 'production']) {
      expect(
        shouldIncludeModelLab({ VERCEL_ENV: environment, VITE_ENABLE_MODEL_LAB: 'true' }),
      ).toBe(false);
    }
    expect(shouldIncludeModelLab({ VERCEL_ENV: 'preview', VITE_ENABLE_MODEL_LAB: 'TRUE' })).toBe(
      false,
    );
  });
});

describe('Resonant Ruins Topology Lab build gating', () => {
  it('is automatic only for the local development server', () => {
    expect(shouldIncludeTopologyLab({}, true)).toBe(true);
    expect(shouldIncludeTopologyLab({}, false)).toBe(false);
  });

  it('requires both the Vercel Preview environment and exact true flag in builds', () => {
    expect(
      shouldIncludeTopologyLab({
        VERCEL_ENV: 'preview',
        VITE_ENABLE_TOPOLOGY_LAB: 'true',
      }),
    ).toBe(true);
    for (const environment of [undefined, 'development', 'production'])
      expect(
        shouldIncludeTopologyLab({
          VERCEL_ENV: environment,
          VITE_ENABLE_TOPOLOGY_LAB: 'true',
        }),
      ).toBe(false);
    expect(
      shouldIncludeTopologyLab({
        VERCEL_ENV: 'preview',
        VITE_ENABLE_TOPOLOGY_LAB: 'TRUE',
      }),
    ).toBe(false);
  });
});
