import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_AUDIO_SETTINGS } from '../config/audio';
import { defaultSettings, loadSettingsResult, saveSettings } from './storage';

describe('Resonant Ruins audio settings persistence', () => {
  beforeEach(() => localStorage.clear());

  it('uses conservative centralized audio defaults', () => {
    expect(loadSettingsResult().settings).toEqual(defaultSettings);
    expect(defaultSettings.audio).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('migrates the legacy sound flag without losing visual or accessibility settings', () => {
    localStorage.setItem(
      'mirrorvault:settings',
      JSON.stringify({
        sound: false,
        reducedMotion: true,
        highContrast: true,
        visualEffects: 'reduced',
      }),
    );
    expect(loadSettingsResult()).toEqual({
      issue: null,
      settings: {
        sound: false,
        reducedMotion: true,
        highContrast: true,
        visualEffects: 'reduced',
        audio: { ...DEFAULT_AUDIO_SETTINGS, muted: true },
      },
    });
  });

  it('round-trips Master, Effects, Ambience, and mute', () => {
    const settings = {
      ...defaultSettings,
      sound: false,
      audio: { masterVolume: 44, effectsVolume: 33, ambienceVolume: 12, muted: true },
    };
    expect(saveSettings(settings)).toBeNull();
    expect(loadSettingsResult()).toEqual({ settings, issue: null });
  });

  it.each([
    { masterVolume: -1, effectsVolume: 65, ambienceVolume: 30, muted: false },
    { masterVolume: 70, effectsVolume: 101, ambienceVolume: 30, muted: false },
    { masterVolume: 70, effectsVolume: 65, ambienceVolume: Number.NaN, muted: false },
    { masterVolume: 70, effectsVolume: 65, ambienceVolume: 30, muted: 'no' },
  ])('rejects invalid stored audio values %#', (audio) => {
    localStorage.setItem('mirrorvault:settings', JSON.stringify({ ...defaultSettings, audio }));
    expect(loadSettingsResult()).toEqual({ settings: defaultSettings, issue: 'invalid' });
  });
});
