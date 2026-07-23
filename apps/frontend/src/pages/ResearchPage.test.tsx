import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdventureProvider } from '../context/AdventureProvider';
import { RESEARCH_ACTIVE_RUN_KEY, RESEARCH_STORAGE_KEY } from '../config/research';
import { loadResearchStorage, startResearchSession } from '../services/researchStorage';
import { ResearchPage } from './ResearchPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/research']}>
      <AdventureProvider>
        <Routes>
          <Route path="research" element={<ResearchPage />} />
          <Route path="research/run" element={<p>Research run route</p>} />
        </Routes>
      </AdventureProvider>
    </MemoryRouter>,
  );
}

describe('Research Mode opt-in page', () => {
  beforeEach(() => localStorage.clear());

  it('records nothing before explicit opt-in and explains local-only participation', () => {
    renderPage();
    expect(screen.getByText(/Nothing is automatically uploaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Pilot Session' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start Research Session' })).toBeDisabled();
    expect(localStorage.getItem(RESEARCH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(RESEARCH_ACTIVE_RUN_KEY)).toBeNull();
    const researchData = screen.getByText('Research Data').closest('details')!;
    expect(researchData).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Research Data'));
    expect(researchData).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: 'Browser-local records' })).toBeVisible();
  });

  it('starts a labeled Pilot session without overwriting a normal active run', async () => {
    localStorage.setItem('mirrorvault:active-run:v1', 'normal-save-sentinel');
    renderPage();
    fireEvent.change(screen.getByLabelText('Optional participant code'), {
      target: { value: 'PILOT_02' },
    });
    fireEvent.click(screen.getByLabelText(/I have read this notice and choose to start/i));
    fireEvent.click(screen.getByRole('button', { name: 'Start Pilot Session' }));
    await screen.findByText('Research run route');
    const stored = loadResearchStorage().data;
    expect(stored.sessions[0]).toMatchObject({
      pilot: true,
      participantCode: 'PILOT_02',
      runs: [{ pilot: true, status: 'active' }],
    });
    expect(localStorage.getItem(RESEARCH_ACTIVE_RUN_KEY)).not.toBeNull();
    expect(localStorage.getItem('mirrorvault:active-run:v1')).toBe('normal-save-sentinel');
  });

  it('shows an accessible validation error for an unsafe participant code', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Optional participant code'), {
      target: { value: 'unsafe code' },
    });
    fireEvent.click(screen.getByLabelText(/I have read this notice and choose to start/i));
    fireEvent.click(screen.getByRole('button', { name: 'Start Research Session' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Invalid participant code.'),
    );
    expect(localStorage.getItem(RESEARCH_STORAGE_KEY)).toBeNull();
  });

  it('starts another balanced run inside an existing session when no run is active', async () => {
    const started = startResearchSession({
      pilot: false,
      id: 'multi-run-session',
      sessionSeed: 'balanced-session',
      now: 1_000,
    });
    expect(started.issue).toBeNull();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start next research run' }));
    await screen.findByText('Research run route');
    expect(loadResearchStorage().data.sessions[0]?.runs).toHaveLength(1);
    expect(localStorage.getItem(RESEARCH_ACTIVE_RUN_KEY)).not.toBeNull();
  });
});
