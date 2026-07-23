import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AUDIO_EVENT_NAMES } from '../types/audio';
import {
  AUDIO_EVENT_SAMPLE_ROUTES,
  AUDIO_SAMPLE_ASSETS,
  AUDIO_SAMPLE_PATHS,
  selectAudioSample,
} from './audioSamples';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(testDirectory, '../../public');

describe('Resonant Ruins sample manifest', () => {
  it('routes every typed one-shot event to a local browser-safe OGG asset', () => {
    expect(Object.keys(AUDIO_EVENT_SAMPLE_ROUTES).sort()).toEqual([...AUDIO_EVENT_NAMES].sort());
    expect(new Set(AUDIO_SAMPLE_PATHS).size).toBe(Object.keys(AUDIO_SAMPLE_ASSETS).length);

    for (const path of AUDIO_SAMPLE_PATHS) {
      expect(path).toMatch(/^\/audio\/[a-z0-9-]+\.ogg$/);
      expect(path).not.toMatch(/^https?:/);
      const filePath = join(publicDirectory, path.replace(/^\//, ''));
      expect(existsSync(filePath)).toBe(true);
      expect(statSync(filePath).size).toBeGreaterThan(1_000);
    }
  });

  it('selects footstep and sword variants predictably without changing event semantics', () => {
    expect(selectAudioSample('player.step', 0).path).toBe('/audio/footstep-stone-01.ogg');
    expect(selectAudioSample('player.step', 4).path).toBe('/audio/footstep-stone-01.ogg');
    expect(selectAudioSample('player.attack-swing', 1).path).toBe('/audio/sword-swing-02.ogg');
    expect(selectAudioSample('rat.alert', 0).path).toBe('/audio/rat-alert.ogg');
    expect(selectAudioSample('rat.telegraph', 0).playbackRate).toBe(1.04);
    expect(selectAudioSample('exit.activate', 0).path).toBe('/audio/door-open.ogg');
    expect(selectAudioSample('room.transition', 0).path).toBe('/audio/stone-collapse.ogg');
  });

  it('keeps differentiated Rat cues present but below the dominant gameplay mix', () => {
    expect(AUDIO_EVENT_SAMPLE_ROUTES['rat.alert'].gain).toBe(0.18);
    expect(AUDIO_EVENT_SAMPLE_ROUTES['rat.telegraph'].gain).toBe(0.22);
    expect(AUDIO_EVENT_SAMPLE_ROUTES['rat.attack'].gain).toBe(0.18);
    expect(AUDIO_EVENT_SAMPLE_ROUTES['rat.damage'].gain).toBe(0.2);
    expect(AUDIO_EVENT_SAMPLE_ROUTES['rat.defeat'].gain).toBe(0.24);
    expect(AUDIO_EVENT_SAMPLE_ROUTES['rat.telegraph'].gain).toBeGreaterThan(
      AUDIO_EVENT_SAMPLE_ROUTES['rat.alert'].gain,
    );
  });

  it('keeps gameplay one-shots sample-based and reserves synthesis for quiet ambience', () => {
    const engineSource = readFileSync(resolve(testDirectory, '../services/audioEngine.ts'), 'utf8');
    expect(engineSource).not.toContain('SOUND_PROFILES');
    expect(engineSource).not.toContain('playTone(');
    expect(engineSource).toContain('createNoiseBuffer');
    expect(engineSource).toContain('createCrackleBuffer');
  });

  it('documents a CC0 provenance and redistribution record for every shipped sample', () => {
    const provenance = readFileSync(
      resolve(testDirectory, '../../../../docs/AUDIO_ASSETS.md'),
      'utf8',
    );
    for (const path of AUDIO_SAMPLE_PATHS) {
      expect(provenance).toContain(path.split('/').at(-1));
    }
    expect(provenance).toContain('CC0 1.0 Universal');
    expect(provenance).toContain('2026-07-22');
    expect(provenance).toContain('Redistribution allowed');
  });
});
