import { useEffect, useId, useRef, useState } from 'react';
import { RESEARCH_FEEDBACK_QUESTIONS } from '../../config/research';
import type { PendingRoomFeedback, RoomFeedback } from '../../types/research';
import { ConfirmationDialog } from './ConfirmationDialog';

const difficultyLabels = {
  too_easy: 'Too Easy',
  about_right: 'About Right',
  too_hard: 'Too Hard',
} as const;

const fairnessLabels = ['Very Unfair', 'Unfair', 'Neutral', 'Fair', 'Very Fair'] as const;
const enjoymentLabels = ['Not Enjoyable', '2', 'Neutral', '4', 'Very Enjoyable'] as const;

export function RoomFeedbackDialog({
  pending,
  onChange,
  onFinalize,
}: {
  pending: PendingRoomFeedback;
  onChange: (feedback: RoomFeedback) => boolean;
  onFinalize: (feedback: RoomFeedback) => boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const firstRadioRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [message, setMessage] = useState('');
  const feedback = pending.record.feedback;
  const defeated = pending.record.outcome.status === 'defeated';

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    firstRadioRef.current?.focus();
    return () => restoreFocusRef.current?.focus();
  }, []);

  function change(next: RoomFeedback) {
    if (!onChange(next)) setMessage('Your answer could not be saved. Check browser storage.');
    else setMessage('Answer saved locally.');
  }

  function submit() {
    if (!feedback.difficulty) {
      setMessage('Choose a difficulty answer or explicitly skip the feedback dialog.');
      firstRadioRef.current?.focus();
      return;
    }
    const submittedAt = feedback.submittedAt ?? new Date().toISOString();
    const finalized: RoomFeedback = {
      ...feedback,
      status: 'submitted',
      skippedFields: [
        ...(feedback.fairness === null ? (['fairness'] as const) : []),
        ...(feedback.enjoyment === null ? (['enjoyment'] as const) : []),
      ],
      submittedAt,
      responseDurationMs: Math.max(0, Date.parse(submittedAt) - Date.parse(pending.createdAt)),
    };
    if (!onFinalize(finalized)) setMessage('Feedback could not be finalized. Please try again.');
  }

  function confirmSkip() {
    const submittedAt = feedback.submittedAt ?? new Date().toISOString();
    const skipped: RoomFeedback = {
      ...feedback,
      status: 'skipped',
      difficulty: null,
      fairness: null,
      enjoyment: null,
      skippedFields: ['fairness', 'enjoyment'],
      fullDialogSkipped: true,
      submittedAt,
      responseDurationMs: Math.max(0, Date.parse(submittedAt) - Date.parse(pending.createdAt)),
    };
    setSkipConfirmation(false);
    if (!onFinalize(skipped)) setMessage('The skip could not be saved. Please try again.');
  }

  return (
    <div className="room-feedback-backdrop">
      <section
        ref={dialogRef}
        className="room-feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setSkipConfirmation(true);
            return;
          }
          if (event.key !== 'Tab') return;
          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>('input,button') ?? [],
          ).filter((element) => !element.hasAttribute('disabled'));
          const first = focusable[0];
          const last = focusable.at(-1);
          if (!first || !last) return;
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <p className="eyebrow">{defeated ? 'Room ended' : 'Room complete'}</p>
        <h2 id={titleId}>A quick room rating</h2>
        <p>
          Your answers are saved locally with the room that just{' '}
          {defeated ? 'ended in defeat' : 'completed'}.
        </p>

        <fieldset>
          <legend>{RESEARCH_FEEDBACK_QUESTIONS.difficulty.prompt}</legend>
          <div className="room-feedback-options room-feedback-options--three">
            {RESEARCH_FEEDBACK_QUESTIONS.difficulty.options.map((value, index) => (
              <label key={value}>
                <input
                  ref={index === 0 ? firstRadioRef : undefined}
                  type="radio"
                  name="difficulty"
                  value={value}
                  checked={feedback.difficulty === value}
                  onChange={() => change({ ...feedback, difficulty: value })}
                />
                <span>{difficultyLabels[value]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <RatingGroup
          name="fairness"
          prompt={RESEARCH_FEEDBACK_QUESTIONS.fairness.prompt}
          labels={fairnessLabels}
          value={feedback.fairness}
          onChange={(fairness) => change({ ...feedback, fairness })}
        />
        <RatingGroup
          name="enjoyment"
          prompt={RESEARCH_FEEDBACK_QUESTIONS.enjoyment.prompt}
          labels={enjoymentLabels}
          value={feedback.enjoyment}
          onChange={(enjoyment) => change({ ...feedback, enjoyment })}
        />

        {message && (
          <p className="room-feedback-message" role="status">
            {message}
          </p>
        )}
        <div className="room-feedback-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setSkipConfirmation(true)}
          >
            Skip feedback
          </button>
          <button className="button button--primary" type="button" onClick={submit}>
            {defeated ? 'Submit and view results' : 'Submit and continue'}
          </button>
        </div>
      </section>
      <ConfirmationDialog
        open={skipConfirmation}
        title="Skip this room’s feedback?"
        confirmLabel="Confirm skip"
        onCancel={() => setSkipConfirmation(false)}
        onConfirm={confirmSkip}
      >
        <p>This records an explicit skip. Press Cancel to return to the questions.</p>
      </ConfirmationDialog>
    </div>
  );
}

function RatingGroup({
  name,
  prompt,
  labels,
  value,
  onChange,
}: {
  name: 'fairness' | 'enjoyment';
  prompt: string;
  labels: readonly string[];
  value: 1 | 2 | 3 | 4 | 5 | null;
  onChange: (value: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <fieldset>
      <legend>
        {prompt} <small>(optional)</small>
      </legend>
      <div className="room-feedback-options room-feedback-options--five">
        {([1, 2, 3, 4, 5] as const).map((rating) => (
          <label key={rating}>
            <input
              type="radio"
              name={name}
              value={rating}
              checked={value === rating}
              aria-label={`${rating} — ${labels[rating - 1]}`}
              onChange={() => onChange(rating)}
            />
            <span>
              <strong>{rating}</strong>
              <small>{labels[rating - 1]}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
