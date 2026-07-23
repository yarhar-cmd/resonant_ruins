import { describe, expect, it, vi } from 'vitest';
import { AudioSampleLibrary, type AudioSampleFetcher } from './audioSampleLibrary';

describe('Resonant Ruins audio sample loading', () => {
  it('preloads and decodes each local asset once, then exposes decoded buffers', async () => {
    const decoded = { duration: 0.2 } as AudioBuffer;
    const decode = vi.fn(async () => decoded);
    const fetcher: AudioSampleFetcher = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    const library = new AudioSampleLibrary(decode, { fetcher });

    const first = library.preload(['/audio/a.ogg', '/audio/b.ogg']);
    const second = library.preload(['/audio/a.ogg']);
    expect(second).toBe(first);
    await first;

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(decode).toHaveBeenCalledTimes(2);
    expect(library.get('/audio/a.ogg')).toBe(decoded);
    expect(library.get('/audio/missing.ogg')).toBeNull();
  });

  it('fails silently apart from at most one restrained development warning', async () => {
    const warn = vi.fn();
    const library = new AudioSampleLibrary(vi.fn(), {
      fetcher: async () => {
        throw new Error('offline');
      },
      warn,
    });

    await expect(library.preload(['/audio/a.ogg', '/audio/b.ogg'])).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    expect(library.get('/audio/a.ogg')).toBeNull();
  });
});
