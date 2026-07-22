import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdventureProvider } from '../../context/AdventureProvider';
import { defaultSettings, saveSettings } from '../../services/storage';
import { GameShell } from './GameShell';

function renderShell() {
  return render(
    <AdventureProvider>
      <GameShell
        showDebug={false}
        debugOpen={false}
        debugButtonRef={createRef<HTMLButtonElement>()}
        onDebug={() => undefined}
        pauseDisabled={false}
        pauseButtonRef={createRef<HTMLButtonElement>()}
        onPause={() => undefined}
      >
        <p>Playable room</p>
      </GameShell>
    </AdventureProvider>,
  );
}

describe('Resonant Ruins game presentation shell', () => {
  beforeEach(() => localStorage.clear());

  it.each(['full', 'reduced', 'off'] as const)('exposes the %s effects mode class', (mode) => {
    saveSettings({ ...defaultSettings, visualEffects: mode });
    const { container } = renderShell();
    expect(container.querySelector('.game-shell')).toHaveClass(`effects-${mode}`);
  });

  it('preserves high contrast, reduced motion, skip navigation, and keyboard Pause access', () => {
    saveSettings({ ...defaultSettings, highContrast: true, reducedMotion: true });
    const { container } = renderShell();
    expect(container.querySelector('.game-shell')).toHaveClass('is-high-contrast', 'reduce-motion');
    expect(screen.getByRole('link', { name: 'Skip to game' })).toHaveAttribute(
      'href',
      '#game-main-content',
    );
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
  });
});
