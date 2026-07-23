import type { AudioEventName } from '../types/audio';

export const AUDIO_SAMPLE_ASSETS = {
  'body-impact': '/audio/body-impact.ogg',
  'door-open': '/audio/door-open.ogg',
  'footstep-stone-01': '/audio/footstep-stone-01.ogg',
  'footstep-stone-02': '/audio/footstep-stone-02.ogg',
  'footstep-stone-03': '/audio/footstep-stone-03.ogg',
  'footstep-stone-04': '/audio/footstep-stone-04.ogg',
  'fountain-water': '/audio/fountain-water.ogg',
  'metal-click': '/audio/metal-click.ogg',
  'rat-alert-soft': '/audio/rat-alert-soft.ogg',
  'rat-damage-soft': '/audio/rat-damage-soft.ogg',
  'rat-defeat-rustle': '/audio/rat-defeat-rustle.ogg',
  'rat-lunge-scuffle': '/audio/rat-lunge-scuffle.ogg',
  'rat-scuffle': '/audio/rat-scuffle.ogg',
  'resonance-chime': '/audio/resonance-chime.ogg',
  'rune-burn': '/audio/rune-burn.ogg',
  'shield-block': '/audio/shield-block.ogg',
  'shield-perfect-block': '/audio/shield-perfect-block.ogg',
  'stone-collapse': '/audio/stone-collapse.ogg',
  'sword-hit': '/audio/sword-hit.ogg',
  'sword-swing-01': '/audio/sword-swing-01.ogg',
  'sword-swing-02': '/audio/sword-swing-02.ogg',
  'wall-bump-stone': '/audio/wall-bump-stone.ogg',
  'wood-open': '/audio/wood-open.ogg',
} as const;

export type AudioSampleAssetId = keyof typeof AUDIO_SAMPLE_ASSETS;

export interface AudioSampleRoute {
  variants: readonly AudioSampleAssetId[];
  gain: number;
  playbackRate?: number;
}

export const AUDIO_EVENT_SAMPLE_ROUTES = {
  'player.step': {
    variants: ['footstep-stone-01', 'footstep-stone-02', 'footstep-stone-03', 'footstep-stone-04'],
    gain: 0.42,
  },
  'player.wall-bump': { variants: ['wall-bump-stone'], gain: 0.58 },
  'player.attack-swing': {
    variants: ['sword-swing-01', 'sword-swing-02'],
    gain: 0.58,
  },
  'player.attack-hit': { variants: ['sword-hit'], gain: 0.62 },
  'player.damage': { variants: ['body-impact'], gain: 0.56 },
  'shield.raise': { variants: ['metal-click'], gain: 0.28, playbackRate: 0.9 },
  'shield.block': { variants: ['shield-block'], gain: 0.58 },
  'shield.perfect-block': { variants: ['shield-perfect-block'], gain: 0.7 },
  'rat.alert': { variants: ['rat-alert-soft'], gain: 0.2 },
  'rat.telegraph': { variants: ['rat-scuffle'], gain: 0.26 },
  'rat.attack': { variants: ['rat-lunge-scuffle'], gain: 0.22 },
  'rat.damage': { variants: ['rat-damage-soft'], gain: 0.2 },
  'rat.defeat': { variants: ['rat-defeat-rustle'], gain: 0.24 },
  'rune.trigger': { variants: ['rune-burn'], gain: 0.58 },
  'fountain.channel': { variants: ['fountain-water'], gain: 0.24, playbackRate: 0.92 },
  'fountain.heal': { variants: ['fountain-water'], gain: 0.44 },
  'cache.open': { variants: ['wood-open'], gain: 0.46 },
  'resonance.collect': { variants: ['resonance-chime'], gain: 0.38 },
  'exit.activate': { variants: ['door-open'], gain: 0.5 },
  'room.transition': { variants: ['stone-collapse'], gain: 0.46 },
  'run.defeat': { variants: ['stone-collapse'], gain: 0.5, playbackRate: 0.82 },
  'ui.confirm': { variants: ['metal-click'], gain: 0.16, playbackRate: 1.08 },
  'ui.cancel': { variants: ['metal-click'], gain: 0.14, playbackRate: 0.88 },
} as const satisfies Record<AudioEventName, AudioSampleRoute>;

export const AUDIO_SAMPLE_PATHS = Object.values(AUDIO_SAMPLE_ASSETS);

export function selectAudioSample(
  eventName: AudioEventName,
  variantIndex: number,
): { path: string; gain: number; playbackRate: number } {
  const route = AUDIO_EVENT_SAMPLE_ROUTES[eventName];
  const safeIndex = Math.abs(Math.trunc(variantIndex)) % route.variants.length;
  const assetId = route.variants[safeIndex]!;
  return {
    path: AUDIO_SAMPLE_ASSETS[assetId],
    gain: route.gain,
    playbackRate: 'playbackRate' in route ? (route.playbackRate ?? 1) : 1,
  };
}
