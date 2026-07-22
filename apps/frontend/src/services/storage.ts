import type { UserSettings } from '../types/adventure';
import { getPlayableCharacterId } from '../data/characterAvailability';
import { DEFAULT_AUDIO_SETTINGS } from '../config/audio';
import type { AudioSettings } from '../types/audio';

const SETTINGS_KEY = 'mirrorvault:settings';
const CHARACTER_KEY = 'mirrorvault:character';
export type SettingsStorageIssue = 'invalid' | 'unavailable' | 'write-failed';

export const defaultSettings: UserSettings = {
  sound: true,
  reducedMotion: false,
  highContrast: false,
  visualEffects: 'full',
  audio: DEFAULT_AUDIO_SETTINGS,
};

function isAudioSettings(value: unknown): value is AudioSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const audio = value as Partial<AudioSettings>;
  return (
    typeof audio.masterVolume === 'number' &&
    Number.isFinite(audio.masterVolume) &&
    audio.masterVolume >= 0 &&
    audio.masterVolume <= 100 &&
    typeof audio.effectsVolume === 'number' &&
    Number.isFinite(audio.effectsVolume) &&
    audio.effectsVolume >= 0 &&
    audio.effectsVolume <= 100 &&
    typeof audio.ambienceVolume === 'number' &&
    Number.isFinite(audio.ambienceVolume) &&
    audio.ambienceVolume >= 0 &&
    audio.ambienceVolume <= 100 &&
    typeof audio.muted === 'boolean'
  );
}

export function loadSettings(): UserSettings {
  return loadSettingsResult().settings;
}

export function loadSettingsResult(storage: Storage = localStorage): {
  settings: UserSettings;
  issue: Exclude<SettingsStorageIssue, 'write-failed'> | null;
} {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (raw === null) return { settings: defaultSettings, issue: null };
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed) ||
      typeof (parsed as UserSettings).sound !== 'boolean' ||
      typeof (parsed as UserSettings).reducedMotion !== 'boolean' ||
      typeof (parsed as UserSettings).highContrast !== 'boolean' ||
      ((parsed as UserSettings).audio !== undefined &&
        !isAudioSettings((parsed as UserSettings).audio)) ||
      ((parsed as UserSettings).visualEffects !== undefined &&
        (parsed as UserSettings).visualEffects !== 'full' &&
        (parsed as UserSettings).visualEffects !== 'reduced' &&
        (parsed as UserSettings).visualEffects !== 'off')
    )
      return { settings: defaultSettings, issue: 'invalid' };
    const legacy = parsed as Omit<UserSettings, 'visualEffects' | 'audio'> & {
      visualEffects?: UserSettings['visualEffects'];
      audio?: AudioSettings;
    };
    const audio = legacy.audio ?? {
      ...DEFAULT_AUDIO_SETTINGS,
      muted: !legacy.sound,
    };
    return {
      settings: {
        ...legacy,
        visualEffects: legacy.visualEffects ?? (legacy.reducedMotion ? 'reduced' : 'full'),
        audio,
        sound: !audio.muted,
      },
      issue: null,
    };
  } catch (error) {
    return {
      settings: defaultSettings,
      issue: error instanceof SyntaxError ? 'invalid' : 'unavailable',
    };
  }
}

export function saveSettings(
  settings: UserSettings,
  storage: Storage = localStorage,
): SettingsStorageIssue | null {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return null;
  } catch {
    return 'write-failed';
  }
}

export function loadCharacter(): string {
  return getPlayableCharacterId(localStorage.getItem(CHARACTER_KEY) ?? 'warden');
}

export function saveCharacter(characterId: string): SettingsStorageIssue | null {
  try {
    localStorage.setItem(CHARACTER_KEY, getPlayableCharacterId(characterId));
    return null;
  } catch {
    return 'write-failed';
  }
}
