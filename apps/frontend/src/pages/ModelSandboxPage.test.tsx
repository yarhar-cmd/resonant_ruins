import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ModelSandboxPage } from './ModelSandboxPage';

vi.mock('../model/counterfactualSandbox', () => ({
  getCounterfactualSandbox: () => ({ candidateId: 'candidate-1', record: {} }),
}));
vi.mock('./DungeonRunPage', () => ({
  DungeonRunSession: () => <p>Playable sandbox room</p>,
}));

describe('Model Sandbox page', () => {
  it('keeps the non-evidence warning visible around the playable room', () => {
    render(
      <MemoryRouter initialEntries={['/model-lab/sandbox?token=sandbox-1']}>
        <ModelSandboxPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Counterfactual Sandbox')).toBeVisible();
    expect(screen.getByText(/not originally played/i)).toBeVisible();
    expect(screen.getByText(/not official research evidence/i)).toBeVisible();
    expect(screen.getByText('Playable sandbox room')).toBeVisible();
  });
});
