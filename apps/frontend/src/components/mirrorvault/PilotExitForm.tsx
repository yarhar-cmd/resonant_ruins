import { useState, type FormEvent } from 'react';
import type { PilotSessionExit } from '../../types/research';
import { PrimaryButton } from '../common/Buttons';
import { Panel } from '../common/Panel';

export function PilotExitForm({ onSubmit }: { onSubmit: (value: PilotSessionExit) => boolean }) {
  const [instructionClarity, setInstructionClarity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [surveyFatigue, setSurveyFatigue] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [sessionLength, setSessionLength] =
    useState<PilotSessionExit['sessionLength']>('about_right');
  const [technicalProblem, setTechnicalProblem] =
    useState<PilotSessionExit['technicalProblem']>('no');
  const [technicalProblemDescription, setTechnicalProblemDescription] = useState('');
  const [overallPreference, setOverallPreference] =
    useState<PilotSessionExit['overallPreference']>('no_preference');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const saved = onSubmit({
      schemaVersion: 'pilot-exit-1',
      instructionClarity,
      surveyFatigue,
      sessionLength,
      technicalProblem,
      technicalProblemDescription:
        technicalProblem === 'yes' && technicalProblemDescription.trim()
          ? technicalProblemDescription.trim()
          : null,
      overallPreference,
      comment: comment.trim() || null,
      submittedAt: new Date().toISOString(),
    });
    setMessage(
      saved ? 'Completion responses saved in this browser.' : 'Responses could not be saved.',
    );
  }

  return (
    <Panel className="pilot-exit-form" eyebrow="Optional completion form">
      <form onSubmit={submit}>
        <label>
          <span>Instruction clarity (1–5)</span>
          <select
            value={instructionClarity}
            onChange={(event) =>
              setInstructionClarity(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)
            }
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Room-survey fatigue or repetitiveness (1–5)</span>
          <select
            value={surveyFatigue}
            onChange={(event) => setSurveyFatigue(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Session length</span>
          <select
            value={sessionLength}
            onChange={(event) =>
              setSessionLength(event.target.value as PilotSessionExit['sessionLength'])
            }
          >
            <option value="too_short">Too short</option>
            <option value="about_right">About right</option>
            <option value="too_long">Too long</option>
          </select>
        </label>
        <label>
          <span>Did you encounter a technical problem?</span>
          <select
            value={technicalProblem}
            onChange={(event) =>
              setTechnicalProblem(event.target.value as PilotSessionExit['technicalProblem'])
            }
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        {technicalProblem === 'yes' && (
          <label>
            <span>Optional technical-problem description</span>
            <textarea
              maxLength={2000}
              value={technicalProblemDescription}
              onChange={(event) => setTechnicalProblemDescription(event.target.value)}
            />
          </label>
        )}
        <label>
          <span>Which run did you prefer overall?</span>
          <select
            value={overallPreference}
            onChange={(event) =>
              setOverallPreference(event.target.value as PilotSessionExit['overallPreference'])
            }
          >
            <option value="run_a">Run A</option>
            <option value="run_b">Run B</option>
            <option value="no_preference">No preference</option>
          </select>
        </label>
        <label>
          <span>Optional comment</span>
          <textarea
            maxLength={4000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        <PrimaryButton type="submit">Save optional responses</PrimaryButton>
        {message && <p role="status">{message}</p>}
      </form>
    </Panel>
  );
}
