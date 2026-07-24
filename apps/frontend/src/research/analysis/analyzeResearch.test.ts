import { describe, expect, it } from 'vitest';
import { createResearchAnalysis, filterResearchSessions } from './analyzeResearch';
import { DEFAULT_ANALYSIS_FILTERS } from './types';
import {
  analysisRecord,
  analysisRun,
  analysisSession,
  completeConditionSession,
} from './testFixtures';

describe('participant-level research analysis', () => {
  it('excludes Pilot and incomplete sessions by default and exposes explicit filters', () => {
    const official = completeConditionSession({
      id: 'official',
      participantCode: 'P001',
      condition: 'RULES_ADAPTIVE',
      difficulties: ['about_right'],
    });
    const pilot = completeConditionSession({
      id: 'pilot',
      participantCode: 'P002',
      condition: 'NEUTRAL_PROCEDURAL',
      difficulties: ['too_hard'],
      pilot: true,
    });
    const incomplete = {
      ...completeConditionSession({
        id: 'incomplete',
        participantCode: 'P003',
        condition: 'RULES_ADAPTIVE',
        difficulties: ['too_easy'],
      }),
      status: 'active' as const,
      endedAt: null,
    };

    expect(filterResearchSessions([official, pilot, incomplete], DEFAULT_ANALYSIS_FILTERS)).toEqual(
      [official],
    );
    expect(
      filterResearchSessions([official, pilot, incomplete], {
        ...DEFAULT_ANALYSIS_FILTERS,
        pilot: 'all',
        completion: 'all',
      }),
    ).toHaveLength(3);
  });

  it('uses only submitted difficulty ratings for About Right and includes defeated submissions', () => {
    const sessionId = 'denominator';
    const runId = 'denominator-run';
    const session = analysisSession({
      id: sessionId,
      participantCode: 'P001',
      runs: [
        analysisRun({
          id: runId,
          sessionId,
          condition: 'RULES_ADAPTIVE',
          rooms: [
            analysisRecord({
              sessionId,
              runId,
              roomDecisionId: 'right',
              condition: 'RULES_ADAPTIVE',
              difficulty: 'about_right',
            }),
            analysisRecord({
              sessionId,
              runId,
              roomDecisionId: 'hard-defeat',
              condition: 'RULES_ADAPTIVE',
              difficulty: 'too_hard',
              outcomeStatus: 'defeated',
            }),
            analysisRecord({
              sessionId,
              runId,
              roomDecisionId: 'skip',
              condition: 'RULES_ADAPTIVE',
              feedbackStatus: 'skipped',
            }),
          ],
        }),
      ],
    });
    const adaptive = createResearchAnalysis([session]).conditions.RULES_ADAPTIVE;
    expect(adaptive).toMatchObject({
      aboutRightCount: 1,
      validSubmittedDifficultyCount: 2,
      pooledAboutRightRate: 0.5,
      tooHardCount: 1,
      explicitFullSkipRate: 1 / 3,
      defeatedRoomRate: 1 / 3,
    });
  });

  it('weights participants equally and keeps pooled room counts descriptive', () => {
    const participants = [
      completeConditionSession({
        id: 'p1',
        participantCode: 'P001',
        condition: 'RULES_ADAPTIVE',
        difficulties: ['about_right'],
      }),
      completeConditionSession({
        id: 'p2',
        participantCode: 'P002',
        condition: 'RULES_ADAPTIVE',
        difficulties: ['too_hard', 'too_hard', 'too_hard'],
      }),
    ];
    const adaptive = createResearchAnalysis(participants).conditions.RULES_ADAPTIVE;
    expect(adaptive.pooledAboutRightRate).toBe(0.25);
    expect(adaptive.meanParticipantAboutRightRate).toBe(0.5);
    expect(adaptive.medianParticipantAboutRightRate).toBe(0.5);
    expect(adaptive.participantCount).toBe(2);
  });

  it('calculates available fairness and enjoyment means with explicit missingness', () => {
    const sessionId = 'missingness';
    const runId = 'missingness-run';
    const session = analysisSession({
      id: sessionId,
      runs: [
        analysisRun({
          id: runId,
          sessionId,
          condition: 'RULES_ADAPTIVE',
          rooms: [
            analysisRecord({
              sessionId,
              runId,
              roomDecisionId: 'complete-ratings',
              condition: 'RULES_ADAPTIVE',
              fairness: 5,
              enjoyment: 3,
            }),
            analysisRecord({
              sessionId,
              runId,
              roomDecisionId: 'missing-ratings',
              condition: 'RULES_ADAPTIVE',
              fairness: null,
              enjoyment: null,
            }),
          ],
        }),
      ],
    });
    const adaptive = createResearchAnalysis([session]).conditions.RULES_ADAPTIVE;
    expect(adaptive).toMatchObject({
      meanFairness: 5,
      meanEnjoyment: 3,
      fairnessMissingCount: 1,
      enjoymentMissingCount: 1,
    });
  });

  it('computes adaptive-minus-neutral paired differences and flags incomplete pairs', () => {
    const sessions = [
      completeConditionSession({
        id: 'p1-adaptive',
        participantCode: 'P001',
        condition: 'RULES_ADAPTIVE',
        difficulties: ['about_right', 'about_right'],
      }),
      completeConditionSession({
        id: 'p1-neutral',
        participantCode: 'P001',
        condition: 'NEUTRAL_PROCEDURAL',
        difficulties: ['about_right', 'too_hard'],
      }),
      completeConditionSession({
        id: 'p2-adaptive',
        participantCode: 'P002',
        condition: 'RULES_ADAPTIVE',
        difficulties: ['about_right'],
      }),
    ];
    const paired = createResearchAnalysis(sessions).paired;
    expect(paired).toMatchObject({
      completePairCount: 1,
      incompletePairCount: 1,
      meanAboutRightDifference: 0.5,
      medianAboutRightDifference: 0.5,
    });
    expect(paired.pairs[0]).toMatchObject({
      participantCode: 'P001',
      adaptiveAboutRightRate: 1,
      neutralAboutRightRate: 0.5,
      aboutRightDifference: 0.5,
    });
  });

  it('summarizes Run A/B and condition order independently of condition labels', () => {
    const adaptive = completeConditionSession({
      id: 'run-a',
      participantCode: 'P001',
      condition: 'RULES_ADAPTIVE',
      difficulties: ['about_right'],
      runLabel: 'Run A',
    });
    adaptive.hiddenConditionOrder = ['RULES_ADAPTIVE', 'NEUTRAL_PROCEDURAL'];
    const neutral = completeConditionSession({
      id: 'run-b',
      participantCode: 'P002',
      condition: 'NEUTRAL_PROCEDURAL',
      difficulties: ['too_hard'],
      runLabel: 'Run B',
    });
    neutral.hiddenConditionOrder = ['NEUTRAL_PROCEDURAL', 'RULES_ADAPTIVE'];

    const analysis = createResearchAnalysis([adaptive, neutral]);
    expect(analysis.runLabels['Run A'].pooledAboutRightRate).toBe(1);
    expect(analysis.runLabels['Run B'].pooledAboutRightRate).toBe(0);
    expect(analysis.conditionOrders['adaptive-first'].participantCount).toBe(1);
    expect(analysis.conditionOrders['neutral-first'].participantCount).toBe(1);
  });
});
