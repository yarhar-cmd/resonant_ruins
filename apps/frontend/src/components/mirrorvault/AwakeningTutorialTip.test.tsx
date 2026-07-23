import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  EVALUATION_ROOM_1_ID,
  EVALUATION_ROOM_2_ID,
  EVALUATION_ROOM_3_ID,
  EVALUATION_ROOM_4_ID,
  EVALUATION_ROOM_5_ID,
} from '../../data/rooms/evaluationRooms';
import { PERFECT_BLOCK_TUTORIAL } from '../../data/rooms/awakeningTutorial';
import { AwakeningTutorialTip } from './AwakeningTutorialTip';

const baseProps = {
  runMode: 'normal' as const,
  inGeneratedDungeon: false,
  playerPosition: { row: 5, column: 1 },
  fountainUsed: false,
  ratTelegraphing: false,
};

describe('Resonant Ruins Awakening tutorial tips', () => {
  it('shows only normal-mode authored Chamber tips and excludes research and generated rooms', () => {
    const { rerender } = render(
      <AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_1_ID} />,
    );
    expect(screen.getByLabelText('Awakening Chamber tutorial')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Move with WASD or the arrow keys. Step into the glowing exit to continue.',
    );

    rerender(
      <AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_1_ID} runMode="research" />,
    );
    expect(screen.queryByLabelText('Awakening Chamber tutorial')).not.toBeInTheDocument();

    rerender(
      <AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_1_ID} inGeneratedDungeon />,
    );
    expect(screen.queryByLabelText('Awakening Chamber tutorial')).not.toBeInTheDocument();
  });

  it('dismisses the movement tip after several unique tiles and survives ordinary rerenders', () => {
    const { rerender } = render(
      <AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_1_ID} />,
    );
    for (const column of [2, 3]) {
      rerender(
        <AwakeningTutorialTip
          {...baseProps}
          roomId={EVALUATION_ROOM_1_ID}
          playerPosition={{ row: 5, column }}
        />,
      );
      expect(screen.getByRole('status')).toBeVisible();
    }
    rerender(
      <AwakeningTutorialTip
        {...baseProps}
        roomId={EVALUATION_ROOM_1_ID}
        playerPosition={{ row: 5, column: 4 }}
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses the Rune tip after passing its teaching section', () => {
    const { rerender } = render(
      <AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_2_ID} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Red Runes deal damage. Look for a safe path—or take the riskier route.',
    );

    rerender(
      <AwakeningTutorialTip
        {...baseProps}
        roomId={EVALUATION_ROOM_2_ID}
        playerPosition={{ row: 5, column: 10 }}
      />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the Fountain tip through rerenders and dismisses it after successful use', () => {
    const { rerender } = render(
      <AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_3_ID} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Face the Restoration Fountain and hold E to recover health.',
    );
    rerender(
      <AwakeningTutorialTip
        {...baseProps}
        roomId={EVALUATION_ROOM_3_ID}
        playerPosition={{ row: 4, column: 4 }}
      />,
    );
    expect(screen.getByRole('status')).toBeVisible();
    rerender(<AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_3_ID} fountainUsed />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('announces the perfect-block follow-up once and does not revert after the telegraph', () => {
    const { rerender } = render(
      <AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_4_ID} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Attack with Space. Face an incoming Rat and hold Shift to block.',
    );

    rerender(<AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_4_ID} ratTelegraphing />);
    expect(screen.getByRole('status')).toHaveTextContent(PERFECT_BLOCK_TUTORIAL);
    rerender(<AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_4_ID} />);
    expect(screen.getByRole('status')).toHaveTextContent(PERFECT_BLOCK_TUTORIAL);
  });

  it('uses one combined Chamber 5 message and exposes a keyboard-focusable dismiss action', () => {
    render(<AwakeningTutorialTip {...baseProps} roomId={EVALUATION_ROOM_5_ID} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Combine what you’ve learned: avoid Runes, defeat the Rats, and use the Fountain when needed.',
    );
    const dismiss = screen.getByRole('button', { name: 'Dismiss tutorial tip' });
    dismiss.focus();
    expect(dismiss).toHaveFocus();
    fireEvent.click(dismiss);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
