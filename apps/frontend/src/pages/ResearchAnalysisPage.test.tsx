import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createResearchExport, researchExportJson } from '../research/export';
import { completeConditionSession } from '../research/analysis/testFixtures';
import { RESEARCH_STORAGE_KEY } from '../config/research';
import { startResearchSession } from '../services/researchStorage';
import { ResearcherOnlyRoute } from '../routes/AppRoutes';
import { ResearchAnalysisPage } from './ResearchAnalysisPage';

function analysisExport(
  participantCode: string,
  condition: 'RULES_ADAPTIVE' | 'NEUTRAL_PROCEDURAL',
  difficulty: 'about_right' | 'too_hard',
  pilot = false,
) {
  return researchExportJson(
    createResearchExport(
      [
        completeConditionSession({
          id: `${participantCode}-${condition}`,
          participantCode,
          condition,
          difficulties: [difficulty],
          pilot,
        }),
      ],
      'session',
      '2026-06-02T00:00:00.000Z',
    ),
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/research/analysis']}>
      <Routes>
        <Route path="research/analysis" element={<ResearchAnalysisPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function upload(files: File[]) {
  fireEvent.change(screen.getByLabelText('Research export files'), {
    target: { files },
  });
}

describe('local Research Analysis Lab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('imports multiple canonical files, shows audit totals, tables, and accessible chart summaries', async () => {
    localStorage.setItem(RESEARCH_STORAGE_KEY, 'live-storage-sentinel');
    renderPage();
    upload([
      new File([analysisExport('P001', 'RULES_ADAPTIVE', 'about_right')], 'adaptive.json', {
        type: 'application/json',
      }),
      new File([analysisExport('P001', 'NEUTRAL_PROCEDURAL', 'too_hard')], 'neutral.json', {
        type: 'application/json',
      }),
    ]);

    await screen.findByText('2 files accepted; 0 rejected.');
    expect(screen.getByText('Paired participant About Right Rate')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /P001: Adaptive 100.0%, Neutral 0.0%/i })).toBeVisible();
    expect(screen.getByText('Participant-condition summaries')).toBeInTheDocument();
    expect(screen.getByText(/Adaptive minus neutral: mean 100.0%/i)).toBeVisible();
    expect(screen.getAllByText('2')).not.toHaveLength(0);
    expect(localStorage.getItem(RESEARCH_STORAGE_KEY)).toBe('live-storage-sentinel');
  });

  it('shows filename-specific validation failures and filter changes', async () => {
    renderPage();
    upload([
      new File([analysisExport('OFFICIAL', 'RULES_ADAPTIVE', 'about_right')], 'official.json'),
      new File([analysisExport('PILOT', 'NEUTRAL_PROCEDURAL', 'too_hard', true)], 'pilot.json'),
      new File(['{"not":"a research export"}'], 'broken.json'),
    ]);

    await screen.findByText('2 files accepted; 1 rejected.');
    expect(screen.getByRole('alert')).toHaveTextContent('broken.json');
    expect(screen.getByRole('alert')).toHaveTextContent('researchSchemaVersion');
    expect(screen.getByText('1 matching session')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Pilot status'), { target: { value: 'all' } });
    expect(await screen.findByText('2 matching sessions')).toBeVisible();
    expect(screen.getByText(/Pilot data is visible/i)).toBeVisible();
  });

  it('clears imported memory only after confirmation', async () => {
    localStorage.setItem(RESEARCH_STORAGE_KEY, 'live-storage-sentinel');
    renderPage();
    upload([
      new File([analysisExport('P001', 'RULES_ADAPTIVE', 'about_right')], 'participant.json'),
    ]);
    await screen.findByText('1 file accepted; 0 rejected.');

    fireEvent.click(screen.getByRole('button', { name: 'Clear imported analysis data' }));
    expect(screen.getByRole('alertdialog')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Clear imported data' }));
    expect(await screen.findByText('Imported analysis data cleared from memory.')).toBeVisible();
    expect(screen.getByText('0 matching sessions')).toBeVisible();
    expect(localStorage.getItem(RESEARCH_STORAGE_KEY)).toBe('live-storage-sentinel');
  });

  it('imports server evidence through the normal pipeline without storing the token', async () => {
    localStorage.setItem(RESEARCH_STORAGE_KEY, 'live-storage-sentinel');
    const body = analysisExport('REMOTE', 'RULES_ADAPTIVE', 'about_right');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    renderPage();
    fireEvent.change(screen.getByLabelText('Research admin token'), {
      target: { value: 'test-admin-token' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import from research server' }));
    expect(await screen.findByText('1 session(s) imported from research-server.')).toBeVisible();
    expect(screen.getByText('1 matching session')).toBeVisible();
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer test-admin-token',
    });
    expect(localStorage.getItem(RESEARCH_STORAGE_KEY)).toBe('live-storage-sentinel');
    expect(JSON.stringify({ ...localStorage })).not.toContain('test-admin-token');
  });

  it('downloads participant, paired, quality, and summary artifacts explicitly', async () => {
    const createObjectUrl = vi.fn(() => 'blob:test');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderPage();
    upload([
      new File([analysisExport('P001', 'RULES_ADAPTIVE', 'about_right')], 'adaptive.json'),
      new File([analysisExport('P001', 'NEUTRAL_PROCEDURAL', 'too_hard')], 'neutral.json'),
    ]);
    await screen.findByText('2 files accepted; 0 rejected.');

    for (const name of [
      'Participant CSV',
      'Paired CSV',
      'Quality CSV',
      'Quality JSON',
      'Summary JSON',
    ]) {
      fireEvent.click(screen.getByRole('button', { name }));
    }

    await waitFor(() => expect(createObjectUrl).toHaveBeenCalledTimes(5));
    expect(click).toHaveBeenCalledTimes(5);
  });

  it('redirects active fixed-Pilot participants before Analysis Lab DOM is rendered', async () => {
    const started = startResearchSession({
      pilot: true,
      participantCode: 'MASKED',
      participantSequence: 1,
      experiencePreset: 'seasoned-adventurer',
      id: 'active-pilot',
      now: 1_000,
    });
    expect(started.issue).toBeNull();

    render(
      <MemoryRouter initialEntries={['/research/analysis']}>
        <Routes>
          <Route
            path="research/analysis"
            element={
              <ResearcherOnlyRoute>
                <p>Imported condition evidence</p>
              </ResearcherOnlyRoute>
            }
          />
          <Route path="research" element={<h1>Participant Research Mode</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Participant Research Mode' })).toBeVisible();
    expect(screen.queryByText('Imported condition evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('RULES_ADAPTIVE')).not.toBeInTheDocument();
  });
});
