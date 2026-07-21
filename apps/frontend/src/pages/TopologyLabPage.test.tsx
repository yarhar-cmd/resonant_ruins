import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { TopologyLabPage } from './TopologyLabPage';

describe('Resonant Ruins Topology Lab sandbox', () => {
  beforeEach(() => localStorage.clear());

  it('generates in memory, visibly labels SANDBOX, and does not touch normal storage', () => {
    localStorage.setItem('mirrorvault:active-run:v1', 'preserve-active');
    localStorage.setItem('mirrorvault:player-profile:v1', 'preserve-profile');
    localStorage.setItem('mirrorvault:run-archive:v1', 'preserve-history');
    render(<TopologyLabPage />);
    expect(screen.getByText(/SANDBOX · persistence guards active/)).toBeVisible();
    expect(screen.getByLabelText('Generated room ASCII map')).toHaveTextContent('F');
    fireEvent.change(screen.getByLabelText('Archetype'), { target: { value: 'true-l-ruin' } });
    fireEvent.change(screen.getByLabelText('Placement'), { target: { value: 'risky' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate new seed' }));
    expect(screen.getAllByText('true-l-ruin')).toHaveLength(2);
    expect(localStorage.getItem('mirrorvault:active-run:v1')).toBe('preserve-active');
    expect(localStorage.getItem('mirrorvault:player-profile:v1')).toBe('preserve-profile');
    expect(localStorage.getItem('mirrorvault:run-archive:v1')).toBe('preserve-history');
  });
});
