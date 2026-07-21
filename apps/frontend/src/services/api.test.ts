import { afterEach, describe, expect, it, vi } from 'vitest';

describe('optional frontend API configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('makes no request when no API URL is explicitly configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { api } = await import('./api');
    expect(api.configured).toBe(false);
    await expect(api.health()).rejects.toThrow('Local API is not configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses the configured health URL without including research data', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', service: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { api } = await import('./api');
    expect(api.configured).toBe(true);
    await expect(api.health()).resolves.toEqual({ status: 'ok', service: 'test' });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.test/api/health',
      expect.objectContaining({ signal: undefined }),
    );
    expect(JSON.stringify(fetchSpy.mock.calls)).not.toContain('researchSessionId');
  });
});
