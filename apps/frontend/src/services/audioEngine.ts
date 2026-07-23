import {
  AUDIO_EVENT_POLICIES,
  FOOTSTEP_PITCH_RANGE,
  FOOTSTEP_VOLUME_RANGE,
  type AudioCategory,
} from '../config/audio';
import { AUDIO_SAMPLE_PATHS, selectAudioSample } from '../config/audioSamples';
import type { AudioEvent, AudioEventName, AudioSettings } from '../types/audio';
import { AudioSampleLibrary } from './audioSampleLibrary';

export type AudioAvailability = 'idle' | 'ready' | 'blocked' | 'unavailable';

export interface AudioVoice {
  onEnded(callback: () => void): void;
}

export interface AudioBackend {
  state(): AudioContextState;
  resume(): Promise<void>;
  setSettings(settings: AudioSettings): void;
  play(event: AudioEvent, pitch: number): AudioVoice | null;
  stopEffects(): void;
  startAmbience(): void;
  stopAmbience(): void;
  close(): Promise<void>;
}

export type AudioDebugObserver = (entry: {
  event: AudioEvent;
  played: boolean;
  pitch: number;
}) => void;

interface AudioEngineOptions {
  backendFactory?: () => AudioBackend | null;
  now?: () => number;
  random?: () => number;
}

export class AudioEngine {
  private backend: AudioBackend | null = null;
  private availability: AudioAvailability = 'idle';
  private activation: Promise<AudioAvailability> | null = null;
  private hidden = false;
  private ambienceEnabled = false;
  private lastPlayedAt = new Map<AudioEventName, number>();
  private activeVoices = new Map<AudioCategory, number>();
  private observer: AudioDebugObserver | null = null;
  private settings: AudioSettings;
  private readonly backendFactory: () => AudioBackend | null;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(settings: AudioSettings, options: AudioEngineOptions = {}) {
    this.settings = settings;
    this.backendFactory = options.backendFactory ?? createWebAudioBackend;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  getAvailability(): AudioAvailability {
    return this.availability;
  }

  setObserver(observer: AudioDebugObserver | null): void {
    this.observer = observer;
  }

  updateSettings(settings: AudioSettings): void {
    this.settings = settings;
    this.backend?.setSettings(settings);
    this.syncAmbience();
  }

  setDocumentHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.syncAmbience();
  }

  setAmbienceEnabled(enabled: boolean): void {
    this.ambienceEnabled = enabled;
    this.syncAmbience();
  }

  resetTransientEffects(): void {
    this.backend?.stopEffects();
    this.activeVoices.clear();
    this.lastPlayedAt.clear();
  }

  activate(): Promise<AudioAvailability> {
    if (this.availability === 'ready' && this.backend?.state() === 'running') {
      this.syncAmbience();
      return Promise.resolve('ready');
    }
    if (this.activation) return this.activation;
    this.activation = this.activateBackend().finally(() => {
      this.activation = null;
    });
    return this.activation;
  }

  emit(event: AudioEvent): boolean {
    const policy = AUDIO_EVENT_POLICIES[event.name];
    const isFootstep = event.name === 'player.step';
    const pitch = isFootstep ? selectFootstepPitch(this.random()) : 1;
    const eventToPlay = isFootstep
      ? { ...event, intensity: (event.intensity ?? 1) * selectFootstepVolume(this.random()) }
      : event;
    const backend = this.backend;
    const currentTime = this.now();
    const previous = this.lastPlayedAt.get(event.name) ?? Number.NEGATIVE_INFINITY;
    const voices = this.activeVoices.get(policy.category) ?? 0;
    const canPlay = Boolean(
      backend &&
      this.availability === 'ready' &&
      backend.state() === 'running' &&
      !this.hidden &&
      !this.settings.muted &&
      this.settings.masterVolume > 0 &&
      this.settings.effectsVolume > 0 &&
      currentTime - previous >= policy.cooldownMs &&
      voices < policy.maximumVoices,
    );
    if (!canPlay || !backend) {
      this.observer?.({ event: eventToPlay, played: false, pitch });
      return false;
    }

    if (event.name === 'exit.activate') this.resetTransientEffects();

    let voice: AudioVoice | null = null;
    try {
      voice = backend.play(eventToPlay, pitch);
    } catch {
      voice = null;
    }
    if (!voice) {
      this.observer?.({ event: eventToPlay, played: false, pitch });
      return false;
    }
    this.lastPlayedAt.set(event.name, currentTime);
    this.activeVoices.set(policy.category, voices + 1);
    voice.onEnded(() => {
      this.activeVoices.set(
        policy.category,
        Math.max(0, (this.activeVoices.get(policy.category) ?? 1) - 1),
      );
    });
    this.observer?.({ event: eventToPlay, played: true, pitch });
    return true;
  }

