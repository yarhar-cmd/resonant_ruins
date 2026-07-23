import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPanel } from './StatusPanel';

describe('Resonant Ruins status panel', () => {
  it('renders live Warden health with distinct remaining and missing indicators', () => {
    const { container } = render(
      <StatusPanel
        room={1}
        mode="adaptive"
        character="Elian Voss"
        currentHealth={4}
        maximumHealth={6}
        isInvulnerable={false}
        isDefeated={false}
        resonance={2}
      />,
    );

    expect(screen.getByLabelText('4 of 6 health remaining.')).toBeVisible();
    expect(container.querySelectorAll('.health__indicators > span')).toHaveLength(6);
    expect(container.querySelectorAll('.health__remaining')).toHaveLength(4);
    expect(container.querySelectorAll('.health__missing')).toHaveLength(2);
    expect(container.querySelector('.health__remaining')).toHaveTextContent('♥');
    expect(container.querySelector('.health__missing')).toHaveTextContent('♡');
    expect(screen.getByLabelText('Resonance 2')).toHaveTextContent('2');
    expect(container.querySelector('.resonance__icon')).toHaveTextContent('◆');
  });

  it('exposes invulnerable and defeated conditions without relying on color', () => {
    const { rerender } = render(
      <StatusPanel
        room={1}
        mode="adaptive"
        character="Elian Voss"
        currentHealth={5}
        maximumHealth={6}
        isInvulnerable
        isDefeated={false}
      />,
    );
    expect(screen.getByText('◇ Invulnerable')).toBeVisible();
    expect(screen.getByLabelText(/Invulnerable/)).toBeVisible();

    rerender(
      <StatusPanel
        room={1}
        mode="adaptive"
        character="Elian Voss"
        currentHealth={0}
        maximumHealth={6}
        isInvulnerable={false}
        isDefeated
      />,
    );
    expect(screen.getByText('× Defeated')).toBeVisible();
    expect(screen.getByLabelText(/You were defeated/)).toBeVisible();
  });

  it('keeps the generated-dungeon HUD limited to health, cleared rooms, time, and Resonance', () => {
    render(
      <StatusPanel
        roomLabel="Dungeon Room 8"
        mode="Exploring"
        character="Elian Voss"
        currentHealth={6}
        maximumHealth={6}
        isInvulnerable={false}
        isDefeated={false}
        dungeonRoomsCleared={7}
        enemiesRemaining={3}
        resonance={2}
        elapsedTime="01:42"
      />,
    );
    const status = screen.getByRole('complementary', { name: 'Current run status' });
    expect(status).toHaveTextContent('Health');
    expect(status).toHaveTextContent('Cleared7');
    expect(status).toHaveTextContent('Time01:42');
    expect(status).toHaveTextContent('Resonance');
    expect(status).not.toHaveTextContent('Elian Voss');
    expect(status).not.toHaveTextContent('Enemies Remaining');
    expect(status).not.toHaveTextContent('Exploring');
  });
});
