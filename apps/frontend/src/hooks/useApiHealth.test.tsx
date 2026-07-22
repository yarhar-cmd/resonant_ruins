import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('API health status', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('reports not configured without sending a localhost request', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { useApiHealth } = await import('./useApiHealth');
    const { result } = renderHook(() => useApiHealth());
    expect(result.current).toBe('not-configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('checks health only when an API URL is configured', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', service: 'test' }), { status: 200 }),
    );
    const { useApiHealth } = await import('./useApiHealth');
    const { result } = renderHook(() => useApiHealth());
    await waitFor(() => expect(result.current).toBe('online'));
  });
});
