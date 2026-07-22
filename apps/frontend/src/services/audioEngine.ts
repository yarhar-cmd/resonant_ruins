import {
  AUDIO_EVENT_POLICIES,
  FOOTSTEP_PITCH_RANGE,
  FOOTSTEP_VOLUME_RANGE,
  type AudioCategory,
} from '../config/audio';
import type { AudioEvent, AudioEventName, AudioSettings } from '../types/audio';

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

    if (event.name === 'exit.activate') {
      this.resetTransientEffects();
    }

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

interface SoundLayer {
  kind: 'tone' | 'noise';
  frequency: number;
  duration: number;
  gain: number;
  wave?: OscillatorType;
  filter?: BiquadFilterType;
  q?: number;
  endFrequency?: number;
  attack?: number;
}

type SoundProfile = readonly SoundLayer[];

const SOUND_PROFILES: Record<AudioEventName, SoundProfile> = {
  'player.step': [
    { kind: 'noise', frequency: 330, duration: 0.075, gain: 0.058, filter: 'lowpass', q: 0.45 },
  ],
  'player.wall-bump': [
    { kind: 'noise', frequency: 105, duration: 0.14, gain: 0.085, filter: 'lowpass', q: 0.6 },
    { kind: 'tone', frequency: 82, endFrequency: 62, duration: 0.12, gain: 0.035, wave: 'sine' },
  ],
  'player.attack-swing': [
    { kind: 'noise', frequency: 1_700, duration: 0.12, gain: 0.095, filter: 'highpass', q: 0.65 },
    {
      kind: 'tone',
      frequency: 520,
      endFrequency: 310,
      duration: 0.09,
      gain: 0.025,
      wave: 'triangle',
    },
  ],
  'player.attack-hit': [
    { kind: 'noise', frequency: 185, duration: 0.12, gain: 0.11, filter: 'lowpass', q: 0.55 },
    { kind: 'tone', frequency: 96, endFrequency: 72, duration: 0.09, gain: 0.035, wave: 'sine' },
  ],
  'player.damage': [
    { kind: 'tone', frequency: 92, endFrequency: 58, duration: 0.18, gain: 0.14, wave: 'sawtooth' },
  ],
  'shield.raise': [
    { kind: 'tone', frequency: 390, duration: 0.09, gain: 0.055, wave: 'triangle' },
    { kind: 'tone', frequency: 860, duration: 0.065, gain: 0.022, wave: 'sine' },
  ],
  'shield.block': [
    { kind: 'noise', frequency: 160, duration: 0.16, gain: 0.12, filter: 'lowpass', q: 0.55 },
    { kind: 'tone', frequency: 88, endFrequency: 68, duration: 0.14, gain: 0.045, wave: 'sine' },
  ],
  'shield.perfect-block': [
    { kind: 'noise', frequency: 115, duration: 0.3, gain: 0.16, filter: 'lowpass', q: 0.65 },
    { kind: 'tone', frequency: 74, endFrequency: 48, duration: 0.28, gain: 0.085, wave: 'sine' },
    {
      kind: 'tone',
      frequency: 460,
      endFrequency: 320,
      duration: 0.18,
      gain: 0.05,
      wave: 'triangle',
    },
  ],
  'rat.alert': [
    {
      kind: 'tone',
      frequency: 980,
      endFrequency: 1_160,
      duration: 0.11,
      gain: 0.045,
      wave: 'triangle',
    },
  ],
  'rat.telegraph': [
    {
      kind: 'tone',
      frequency: 1_250,
      endFrequency: 1_470,
      duration: 0.14,
      gain: 0.058,
      wave: 'triangle',
    },
  ],
  'rat.attack': [
    {
      kind: 'tone',
      frequency: 980,
      endFrequency: 720,
      duration: 0.1,
      gain: 0.062,
      wave: 'triangle',
    },
  ],
  'rat.damage': [
    {
      kind: 'tone',
      frequency: 760,
      endFrequency: 920,
      duration: 0.08,
      gain: 0.052,
      wave: 'triangle',
    },
  ],
  'rat.defeat': [
    {
      kind: 'tone',
      frequency: 520,
      endFrequency: 260,
      duration: 0.2,
      gain: 0.058,
      wave: 'triangle',
    },
  ],
  'rune.trigger': [
    { kind: 'noise', frequency: 1_450, duration: 0.2, gain: 0.085, filter: 'bandpass', q: 1.1 },
    {
      kind: 'tone',
      frequency: 230,
      endFrequency: 110,
      duration: 0.22,
      gain: 0.052,
      wave: 'sawtooth',
    },
  ],
  'fountain.channel': [
    { kind: 'noise', frequency: 1_250, duration: 0.22, gain: 0.04, filter: 'bandpass', q: 0.75 },
    { kind: 'tone', frequency: 390, endFrequency: 470, duration: 0.22, gain: 0.024, wave: 'sine' },
  ],
  'fountain.heal': [
    { kind: 'noise', frequency: 1_650, duration: 0.38, gain: 0.045, filter: 'bandpass', q: 0.8 },
    { kind: 'tone', frequency: 520, endFrequency: 720, duration: 0.34, gain: 0.062, wave: 'sine' },
    { kind: 'tone', frequency: 780, endFrequency: 970, duration: 0.28, gain: 0.028, wave: 'sine' },
  ],
  'cache.open': [
    { kind: 'noise', frequency: 145, duration: 0.2, gain: 0.08, filter: 'lowpass', q: 0.55 },
    {
      kind: 'tone',
      frequency: 290,
      endFrequency: 220,
      duration: 0.16,
      gain: 0.038,
      wave: 'triangle',
    },
  ],
  'resonance.collect': [
    { kind: 'tone', frequency: 760, endFrequency: 1_020, duration: 0.36, gain: 0.07, wave: 'sine' },
    {
      kind: 'tone',
      frequency: 1_140,
      endFrequency: 1_350,
      duration: 0.28,
      gain: 0.025,
      wave: 'sine',
    },
  ],
  'exit.activate': [
    { kind: 'noise', frequency: 105, duration: 0.42, gain: 0.09, filter: 'lowpass', q: 0.65 },
    {
      kind: 'tone',
      frequency: 118,
      endFrequency: 72,
      duration: 0.34,
      gain: 0.038,
      wave: 'sawtooth',
    },
  ],
  'room.transition': [
    { kind: 'noise', frequency: 130, duration: 0.38, gain: 0.07, filter: 'lowpass', q: 0.6 },
    { kind: 'noise', frequency: 720, duration: 0.18, gain: 0.024, filter: 'bandpass', q: 0.8 },
  ],
  'run.defeat': [
    { kind: 'tone', frequency: 72, endFrequency: 44, duration: 0.48, gain: 0.13, wave: 'triangle' },
  ],
  'ui.confirm': [{ kind: 'tone', frequency: 560, duration: 0.055, gain: 0.032, wave: 'sine' }],
  'ui.cancel': [
    { kind: 'tone', frequency: 280, endFrequency: 240, duration: 0.055, gain: 0.028, wave: 'sine' },
  ],
};

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
  private ambienceSources: AudioScheduledSourceNode[] = [];
  private transientSources = new Set<AudioScheduledSourceNode>();

  constructor(private readonly context: AudioContext) {
    this.master = context.createGain();
    this.effects = context.createGain();
    this.ambience = context.createGain();
    this.effects.connect(this.master);
    this.ambience.connect(this.master);
    this.master.connect(context.destination);
  }

  state(): AudioContextState {
    return this.context.state;
  }

  resume(): Promise<void> {
    return this.context.resume();
  }

  setSettings(settings: AudioSettings): void {
    const at = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.masterVolume / 100, at, 0.01);
    this.effects.gain.setTargetAtTime(settings.effectsVolume / 100, at, 0.01);
    this.ambience.gain.setTargetAtTime((settings.ambienceVolume / 100) * 0.12, at, 0.04);
  }

  play(event: AudioEvent, pitch: number): AudioVoice | null {
    const profile = SOUND_PROFILES[event.name];
    const intensity = Math.min(1, Math.max(0.25, event.intensity ?? 1));
    let primary: { voice: AudioVoice; duration: number } | null = null;

    for (const layer of profile) {
      const voiceGain = this.context.createGain();
      voiceGain.connect(this.effects);
      const at = this.context.currentTime;
      const attack = Math.min(layer.attack ?? 0.006, layer.duration * 0.24);
      voiceGain.gain.setValueAtTime(0.0001, at);
      voiceGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, layer.gain * intensity),
        at + attack,
      );
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, at + layer.duration);

      const voice =
        layer.kind === 'noise'
          ? this.playNoise(layer, voiceGain, pitch)
          : this.playTone(layer, voiceGain, pitch);
      if (!primary || layer.duration > primary.duration)
        primary = { voice, duration: layer.duration };
    }

    return primary?.voice ?? null;
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

  private playTone(profile: SoundLayer, destination: AudioNode, pitch: number): AudioVoice {
    const oscillator = this.context.createOscillator();
    oscillator.type = profile.wave ?? 'triangle';
    oscillator.frequency.setValueAtTime(profile.frequency * pitch, this.context.currentTime);
    if (profile.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        profile.endFrequency * pitch,
        this.context.currentTime + profile.duration,
      );
    }
    oscillator.connect(destination);
    oscillator.start();
    oscillator.stop(this.context.currentTime + profile.duration);
    return this.track(oscillator);
  }

  private playNoise(profile: SoundLayer, destination: AudioNode, pitch: number): AudioVoice {
    const source = this.context.createBufferSource();
    source.buffer = createNoiseBuffer(this.context, Math.max(0.08, profile.duration), Math.random);
    source.playbackRate.value = pitch;
    const filter = this.context.createBiquadFilter();
    filter.type = profile.filter ?? 'bandpass';
    filter.frequency.value = profile.frequency;
    filter.Q.value = profile.q ?? 0.75;
    source.connect(filter);
    filter.connect(destination);
    source.start();
    source.stop(this.context.currentTime + profile.duration);
    return this.track(source);
  }

  private track(source: AudioScheduledSourceNode): AudioVoice {
    this.transientSources.add(source);
    source.addEventListener('ended', () => this.transientSources.delete(source), { once: true });
    return new WebAudioVoice(source);
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
