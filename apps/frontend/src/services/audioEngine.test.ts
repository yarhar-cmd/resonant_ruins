import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../config/audio';
import type { AudioEvent, AudioSettings } from '../types/audio';
import {
  AudioEngine,
  primeMobileAudioOutput,
  selectFootstepPitch,
  selectFootstepVolume,
  type AudioBackend,
  type AudioVoice,
} from './audioEngine';

class FakeVoice implements AudioVoice {
  private callbacks: Array<() => void> = [];

  onEnded(callback: () => void): void {
    this.callbacks.push(callback);
  }

  end(): void {
    for (const callback of this.callbacks) callback();
  }
}

class FakeBackend implements AudioBackend {
  stateValue: AudioContextState = 'suspended';
  resumeError: Error | null = null;
  settings: AudioSettings[] = [];
  plays: Array<{ event: AudioEvent; pitch: number; voice: FakeVoice }> = [];
  ambienceStarts = 0;
  ambienceInstances = 0;
  ambienceRunning = false;
  ambienceStops = 0;
  effectStops = 0;
  closes = 0;

  state(): AudioContextState {
    return this.stateValue;
  }

  async resume(): Promise<void> {
    if (this.resumeError) throw this.resumeError;
    this.stateValue = 'running';
  }

  setSettings(settings: AudioSettings): void {
    this.settings.push({ ...settings });
  }

  play(event: AudioEvent, pitch: number): AudioVoice {
    const voice = new FakeVoice();
    this.plays.push({ event, pitch, voice });
    return voice;
  }

  stopEffects(): void {
    this.effectStops += 1;
  }

  startAmbience(): void {
    this.ambienceStarts += 1;
    if (!this.ambienceRunning) {
      this.ambienceRunning = true;
      this.ambienceInstances += 1;
    }
  }

  stopAmbience(): void {
    this.ambienceStops += 1;
    this.ambienceRunning = false;
  }

  async close(): Promise<void> {
    this.closes += 1;
    this.stateValue = 'closed';
  }
}

