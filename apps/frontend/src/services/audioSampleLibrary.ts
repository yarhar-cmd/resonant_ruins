export interface AudioSampleResponse {
  ok: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type AudioSampleFetcher = (path: string) => Promise<AudioSampleResponse>;
export type AudioSampleDecoder = (data: ArrayBuffer) => Promise<AudioBuffer>;

interface AudioSampleLibraryOptions {
  fetcher?: AudioSampleFetcher;
  warn?: (message: string) => void;
}

export class AudioSampleLibrary {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly fetcher: AudioSampleFetcher;
  private readonly warn: ((message: string) => void) | undefined;
  private preloadPromise: Promise<void> | null = null;
  private hasWarned = false;

  constructor(
    private readonly decode: AudioSampleDecoder,
    options: AudioSampleLibraryOptions = {},
  ) {
    this.fetcher = options.fetcher ?? ((path) => fetch(path));
    this.warn = options.warn;
  }

  preload(paths: readonly string[]): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadPromise = Promise.all(paths.map((path) => this.load(path))).then(() => undefined);
    return this.preloadPromise;
  }

  get(path: string): AudioBuffer | null {
    return this.buffers.get(path) ?? null;
  }

  private async load(path: string): Promise<void> {
    try {
      const response = await this.fetcher(path);
      if (!response.ok) throw new Error('Audio sample request failed.');
      const buffer = await this.decode(await response.arrayBuffer());
      this.buffers.set(path, buffer);
    } catch {
      if (!this.hasWarned) {
        this.hasWarned = true;
        this.warn?.('Resonant Ruins could not load one or more optional audio samples.');
      }
    }
  }
}
