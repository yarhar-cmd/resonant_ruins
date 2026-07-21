import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { researchFixture } from '../../test/researchFixtures';
import type { PendingRoomFeedback, RoomFeedback } from '../../types/research';
import { RoomFeedbackDialog } from './RoomFeedbackDialog';

describe('Room feedback dialog', () => {
  it('supports pointer submission and requires difficulty', () => {
    const finalize = vi.fn(() => true);
    render(<FeedbackHarness initial={researchFixture().pending} onFinalize={finalize} />);
    fireEvent.click(screen.getByRole('button', { name: 'Submit and continue' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Choose a difficulty answer/i);
    fireEvent.click(screen.getByLabelText('About Right'));
    fireEvent.click(screen.getByLabelText('4 — Fair'));
    fireEvent.click(screen.getByLabelText('5 — Very Enjoyable'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit and continue' }));
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'submitted',
        difficulty: 'about_right',
        fairness: 4,
        enjoyment: 5,
      }),
    );
  });

  it('turns Escape into an explicit skip confirmation', () => {
    const finalize = vi.fn(() => true);
    render(
      <RoomFeedbackDialog
        pending={researchFixture().pending}
        onChange={() => true}
        onFinalize={finalize}
      />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(
      screen.getByRole('alertdialog', { name: /Skip this room’s feedback/i }),
    ).toBeInTheDocument();
    expect(finalize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm skip' }));
    expect(finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'skipped',
        fullDialogSkipped: true,
      }),
    );
  });
});

function FeedbackHarness({
  initial,
  onFinalize,
}: {
  initial: PendingRoomFeedback;
  onFinalize: (feedback: RoomFeedback) => boolean;
}) {
  const [pending, setPending] = useState(initial);
  return (
    <RoomFeedbackDialog
      pending={pending}
      onChange={(feedback) => {
        setPending((current) => ({
          ...current,
          record: { ...current.record, feedback },
        }));
        return true;
      }}
      onFinalize={onFinalize}
    />
  );
}
