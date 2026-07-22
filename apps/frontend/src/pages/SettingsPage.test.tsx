import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdventureProvider } from '../context/AdventureProvider';
import { getEvaluationRoom } from '../data/rooms/evaluationRooms';
import {
  clearActiveRun,
  createActiveRunRecord,
  loadActiveRun,
  saveActiveRun,
} from '../services/activeRunStorage';
import {
  createPlayerProfile,
  loadPlayerProfile,
  savePlayerProfile,
} from '../services/playerProfileStorage';
import { RUN_ARCHIVE_KEY } from '../services/runArchive';
import { gameplayReducer, createGameplayState } from '../utils/gameplayState';
import { coordinateToGridPosition, findSafeSpawn } from '../utils/roomGeometry';
import { SettingsPage } from './SettingsPage';

const order = [
  'evaluation-room-01',
  'evaluation-room-02',
  'evaluation-room-03',
  'evaluation-room-04',
  'evaluation-room-05',
];
function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}
function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <AdventureProvider>
        <Routes>
          <Route
            path="/settings"
            element={
              <>
                <SettingsPage />
                <Location />
              </>
            }
          />
          <Route path="/" element={<Location />} />
        </Routes>
      </AdventureProvider>
    </MemoryRouter>,
  );
}
function persistActiveRun() {
  const room = getEvaluationRoom(order[0]!)!;
  const state = gameplayReducer(createGameplayState(6), {
    type: 'start-run',
    maximumHealth: 6,
    startedAt: 100,
    runId: 'settings-run',
    runSeed: 'settings-seed',
    experiencePreset: 'new-delver',
    roomOrder: order,
    currentRoomId: room.id,
    spawn: coordinateToGridPosition(findSafeSpawn(room, 'west')),
  });
  saveActiveRun(createActiveRunRecord(state, 'warden', 200)!);
}

describe('Resonant Ruins Settings profile controls', () => {
  beforeEach(() => {
    localStorage.clear();
    clearActiveRun();
    savePlayerProfile(createPlayerProfile('new-delver'));
  });
  it('requires confirmation during an active run and cancel changes nothing', () => {
    persistActiveRun();
    renderSettings();
    fireEvent.change(screen.getByLabelText('Experience preset'), {
      target: { value: 'dungeon-veteran' },
    });
    expect(screen.getByRole('alertdialog', { name: 'Change experience preset?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(loadPlayerProfile().record?.experiencePreset).toBe('new-delver');
    expect(loadActiveRun().record).not.toBeNull();
  });
  it('confirming experience resets the run/profile/shortcut, preserves archives, and returns Main Menu', () => {
    const profile = {
      ...createPlayerProfile('new-delver'),
      shortcutUnlocked: true,
      longTermProfile: { pace: 1, caution: 1, aggression: 1, hazardTolerance: 1, exploration: 1 },
    };
    savePlayerProfile(profile);
    persistActiveRun();
    localStorage.setItem(RUN_ARCHIVE_KEY, 'preserved-history');
    renderSettings();
    fireEvent.change(screen.getByLabelText('Experience preset'), {
      target: { value: 'dungeon-veteran' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change and reset' }));
    expect(loadPlayerProfile().record).toMatchObject({
      experiencePreset: 'dungeon-veteran',
      shortcutUnlocked: false,
      longTermProfile: { pace: 0.5 },
    });
    expect(loadActiveRun().record).toBeNull();
    expect(localStorage.getItem(RUN_ARCHIVE_KEY)).toBe('preserved-history');
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
  it('profile reset preserves selected experience but clears first-time status and relocks', () => {
    savePlayerProfile({ ...createPlayerProfile('seasoned-adventurer'), shortcutUnlocked: true });
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Reset adaptive profile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset profile' }));
    expect(loadPlayerProfile().record).toMatchObject({
      experiencePreset: 'seasoned-adventurer',
      firstTimeComplete: false,
      shortcutUnlocked: false,
    });
  });
  it('stores all three Visual Effects modes without changing essential accessibility settings', () => {
    renderSettings();
    const select = screen.getByLabelText('Visual Effects');
    fireEvent.change(select, { target: { value: 'reduced' } });
    expect(JSON.parse(localStorage.getItem('mirrorvault:settings')!)).toMatchObject({
      visualEffects: 'reduced',
      reducedMotion: false,
    });
    fireEvent.change(select, { target: { value: 'off' } });
    expect(JSON.parse(localStorage.getItem('mirrorvault:settings')!)).toMatchObject({
      visualEffects: 'off',
    });
    fireEvent.change(select, { target: { value: 'full' } });
    expect(JSON.parse(localStorage.getItem('mirrorvault:settings')!)).toMatchObject({
      visualEffects: 'full',
    });
  });

  it('groups settings and persists audio sliders, mute, and reset', () => {
    renderSettings();
    for (const heading of ['Gameplay', 'Visuals', 'Audio', 'Accessibility', 'Data'])
      expect(screen.getByRole('heading', { name: heading })).toBeVisible();

    fireEvent.change(screen.getByLabelText('Master volume'), { target: { value: '41' } });
    fireEvent.change(screen.getByLabelText('Effects volume'), { target: { value: '52' } });
    fireEvent.change(screen.getByLabelText('Ambience volume'), { target: { value: '13' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(JSON.parse(localStorage.getItem('mirrorvault:settings')!)).toMatchObject({
      sound: false,
      audio: { masterVolume: 41, effectsVolume: 52, ambienceVolume: 13, muted: true },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset Audio Settings' }));
    expect(screen.getByLabelText('Master volume')).toHaveValue('70');
    expect(screen.getByLabelText('Effects volume')).toHaveValue('65');
    expect(screen.getByLabelText('Ambience volume')).toHaveValue('20');
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'false');
  });
});
