import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { researchFixture } from '../../test/researchFixtures';
import { loadResearchStorage, saveResearchStorage } from '../../services/researchStorage';
import { ResearchDataPanel } from './ResearchDataPanel';

function pilotEnvelope() {
  const fixture = researchFixture();
  fixture.record.pilot = true;
  fixture.run.pilot = true;
  fixture.run.rooms = [fixture.record];
  fixture.session.pilot = true;
  fixture.session.runs = [fixture.run];
  return {
    researchSchemaVersion: 'research-1' as const,
    activeSessionId: null,
    sessions: [fixture.session],
  };
}

describe('Research data management panel', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:test'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('excludes Pilot data by default and exposes an explicit include toggle', () => {
    const data = pilotEnvelope();
    render(<ResearchDataPanel data={data} onChanged={() => undefined} />);
    expect(screen.getByLabelText('Include Pilot Data')).not.toBeChecked();
    expect(screen.getByText('Sessions').nextElementSibling).toHaveTextContent('0');
    fireEvent.click(screen.getByLabelText('Include Pilot Data'));
    expect(screen.getByText('Sessions').nextElementSibling).toHaveTextContent('1');
  });

  it('prepares validated JSON and CSV downloads', () => {
    const data = pilotEnvelope();
    render(<ResearchDataPanel data={data} onChanged={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export all JSON' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export all CSV' }));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('CSV export prepared locally.');
  });

  it('requires confirmation and deletes Pilot data without touching Official data', () => {
    const data = pilotEnvelope();
    const official = { ...data.sessions[0]!, id: 'official-preserved', pilot: false };
    const stored = { ...data, sessions: [...data.sessions, official] };
    expect(saveResearchStorage(stored)).toBeNull();
    const changed = vi.fn();
    render(<ResearchDataPanel data={stored} onChanged={changed} />);
    fireEvent.click(screen.getByRole('button', { name: /Delete Pilot Data/ }));
    expect(screen.getByRole('alertdialog', { name: 'Delete all Pilot data?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete research data' }));
    expect(loadResearchStorage().data.sessions.map(({ id }) => id)).toEqual(['official-preserved']);
    expect(changed).toHaveBeenCalledOnce();
  });
});
