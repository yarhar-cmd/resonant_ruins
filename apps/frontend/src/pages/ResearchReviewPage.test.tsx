import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ResearchReviewPage } from './ResearchReviewPage';
import { researchFixture } from '../test/researchFixtures';
import {
  createResearchRun,
  createResearchSession,
  saveResearchStorage,
} from '../services/researchStorage';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';

describe('Pilot researcher verification', () => {
  beforeEach(() => localStorage.clear());

  it('shows masked-block evidence, counts, validation, and export controls', () => {
    const template = researchFixture().record;
    const session = createResearchSession({
      pilot: true,
      participantCode: 'PILOT_REVIEW',
      participantSequence: 2,
      experiencePreset: 'new-delver',
      id: 'review-session',
      now: 1_000,
    });
    session.practiceCompletedAt = new Date(2_000).toISOString();
    session.practiceChambersCompleted = 5;
    session.sharedPracticeBaseline = { ...NEUTRAL_ADAPTIVE_PROFILE };
    const runA = createResearchRun({
      session,
      characterId: 'warden',
      experiencePreset: 'new-delver',
      id: 'review-run-a',
    });
    runA.status = 'completed';
    runA.endedAt = new Date(20_000).toISOString();
    runA.rooms = Array.from({ length: 10 }, (_, offset) => ({
      ...template,
      researchSessionId: session.id,
      runId: runA.id,
      participantCode: session.participantCode,
      condition: runA.condition,
      assignmentMethodId: 'pilot-sequence-alternation-1' as const,
      protocolId: 'fixed-pilot-1' as const,
      runLabel: 'Run A' as const,
      conditionBlockIndex: 0 as const,
      gameplayAttemptId: runA.gameplayAttemptIds![0]!,
      gameplayAttemptIndex: 1,
      roomId: `a-room-${offset + 1}`,
      roomDecisionId: `a-decision-${offset + 1}`,
      roomSequence: offset + 1,
      roomOpportunityId: `${runA.id}:opportunity:${offset + 1}`,
      roomOpportunityIndex: offset + 1,
      experiencePreset: 'new-delver' as const,
    }));
    session.runs = [runA];
    const runB = createResearchRun({
      session,
      characterId: 'warden',
      experiencePreset: 'new-delver',
      id: 'review-run-b',
    });
    runB.status = 'completed';
    runB.endedAt = new Date(40_000).toISOString();
    runB.rooms = runA.rooms.map((room, offset) => ({
      ...room,
      runId: runB.id,
      condition: runB.condition,
      runLabel: 'Run B' as const,
      conditionBlockIndex: 1 as const,
      gameplayAttemptId: runB.gameplayAttemptIds![0]!,
      roomId: `b-room-${offset + 1}`,
      roomDecisionId: `b-decision-${offset + 1}`,
      roomOpportunityId: `${runB.id}:opportunity:${offset + 1}`,
    }));
    session.runs = [runA, runB];
    session.status = 'ended';
    session.endedAt = new Date(40_000).toISOString();
    session.completionStatus = 'complete';
    session.completedAt = session.endedAt;
    session.participantPhase = 'session_complete';
    expect(
      saveResearchStorage({
        researchSchemaVersion: 'research-1',
        activeSessionId: null,
        sessions: [session],
      }),
    ).toBeNull();

    render(
      <MemoryRouter>
        <ResearchReviewPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'PILOT_REVIEW' })).toBeVisible();
    expect(screen.getByText('NEUTRAL_PROCEDURAL → RULES_ADAPTIVE')).toBeVisible();
    expect(screen.getAllByText('completed · 10 / 10')).toHaveLength(2);
    expect(screen.getAllByText('Valid').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'JSON' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'CSV' })).toBeEnabled();
  });
});