  async dispose(): Promise<void> {
    this.observer = null;
    this.backend?.stopAmbience();
    await this.backend?.close();
    this.backend = null;
    this.activeVoices.clear();
    this.lastPlayedAt.clear();
    this.availability = 'idle';
  }

  private async activateBackend(): Promise<AudioAvailability> {
    if (!this.backend) {
      try {
        this.backend = this.backendFactory();
      } catch {
        this.backend = null;
      }
      if (!this.backend) {
        this.availability = 'unavailable';
        return this.availability;
      }
      this.backend.setSettings(this.settings);
    }

    try {
      if (this.backend.state() !== 'running') await this.backend.resume();
      this.availability = this.backend.state() === 'running' ? 'ready' : 'blocked';
    } catch {
      this.availability = 'blocked';
    }
    this.syncAmbience();
    return this.availability;
  }

  private syncAmbience(): void {
    if (!this.backend) return;
    if (
      this.availability === 'ready' &&
      this.ambienceEnabled &&
      !this.hidden &&
      !this.settings.muted &&
      this.settings.masterVolume > 0 &&
      this.settings.ambienceVolume > 0
    ) {
      this.backend.startAmbience();
    } else {
      this.backend.stopAmbience();
    }
  }
}

export function selectFootstepPitch(randomValue: number): number {
  const safeRandom = Math.min(1, Math.max(0, randomValue));
  return (
    FOOTSTEP_PITCH_RANGE.minimum +
    (FOOTSTEP_PITCH_RANGE.maximum - FOOTSTEP_PITCH_RANGE.minimum) * safeRandom
  );
}

export function selectFootstepVolume(randomValue: number): number {
  const safeRandom = Math.min(1, Math.max(0, randomValue));
  return (
    FOOTSTEP_VOLUME_RANGE.minimum +
    (FOOTSTEP_VOLUME_RANGE.maximum - FOOTSTEP_VOLUME_RANGE.minimum) * safeRandom
  );
}

class WebAudioVoice implements AudioVoice {
  constructor(private readonly source: AudioScheduledSourceNode) {}

  onEnded(callback: () => void): void {
    this.source.addEventListener('ended', callback, { once: true });
  }
}

class WebAudioBackend implements AudioBackend {
  private readonly master: GainNode;
  private readonly effects: GainNode;
  private readonly ambience: GainNode;
  private readonly samples: AudioSampleLibrary;
  private readonly samplePreload: Promise<void>;
  private readonly variantCounters = new Map<AudioEventName, number>();
  private ambienceSources: AudioScheduledSourceNode[] = [];
  private transientSources = new Set<AudioScheduledSourceNode>();
  private outputPrimed = false;

  constructor(private readonly context: AudioContext) {
    this.master = context.createGain();
    this.effects = context.createGain();
    this.ambience = context.createGain();
    this.effects.connect(this.master);
    this.ambience.connect(this.master);
    this.master.connect(context.destination);
    this.samples = new AudioSampleLibrary((data) => context.decodeAudioData(data.slice(0)), {
      warn: import.meta.env.DEV ? (message) => console.warn(message) : undefined,
    });
    this.samplePreload = this.samples.preload(AUDIO_SAMPLE_PATHS);
  }

  state(): AudioContextState {
    return this.context.state;
  }

  async resume(): Promise<void> {
    if (!this.outputPrimed) this.outputPrimed = primeMobileAudioOutput(this.context);
    if (this.context.state !== 'running') await this.context.resume();
    void this.samplePreload;
  }

