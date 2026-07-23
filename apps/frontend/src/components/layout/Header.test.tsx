import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/environment', () => ({
  MODEL_LAB_ENABLED: true,
  TOPOLOGY_LAB_ENABLED: true,
}));

import { Header } from './Header';
import { MobileNavigation } from './MobileNavigation';

describe('simplified Resonant Ruins navigation', () => {
  it('keeps five player destinations primary and groups both Preview tools under Labs', () => {
    render(<Header />, { wrapper: MemoryRouter });
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const label of ['Home', 'Play', 'Research', 'History', 'Settings'])
      expect(within(navigation).getByRole('link', { name: label })).toBeVisible();

    const labs = within(navigation).getByText('Labs').closest('details')!;
    expect(labs).not.toHaveAttribute('open');
    fireEvent.click(within(labs).getByText('Labs'));
    expect(labs).toHaveAttribute('open');
    expect(within(labs).getByRole('link', { name: 'Topology Lab' })).toHaveAttribute(
      'href',
      '/topology-lab',
    );
    expect(within(labs).getByRole('link', { name: 'Model Lab' })).toHaveAttribute(
      'href',
      '/model-lab',
    );
  });

  it('uses the same five primary destinations in the compact mobile navigation', () => {
    render(<MobileNavigation />, { wrapper: MemoryRouter });
    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
    expect(
      within(navigation)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Home', 'Play', 'Research', 'History', 'Settings']);
  });
});
