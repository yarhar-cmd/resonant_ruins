import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { evaluationRooms } from '../../data/rooms/evaluationRooms';
import { createRoomEnemyState } from '../../utils/enemySystem';
import { createFreshRun } from '../../utils/runLifecycle';
import { PlaytestDiagnostics } from './PlaytestDiagnostics';

function renderDiagnostics(research?: ComponentProps<typeof PlaytestDiagnostics>['research']) {
  const room = evaluationRooms[3]!;
  const gameplay = createFreshRun({
    maximumHealth: 6,
    experiencePreset: 'new-delver',
    startedAt: 1_000,
    runId: 'diagnostic-run',
    runSeed: 'diagnostic-seed',
  });
  const enemies = createRoomEnemyState(room, 'new-delver', 10_000);
  enemies.rats[0] = {
    ...enemies.rats[0]!,
    awareness: 'alerted',
    facing: 'left',
    state: 'telegraphing',
    lockedTarget: { x: 8, y: 5 },
    telegraphEndsAt: 10_600,
    pathDistanceToPlayer: 3,
    nextPathStep: { x: 8, y: 5 },
    pathBlocked: true,
    bodyLockPreventionApplied: true,
  };
  enemies.combatMetrics.attacksStarted = 3;
  enemies.combatMetrics.perfectBlocks = 1;
  const state = {
    ...gameplay,
    enemies,
    evaluationProgress: {
      ...gameplay.evaluationProgress!,
      currentRoomIndex: 3,
      currentRoomId: room.id,
    },
  };
  const stateBeforeRender = structuredClone(state);
  render(
    <PlaytestDiagnostics
      gameplay={state}
      room={room}
      isInvulnerable={false}
      now={10_125}
      research={research}
    />,
  );
  return { state, stateBeforeRender };
}

describe('preview-safe Playtest Diagnostics panel', () => {
  it('opens and closes accessibly without changing reducer state or timers', () => {
    const { state, stateBeforeRender } = renderDiagnostics();
    const trigger = screen.getByRole('button', { name: 'PLAYTEST DIAGNOSTICS' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Playtest Diagnostics' });
    expect(panel).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close Playtest Diagnostics' })).toHaveFocus();
    expect(screen.getByText('475 ms', { exact: false })).toBeVisible();
    expect(screen.getByText('evaluation-room-04-rat-1')).toBeVisible();
    expect(screen.getByText('body-lock adjusted true', { exact: false })).toBeVisible();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Playtest Diagnostics' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(state).toEqual(stateBeforeRender);
  });

  it('is read-only and exposes no development mutation or reset controls', () => {
    renderDiagnostics();
    fireEvent.click(screen.getByRole('button', { name: 'PLAYTEST DIAGNOSTICS' }));
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /spawn/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /defeat/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /freeze/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('copies the required plain-text summary and confirms success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderDiagnostics();
    fireEvent.click(screen.getByRole('button', { name: 'PLAYTEST DIAGNOSTICS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Diagnostic Summary' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).toContain('seed authored-room');
    expect(writeText.mock.calls[0]![0]).toContain('game=mvp-0.4 generator=generator-4');
    expect(writeText.mock.calls[0]![0]).toContain('evaluation-room-04-rat-1');
    expect(writeText.mock.calls[0]![0]).toContain('timers=475/0/0ms');
    expect(screen.getByRole('status')).toHaveTextContent('Diagnostic summary copied.');
    vi.unstubAllGlobals();
  });

  it('handles clipboard failure without closing the panel or changing gameplay', async () => {
    const { state, stateBeforeRender } = renderDiagnostics();
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('denied')) };
    vi.stubGlobal('navigator', { clipboard });
    fireEvent.click(screen.getByRole('button', { name: 'PLAYTEST DIAGNOSTICS' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Diagnostic Summary' }));

    expect(await screen.findByText('Unable to copy diagnostic summary.')).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Playtest Diagnostics' })).toBeVisible();
    expect(state).toEqual(stateBeforeRender);
    vi.unstubAllGlobals();
  });

  it('shows read-only Research Mode provenance and persistence diagnostics in Preview', () => {
    renderDiagnostics({
      runMode: 'research',
      pilot: true,
      sessionId: 'research-session-preview',
      participantCodePresent: true,
      condition: 'NEUTRAL_PROCEDURAL',
      assignmentMethod: 'balanced-two-run-blocks-1',
      selectorId: 'neutral-procedural',
      selectorVersion: 'neutral-selector-1',
      profileConsumed: false,
      sharedPoolId: 'pool-preview',
      requestedCandidateCount: 20,
      validCandidateCount: 20,
      rejectedCandidateCount: 2,
      pendingFeedbackRoom: 'generated-room-preview',
      pendingOutcomeStatus: 'completed',
      finalizedRecordStatus: 'pending',
      recordCount: 4,
      invalidRecordCount: 0,
      researchSchema: 'research-1',
      feedbackSchema: 'feedback-1',
      storageSizeBytes: 4096,
      activePersistenceKey: 'resonant-ruins:research-active-run:v1',
      writePolicy: {
        mode: 'research',
        writeNormalActiveRun: false,
        writeResearchActiveRun: true,
        writePermanentProfile: false,
        writeResearchSessionProfile: true,
        writeNormalHistory: false,
        writeNormalBestRecords: false,
        writeResearchDataset: true,
        writeSandboxState: false,
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'PLAYTEST DIAGNOSTICS' }));

    expect(screen.getByRole('heading', { name: 'Research session' })).toBeVisible();
    expect(screen.getByText('research / Pilot')).toBeVisible();
    expect(screen.getByText('NEUTRAL_PROCEDURAL / balanced-two-run-blocks-1')).toBeVisible();
    expect(screen.getByText('neutral-procedural / neutral-selector-1 / false')).toBeVisible();
    expect(screen.getByText('unavailable (No model installed) / disabled')).toBeVisible();
  });
});