  setSettings(settings: AudioSettings): void {
    const at = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.masterVolume / 100, at, 0.01);
    this.effects.gain.setTargetAtTime(settings.effectsVolume / 100, at, 0.01);
    this.ambience.gain.setTargetAtTime((settings.ambienceVolume / 100) * 0.12, at, 0.04);
  }

  play(event: AudioEvent, pitch: number): AudioVoice | null {
    const variantIndex = this.variantCounters.get(event.name) ?? 0;
    this.variantCounters.set(event.name, variantIndex + 1);
    const sample = selectAudioSample(event.name, variantIndex);
    const buffer = this.samples.get(sample.path);
    if (!buffer) return null;

    const intensity = Math.min(1, Math.max(0.25, event.intensity ?? 1));
    const source = this.context.createBufferSource();
    const voiceGain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = pitch * sample.playbackRate;
    voiceGain.gain.value = sample.gain * intensity;
    source.connect(voiceGain);
    voiceGain.connect(this.effects);
    source.start();
    return this.track(source);
  }

  stopEffects(): void {
    for (const source of this.transientSources) {
      try {
        source.stop();
      } catch {
        // A short one-shot may already have ended.
      }
      source.disconnect();
    }
    this.transientSources.clear();
  }

  startAmbience(): void {
    if (this.ambienceSources.length > 0 || this.context.state !== 'running') return;
    const noise = this.context.createBufferSource();
    noise.buffer = createNoiseBuffer(this.context, 4, Math.random);
    noise.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 190;
    filter.Q.value = 0.45;
    const roomGain = this.context.createGain();
    roomGain.gain.value = 0.28;
    noise.connect(filter);
    filter.connect(roomGain);
    roomGain.connect(this.ambience);

    const crackle = this.context.createBufferSource();
    crackle.buffer = createCrackleBuffer(this.context, 4, Math.random);
    crackle.loop = true;
    const crackleFilter = this.context.createBiquadFilter();
    crackleFilter.type = 'bandpass';
    crackleFilter.frequency.value = 1_350;
    crackleFilter.Q.value = 0.9;
    const crackleGain = this.context.createGain();
    crackleGain.gain.value = 0.1;
    crackle.connect(crackleFilter);
    crackleFilter.connect(crackleGain);
    crackleGain.connect(this.ambience);

    const hum = this.context.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 43;
    const humGain = this.context.createGain();
    humGain.gain.value = 0.018;
    hum.connect(humGain);
    humGain.connect(this.ambience);
    noise.start();
    crackle.start();
    hum.start();
    this.ambienceSources = [noise, crackle, hum];
  }

  stopAmbience(): void {
    for (const source of this.ambienceSources) {
      try {
        source.stop();
      } catch {
        // A source may already have stopped during tab suspension or cleanup.
      }
      source.disconnect();
    }
    this.ambienceSources = [];
  }

  async close(): Promise<void> {
    this.stopEffects();
    this.stopAmbience();
    if (this.context.state !== 'closed') await this.context.close();
  }

  private track(source: AudioScheduledSourceNode): AudioVoice {
    this.transientSources.add(source);
    source.addEventListener('ended', () => this.transientSources.delete(source), { once: true });
    return new WebAudioVoice(source);
  }
}

type PrimableAudioContext = Pick<
  AudioContext,
  'createBuffer' | 'createBufferSource' | 'destination' | 'sampleRate'
>;

export function primeMobileAudioOutput(context: PrimableAudioContext): boolean {
  try {
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    source.connect(context.destination);
    source.addEventListener('ended', () => source.disconnect(), { once: true });
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

function createNoiseBuffer(
  context: AudioContext,
  durationSeconds: number,
  random: () => number,
): AudioBuffer {
  const length = Math.max(1, Math.ceil(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < channel.length; index += 1) {
    channel[index] = random() * 2 - 1;
  }
  return buffer;
}

function createCrackleBuffer(
  context: AudioContext,
  durationSeconds: number,
  random: () => number,
): AudioBuffer {
  const length = Math.max(1, Math.ceil(context.sampleRate * durationSeconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let ember = 0;
  for (let index = 0; index < channel.length; index += 1) {
    if (random() > 0.9985) ember = 0.35 + random() * 0.5;
    ember *= 0.94;
    channel[index] = ember * (random() * 2 - 1);
  }
  return buffer;
}

export function createWebAudioBackend(): AudioBackend | null {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  return new WebAudioBackend(new AudioContextConstructor({ latencyHint: 'interactive' }));
}
