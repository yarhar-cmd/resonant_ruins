import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { ConfirmationDialog } from '../components/mirrorvault/ConfirmationDialog';
import { useAdventure } from '../hooks/useAdventure';
import { clearActiveRun, loadActiveRun } from '../services/activeRunStorage';
import {
  changeExperiencePreset,
  createPlayerProfile,
  resetPlayerProfile,
} from '../services/playerProfileStorage';
import {
  EXPERIENCE_PRESETS,
  EXPERIENCE_PRESET_IDS,
  type ExperiencePreset,
} from '../types/adaptation';
import { AUDIO_VOLUME_RANGE, DEFAULT_AUDIO_SETTINGS } from '../config/audio';
import type { AudioSettings } from '../types/audio';

type PendingAction =
  { type: 'experience'; preset: ExperiencePreset } | { type: 'profile-reset' } | null;

export function SettingsPage() {
  const navigate = useNavigate();
  const { settings, setSettings, playerProfile, setPlayerProfile } = useAdventure();
  const [pending, setPending] = useState<PendingAction>(null);
  const toggle = (key: 'reducedMotion' | 'highContrast') =>
    setSettings({ ...settings, [key]: !settings[key] });

  function setAudio(audio: AudioSettings) {
    setSettings({ ...settings, audio, sound: !audio.muted });
  }

  function setAudioVolume(key: 'masterVolume' | 'effectsVolume' | 'ambienceVolume', value: number) {
    setAudio({ ...settings.audio, [key]: value });
  }

  function requestExperienceChange(preset: ExperiencePreset) {
    if (preset === playerProfile?.experiencePreset) return;
    if (loadActiveRun().record) setPending({ type: 'experience', preset });
    else {
      setPlayerProfile(
        playerProfile ? changeExperiencePreset(playerProfile, preset) : createPlayerProfile(preset),
      );
    }
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.type === 'experience') {
      setPlayerProfile(
        playerProfile
          ? changeExperiencePreset(playerProfile, pending.preset)
          : createPlayerProfile(pending.preset),
      );
    } else if (playerProfile) {
      setPlayerProfile(resetPlayerProfile(playerProfile, true));
    }
    clearActiveRun();
    setPending(null);
    navigate('/');
  }

  return (
    <PageContainer
      eyebrow="Local controls"
      title="Settings"
      intro="Preferences stay in this browser and can be changed at any time."
    >
      <div className="settings-groups">
        <section className="settings-group" aria-labelledby="gameplay-settings-title">
          <header>
            <p className="kicker">Run preferences</p>
            <h2 id="gameplay-settings-title">Gameplay</h2>
          </header>
          <label>
            <span>
              <strong>Experience preset</strong>
              <small>Shapes how strongly rooms reinforce or test your play style.</small>
            </span>
            <select
              aria-label="Experience preset"
              value={playerProfile?.experiencePreset ?? ''}
              onChange={(event) => requestExperienceChange(event.target.value as ExperiencePreset)}
            >
              <option value="" disabled>
                Choose experience
              </option>
              {EXPERIENCE_PRESET_IDS.map((preset) => (
                <option key={preset} value={preset}>
                  {EXPERIENCE_PRESETS[preset].label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="settings-group" aria-labelledby="visual-settings-title">
          <header>
            <p className="kicker">Presentation</p>
            <h2 id="visual-settings-title">Visuals</h2>
          </header>
          <label>
            <span>
              <strong>Visual Effects</strong>
              <small>Controls torch, Fountain, particle, and room ambience motion.</small>
            </span>
            <select
              aria-label="Visual Effects"
              value={settings.visualEffects}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  visualEffects: event.target.value as typeof settings.visualEffects,
                })
              }
            >
              <option value="full">Full</option>
              <option value="reduced">Reduced</option>
              <option value="off">Off</option>
            </select>
          </label>
        </section>

        <section className="settings-group audio-settings" aria-labelledby="audio-settings-title">
          <div className="audio-settings__heading">
            <header>
              <p className="kicker">Procedural sound</p>
              <h2 id="audio-settings-title">Audio</h2>
              <small>Generated locally after your first interaction.</small>
            </header>
            <button
              type="button"
              className="button button--secondary audio-settings__mute"
              aria-pressed={settings.audio.muted}
              onClick={() => setAudio({ ...settings.audio, muted: !settings.audio.muted })}
            >
              {settings.audio.muted ? 'Unmute' : 'Mute'}
            </button>
          </div>
          {(
            [
              ['masterVolume', 'Master volume', 'All Resonant Ruins audio'],
              ['effectsVolume', 'Effects volume', 'Movement, combat, Rats, and interactions'],
              ['ambienceVolume', 'Ambience volume', 'Quiet dungeon air and stone resonance'],
            ] as const
          ).map(([key, label, description]) => (
            <label className="audio-settings__slider" key={key}>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <span className="audio-settings__control">
                <input
                  type="range"
                  aria-label={label}
                  min={AUDIO_VOLUME_RANGE.minimum}
                  max={AUDIO_VOLUME_RANGE.maximum}
                  step={AUDIO_VOLUME_RANGE.step}
                  value={settings.audio[key]}
                  onChange={(event) => setAudioVolume(key, Number(event.target.value))}
                />
                <output aria-live="polite">{settings.audio[key]}%</output>
              </span>
            </label>
          ))}
          <button
            type="button"
            className="button button--secondary audio-settings__reset"
            onClick={() => setAudio(DEFAULT_AUDIO_SETTINGS)}
          >
            Reset Audio Settings
          </button>
        </section>

        <section className="settings-group" aria-labelledby="accessibility-settings-title">
          <header>
            <p className="kicker">Comfort and clarity</p>
            <h2 id="accessibility-settings-title">Accessibility</h2>
          </header>
          <label>
            <span>
              <strong>Reduce motion</strong>
              <small>Constrains motion independently of the visual-effects setting.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={() => toggle('reducedMotion')}
            />
          </label>
          <label>
            <span>
              <strong>High contrast</strong>
              <small>Strengthens text and interface borders.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={() => toggle('highContrast')}
            />
          </label>
        </section>

        <section className="settings-group" aria-labelledby="data-settings-title">
          <header>
            <p className="kicker">Browser-local data</p>
            <h2 id="data-settings-title">Data</h2>
          </header>
          <div className="settings-action">
            <span>
              <strong>Adaptive profile</strong>
              <small>
                Forget learned traits and relock the Awakening shortcut. History remains.
              </small>
            </span>
            <button
              className="button button--secondary"
              type="button"
              disabled={!playerProfile}
              onClick={() => setPending({ type: 'profile-reset' })}
            >
              Reset adaptive profile
            </button>
          </div>
        </section>
      </div>

      <ConfirmationDialog
        open={pending?.type === 'experience'}
        title="Change experience preset?"
        confirmLabel="Change and reset"
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        <p>
          The current run will reset, the adaptive profile and active learning data will return to
          neutral, and the Awakening Chamber shortcut will relock. You will return to Main Menu.
        </p>
        <p>Completed-run history and best records remain under their original presets.</p>
      </ConfirmationDialog>
      <ConfirmationDialog
        open={pending?.type === 'profile-reset'}
        title="Reset adaptive profile?"
        confirmLabel="Reset profile"
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        <p>
          This clears learned traits and metadata, relocks the shortcut, clears the active run, and
          returns to Main Menu. Your selected experience, completed-run history, and best records
          remain.
        </p>
      </ConfirmationDialog>
    </PageContainer>
  );
}
