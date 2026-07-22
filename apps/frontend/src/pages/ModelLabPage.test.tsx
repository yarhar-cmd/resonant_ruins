import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCounterfactualSandbox } from '../model/counterfactualSandbox';
import { clearDevelopmentShadowArtifact } from '../model/developmentModelSelection';
import { ModelLabPage } from './ModelLabPage';

describe('Resonant Ruins Model Comparison Lab', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCounterfactualSandbox();
    clearDevelopmentShadowArtifact();
  });
  afterEach(clearDevelopmentShadowArtifact);

  it('compares an explicitly selected fixture without persisting state', () => {
    localStorage.setItem('mirrorvault:active-run:v1', 'preserve-active');
    const before = { ...localStorage };
    render(
      <MemoryRouter>
        <ModelLabPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Model Comparison Lab' })).toBeVisible();
    expect(screen.getByText(/imports and experiments stay in memory/i)).toBeVisible();
    expect(screen.getAllByText(/No model selected/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Select synthetic fixture' }));
    expect(screen.getByText(/Synthetic development fixture selected explicitly/i)).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'About Right' })).toBeVisible();
    expect(screen.getByText(/associations, not causes/i)).toBeVisible();
    expect({ ...localStorage }).toEqual(before);
  });

  it('launches exact in-memory geometry only through the counterfactual sandbox route', () => {
    render(
      <MemoryRouter initialEntries={['/model-lab']}>
        <Routes>
          <Route path="model-lab" element={<ModelLabPage />} />
          <Route path="model-lab/sandbox" element={<p>Sandbox route reached</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Launch Counterfactual Sandbox' }));
    expect(screen.getByText('Sandbox route reached')).toBeVisible();
  });
});
