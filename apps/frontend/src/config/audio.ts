import type { AudioEventName, AudioSettings } from '../types/audio';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 70,
  effectsVolume: 65,
  ambienceVolume: 20,
  muted: false,
};

export const AUDIO_VOLUME_RANGE = { minimum: 0, maximum: 100, step: 1 } as const;
export const FOOTSTEP_PITCH_RANGE = { minimum: 0.94, maximum: 1.06 } as const;
export const FOOTSTEP_VOLUME_RANGE = { minimum: 0.94, maximum: 1.08 } as const;

export type AudioCategory =
  | 'footsteps'
  | 'rat-awareness'
  | 'rat-attacks'
  | 'combat-impacts'
  | 'ui'
  | 'ambience'
  | 'interactions';

export interface AudioEventPolicy {
  category: Exclude<AudioCategory, 'ambience'>;
  cooldownMs: number;
  maximumVoices: number;
}

export const AUDIO_EVENT_POLICIES: Record<AudioEventName, AudioEventPolicy> = {
  'player.step': { category: 'footsteps', cooldownMs: 72, maximumVoices: 2 },
  'player.wall-bump': { category: 'footsteps', cooldownMs: 110, maximumVoices: 1 },
  'player.attack-swing': { category: 'combat-impacts', cooldownMs: 90, maximumVoices: 2 },
  'player.attack-hit': { category: 'combat-impacts', cooldownMs: 80, maximumVoices: 3 },
  'player.damage': { category: 'combat-impacts', cooldownMs: 120, maximumVoices: 2 },
  'shield.raise': { category: 'combat-impacts', cooldownMs: 110, maximumVoices: 1 },
  'shield.block': { category: 'combat-impacts', cooldownMs: 90, maximumVoices: 3 },
  'shield.perfect-block': { category: 'combat-impacts', cooldownMs: 120, maximumVoices: 2 },
  'rat.alert': { category: 'rat-awareness', cooldownMs: 450, maximumVoices: 1 },
  'rat.telegraph': { category: 'rat-attacks', cooldownMs: 320, maximumVoices: 2 },
  'rat.attack': { category: 'rat-attacks', cooldownMs: 240, maximumVoices: 2 },
  'rat.damage': { category: 'rat-attacks', cooldownMs: 180, maximumVoices: 2 },
  'rat.defeat': { category: 'rat-attacks', cooldownMs: 300, maximumVoices: 2 },
  'rune.trigger': { category: 'interactions', cooldownMs: 140, maximumVoices: 2 },
  'fountain.channel': { category: 'interactions', cooldownMs: 200, maximumVoices: 1 },
  'fountain.heal': { category: 'interactions', cooldownMs: 220, maximumVoices: 1 },
  'cache.open': { category: 'interactions', cooldownMs: 200, maximumVoices: 1 },
  'resonance.collect': { category: 'interactions', cooldownMs: 220, maximumVoices: 1 },
  'exit.activate': { category: 'interactions', cooldownMs: 200, maximumVoices: 1 },
  'room.transition': { category: 'interactions', cooldownMs: 220, maximumVoices: 1 },
  'run.defeat': { category: 'combat-impacts', cooldownMs: 500, maximumVoices: 1 },
  'ui.confirm': { category: 'ui', cooldownMs: 70, maximumVoices: 2 },
  'ui.cancel': { category: 'ui', cooldownMs: 70, maximumVoices: 2 },
};

export function normalizeVolume(value: number): number {
  return Math.min(
    AUDIO_VOLUME_RANGE.maximum,
    Math.max(AUDIO_VOLUME_RANGE.minimum, Math.round(value)),
  );
}