describe('Resonant Ruins centralized sample audio engine', () => {
  it('creates and resumes its backend lazily, then starts only one logical ambience layer', async () => {
    const backend = new FakeBackend();
    const factory = vi.fn(() => backend);
    const engine = new AudioEngine(DEFAULT_AUDIO_SETTINGS, { backendFactory: factory });

    expect(factory).not.toHaveBeenCalled();
    expect(engine.emit({ name: 'ui.confirm' })).toBe(false);
    engine.setAmbienceEnabled(true);
    expect(await engine.activate()).toBe('ready');
    expect(factory).toHaveBeenCalledOnce();
    expect(backend.settings.at(-1)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(backend.ambienceStarts).toBe(1);

    expect(await engine.activate()).toBe('ready');
    expect(factory).toHaveBeenCalledOnce();
    expect(backend.ambienceStarts).toBe(2);
    expect(backend.ambienceInstances).toBe(1);
  });

  it('fails gracefully when unavailable or blocked and retries after a later gesture', async () => {
    const unavailable = new AudioEngine(DEFAULT_AUDIO_SETTINGS, { backendFactory: () => null });
    expect(await unavailable.activate()).toBe('unavailable');
    expect(unavailable.emit({ name: 'player.step' })).toBe(false);

    const backend = new FakeBackend();
    backend.resumeError = new Error('autoplay blocked');
    const blocked = new AudioEngine(DEFAULT_AUDIO_SETTINGS, { backendFactory: () => backend });
    expect(await blocked.activate()).toBe('blocked');
    backend.resumeError = null;
    expect(await blocked.activate()).toBe('ready');
  });

  it('routes typed events, applies live settings, mutes instantly, and clears room voices', async () => {
    let now = 1_000;
    const backend = new FakeBackend();
    const engine = new AudioEngine(DEFAULT_AUDIO_SETTINGS, {
      backendFactory: () => backend,
      now: () => now,
      random: () => 0.5,
    });
    await engine.activate();

    expect(engine.emit({ name: 'player.attack-swing' })).toBe(true);
    expect(backend.plays.at(-1)?.event.name).toBe('player.attack-swing');
    engine.updateSettings({ ...DEFAULT_AUDIO_SETTINGS, muted: true, masterVolume: 31 });
    now += 500;
    expect(engine.emit({ name: 'player.attack-hit' })).toBe(false);
    expect(backend.settings.at(-1)).toMatchObject({ muted: true, masterVolume: 31 });

    engine.updateSettings({ ...DEFAULT_AUDIO_SETTINGS, muted: false });
    expect(engine.emit({ name: 'exit.activate' })).toBe(true);
    expect(backend.effectStops).toBe(1);
  });

  it('limits concurrent footsteps and varies their pitch and volume within conservative bounds', async () => {
    let now = 1_000;
    const backend = new FakeBackend();
    const randomValues = [0, 0, 1, 1, 0.5, 0.5];
    const engine = new AudioEngine(DEFAULT_AUDIO_SETTINGS, {
      backendFactory: () => backend,
      now: () => now,
      random: () => randomValues.shift() ?? 0.5,
    });
    await engine.activate();

    expect(engine.emit({ name: 'player.step' })).toBe(true);
    now += 80;
    expect(engine.emit({ name: 'player.step' })).toBe(true);
    now += 80;
    expect(engine.emit({ name: 'player.step' })).toBe(false);
    expect(backend.plays.map(({ pitch }) => pitch)).toEqual([0.94, 1.06]);
    expect(backend.plays[0]?.event.intensity).toBeCloseTo(0.94);
    expect(backend.plays[1]?.event.intensity).toBeCloseTo(1.08);
    backend.plays[0]?.voice.end();
    expect(engine.emit({ name: 'player.step' })).toBe(true);
  });

  it('throttles repeated Rat cues and limits simultaneous Rat voices', async () => {
    let now = 1_000;
    const backend = new FakeBackend();
    const engine = new AudioEngine(DEFAULT_AUDIO_SETTINGS, {
      backendFactory: () => backend,
      now: () => now,
    });
    await engine.activate();

    expect(engine.emit({ name: 'rat.alert', sourceId: 'rat-1' })).toBe(true);
    now += 200;
    expect(engine.emit({ name: 'rat.alert', sourceId: 'rat-3' })).toBe(false);
    backend.plays[0]?.voice.end();
    now += 250;
    expect(engine.emit({ name: 'rat.alert', sourceId: 'rat-3' })).toBe(true);

    now += 500;
    expect(engine.emit({ name: 'rat.telegraph', sourceId: 'rat-1' })).toBe(true);
    now += 320;
    expect(engine.emit({ name: 'rat.telegraph', sourceId: 'rat-2' })).toBe(true);
    now += 320;
    expect(engine.emit({ name: 'rat.telegraph', sourceId: 'rat-3' })).toBe(false);
    backend.plays.at(-2)?.voice.end();
    expect(engine.emit({ name: 'rat.telegraph', sourceId: 'rat-3' })).toBe(true);
  });

  it('primes a one-frame silent source for mobile Web Audio unlock', () => {
    const buffer = {} as AudioBuffer;
    const destination = {} as AudioDestinationNode;
    const source = {
      buffer: null,
      connect: vi.fn(),
      addEventListener: vi.fn(),
      start: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as AudioBufferSourceNode;
    const context = {
      sampleRate: 48_000,
      destination,
      createBuffer: vi.fn(() => buffer),
      createBufferSource: vi.fn(() => source),
    } as unknown as AudioContext;

    expect(primeMobileAudioOutput(context)).toBe(true);
    expect(context.createBuffer).toHaveBeenCalledWith(1, 1, 48_000);
    expect(source.buffer).toBe(buffer);
    expect(source.connect).toHaveBeenCalledWith(destination);
    expect(source.start).toHaveBeenCalledWith(0);

    expect(
      primeMobileAudioOutput({
        ...context,
        createBufferSource: () => {
          throw new Error('mobile backend unavailable');
        },
      }),
    ).toBe(false);
  });

  it('suppresses effects and ambience while hidden, restores ambience when visible, and cleans up', async () => {
    const backend = new FakeBackend();
    const engine = new AudioEngine(DEFAULT_AUDIO_SETTINGS, { backendFactory: () => backend });
    engine.setAmbienceEnabled(true);
    await engine.activate();
    engine.setDocumentHidden(true);
    expect(engine.emit({ name: 'rat.alert' })).toBe(false);
    expect(backend.ambienceStops).toBeGreaterThan(0);
    engine.setDocumentHidden(false);
    expect(backend.ambienceStarts).toBeGreaterThan(1);
    await engine.dispose();
    expect(backend.closes).toBe(1);
    expect(engine.getAvailability()).toBe('idle');
  });

  it('keeps randomized footstep helpers bounded even for invalid random inputs', () => {
    expect(selectFootstepPitch(-2)).toBe(0.94);
    expect(selectFootstepPitch(4)).toBe(1.06);
    expect(selectFootstepVolume(-2)).toBe(0.94);
    expect(selectFootstepVolume(4)).toBe(1.08);
  });
});
