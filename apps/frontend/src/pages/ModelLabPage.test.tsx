import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCounterfactualSandbox } from '../model/counterfactualSandbox';
import { clearDevelopmentShadowArtifact } from '../model/developmentModelSelection';
import developmentArtifactValue from '../model/__fixtures__/development-artifact-1.json';
import { createResearchExport } from '../research/export';
import { researchFixture } from '../test/researchFixtures';
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

  it('exposes explicit sandbox-local reward overrides in the gated Model Lab only', () => {
    render(
      <MemoryRouter>
        <ModelLabPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: 'Launch with forced Resonance Cache' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Launch with rewards disabled' })).toBeVisible();
  });

  it('validates artifact and ResearchExport imports and refuses reconstructed replay', async () => {
    render(
      <MemoryRouter>
        <ModelLabPage />
      </MemoryRouter>,
    );
    const artifactInput = screen.getByLabelText('Import artifact JSON');
    fireEvent.change(artifactInput, {
      target: { files: [{ text: async () => '{invalid' } as File] },
    });
    expect(await screen.findByText(/Artifact rejected: file is not valid JSON/i)).toBeVisible();
    fireEvent.change(artifactInput, {
      target: {
        files: [{ text: async () => JSON.stringify(developmentArtifactValue) } as File],
      },
    });
    await waitFor(() => expect(screen.getByText(/loaded in memory/i)).toBeVisible());

    const fixture = researchFixture();
    fixture.run.rooms = [fixture.record];
    fixture.session.runs = [fixture.run];
    const researchExport = createResearchExport(
      [fixture.session],
      'session',
      '2026-01-02T00:00:00.000Z',
    );
    fireEvent.change(screen.getByLabelText('Import ResearchExport JSON'), {
      target: {
        files: [{ text: async () => JSON.stringify(researchExport) } as File],
      },
    });
    expect(await screen.findByText(/ResearchExport validated in memory/i)).toBeVisible();
    expect(screen.getByText(/1 imported rooms/i)).toBeVisible();
    expect(screen.getByText(/replay is disabled/i)).toBeVisible();
  });
});
