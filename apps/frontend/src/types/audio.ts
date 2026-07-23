export interface AudioSettings {
  masterVolume: number;
  effectsVolume: number;
  ambienceVolume: number;
  muted: boolean;
}

export const AUDIO_EVENT_NAMES = [
  'player.step',
  'player.wall-bump',
  'player.attack-swing',
  'player.attack-hit',
  'player.damage',
  'shield.raise',
  'shield.block',
  'shield.perfect-block',
  'rat.alert',
  'rat.telegraph',
  'rat.attack',
  'rat.damage',
  'rat.defeat',
  'rune.trigger',
  'fountain.channel',
  'fountain.heal',
  'cache.open',
  'resonance.collect',
  'exit.activate',
  'room.transition',
  'run.defeat',
  'ui.confirm',
  'ui.cancel',
] as const;

export type AudioEventName = (typeof AUDIO_EVENT_NAMES)[number];

export interface AudioEvent {
  name: AudioEventName;
  sourceId?: string;
  intensity?: number;
}
