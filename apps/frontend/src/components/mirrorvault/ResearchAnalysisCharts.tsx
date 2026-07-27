import type {
  ConditionAnalysisSummary,
  ParticipantRateAggregate,
  ResearchAnalysis,
} from '../../research/analysis/types';

function percentage(value: number | null): string {
  return value === null ? 'No valid ratings' : `${(value * 100).toFixed(1)}%`;
}

function number(value: number | null, digits = 2): string {
  return value === null ? 'Not available' : value.toFixed(digits);
}

function RateBar({
  label,
  value,
  tone = 'brass',
}: {
  label: string;
  value: number | null;
  tone?: 'brass' | 'red' | 'green';
}) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value * 100));
  return (
    <div className="analysis-rate-bar" role="img" aria-label={`${label}: ${percentage(value)}`}>
      <div className="analysis-rate-bar__label">
        <span>{label}</span>
        <strong>{percentage(value)}</strong>
      </div>
      <div className="analysis-rate-bar__track" aria-hidden="true">
        <span
          className={`analysis-rate-bar__fill analysis-rate-bar__fill--${tone}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function conditionLabel(condition: ConditionAnalysisSummary): string {
  return condition.condition === 'RULES_ADAPTIVE' ? 'Adaptive' : 'Neutral';
}

function RateComparison({ title, groups }: { title: string; groups: ParticipantRateAggregate[] }) {
  const headingId = `analysis-${title.toLowerCase().replaceAll(' ', '-')}-heading`;
  return (
    <section className="analysis-chart-card" aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      <div className="analysis-rate-list">
        {groups.map((group) => (
          <RateBar
            key={group.key}
            label={group.label}
            value={group.meanParticipantAboutRightRate}
          />
        ))}
      </div>
      <div className="analysis-table-wrap">
        <table>
          <caption>{title} tabular values</caption>
          <thead>
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Participants</th>
              <th scope="col">Mean participant rate</th>
              <th scope="col">Pooled rooms</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.key}>
                <th scope="row">{group.label}</th>
                <td>{group.participantCount}</td>
                <td>{percentage(group.meanParticipantAboutRightRate)}</td>
                <td>
                  {group.aboutRightCount} / {group.validSubmittedDifficultyCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ResearchAnalysisCharts({ analysis }: { analysis: ResearchAnalysis }) {
  const conditions = [analysis.conditions.RULES_ADAPTIVE, analysis.conditions.NEUTRAL_PROCEDURAL];
  const difficultyTotal = (condition: ConditionAnalysisSummary) =>
    condition.aboutRightCount + condition.tooEasyCount + condition.tooHardCount;
  const difficultyRate = (condition: ConditionAnalysisSummary, value: number): number | null => {
    const total = difficultyTotal(condition);
    return total ? value / total : null;
  };

  return (
    <div className="analysis-charts">
      <section className="analysis-chart-card" aria-labelledby="paired-plot-heading">
        <div className="analysis-section-heading">
          <div>
            <h3 id="paired-plot-heading">Paired participant About Right Rate</h3>
            <p>
              Each row compares the same participant. Lines are descriptive, not significance tests.
            </p>
          </div>
          <span className="analysis-count-badge">
            {analysis.paired.completePairCount} complete pair
            {analysis.paired.completePairCount === 1 ? '' : 's'}
          </span>
        </div>
        {analysis.paired.pairs.length ? (
          <div className="analysis-paired-plot">
            {analysis.paired.pairs.map((pair) => (
              <div
                key={pair.participantKey}
                className="analysis-paired-row"
                role="img"
                aria-label={`${pair.participantCode ?? pair.participantKey}: Adaptive ${percentage(
                  pair.adaptiveAboutRightRate,
                )}, Neutral ${percentage(pair.neutralAboutRightRate)}, difference ${percentage(
                  pair.aboutRightDifference,
                )}`}
                tabIndex={0}
              >
                <span>{pair.participantCode ?? pair.participantKey}</span>
                <div className="analysis-paired-track" aria-hidden="true">
                  <i
                    className="analysis-paired-line"
                    style={{
                      left: `${
                        Math.min(pair.adaptiveAboutRightRate, pair.neutralAboutRightRate) * 100
                      }%`,
                      width: `${
                        Math.abs(pair.adaptiveAboutRightRate - pair.neutralAboutRightRate) * 100
                      }%`,
                    }}
                  />
                  <b
                    className="analysis-paired-point analysis-paired-point--adaptive"
                    style={{ left: `${pair.adaptiveAboutRightRate * 100}%` }}
                    title={`Adaptive ${percentage(pair.adaptiveAboutRightRate)}`}
                  />
                  <b
                    className="analysis-paired-point analysis-paired-point--neutral"
                    style={{ left: `${pair.neutralAboutRightRate * 100}%` }}
                    title={`Neutral ${percentage(pair.neutralAboutRightRate)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="analysis-empty">No complete participant pairs match these filters.</p>
        )}
        <p className="analysis-chart-summary">
          Adaptive minus neutral: mean {percentage(analysis.paired.meanAboutRightDifference)} ·
          median {percentage(analysis.paired.medianAboutRightDifference)} ·{' '}
          {analysis.paired.incompletePairCount} incomplete pair
          {analysis.paired.incompletePairCount === 1 ? '' : 's'}
        </p>
        <div className="analysis-table-wrap">
          <table>
            <caption>Paired participant values</caption>
            <thead>
              <tr>
                <th scope="col">Participant</th>
                <th scope="col">Adaptive</th>
                <th scope="col">Neutral</th>
                <th scope="col">Difference</th>
              </tr>
            </thead>
            <tbody>
              {analysis.paired.pairs.map((pair) => (
                <tr key={pair.participantKey}>
                  <th scope="row">{pair.participantCode ?? pair.participantKey}</th>
                  <td>{percentage(pair.adaptiveAboutRightRate)}</td>
                  <td>{percentage(pair.neutralAboutRightRate)}</td>
                  <td>{percentage(pair.aboutRightDifference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="analysis-chart-card" aria-labelledby="difficulty-heading">
        <h3 id="difficulty-heading">Difficulty distribution by condition</h3>
        {conditions.map((condition) => (
          <div key={condition.condition} className="analysis-distribution">
            <strong>{conditionLabel(condition)}</strong>
            <div
              className="analysis-distribution__bar"
              role="img"
              aria-label={`${conditionLabel(condition)}: Too Easy ${condition.tooEasyCount}, About Right ${condition.aboutRightCount}, Too Hard ${condition.tooHardCount}`}
            >
              <span
                className="analysis-distribution__easy"
                style={{
                  width: `${(difficultyRate(condition, condition.tooEasyCount) ?? 0) * 100}%`,
                }}
              />
              <span
                className="analysis-distribution__right"
                style={{
                  width: `${(difficultyRate(condition, condition.aboutRightCount) ?? 0) * 100}%`,
                }}
              />
              <span
                className="analysis-distribution__hard"
                style={{
                  width: `${(difficultyRate(condition, condition.tooHardCount) ?? 0) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
        <div className="analysis-table-wrap">
          <table>
            <caption>Difficulty distribution counts</caption>
            <thead>
              <tr>
                <th scope="col">Condition</th>
                <th scope="col">Too Easy</th>
                <th scope="col">About Right</th>
                <th scope="col">Too Hard</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((condition) => (
                <tr key={condition.condition}>
                  <th scope="row">{conditionLabel(condition)}</th>
                  <td>{condition.tooEasyCount}</td>
                  <td>{condition.aboutRightCount}</td>
                  <td>{condition.tooHardCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="analysis-chart-card" aria-labelledby="secondary-heading">
        <h3 id="secondary-heading">Fairness, enjoyment, outcomes, and missingness</h3>
        <div className="analysis-table-wrap">
          <table>
            <caption>Secondary condition summaries</caption>
            <thead>
              <tr>
                <th scope="col">Condition</th>
                <th scope="col">Fairness mean</th>
                <th scope="col">Enjoyment mean</th>
                <th scope="col">Completed</th>
                <th scope="col">Defeated</th>
                <th scope="col">Full skip</th>
                <th scope="col">Fairness missing</th>
                <th scope="col">Enjoyment missing</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((condition) => (
                <tr key={condition.condition}>
                  <th scope="row">{conditionLabel(condition)}</th>
                  <td>{number(condition.meanFairness)}</td>
                  <td>{number(condition.meanEnjoyment)}</td>
                  <td>{percentage(condition.completedRoomRate)}</td>
                  <td>{percentage(condition.defeatedRoomRate)}</td>
                  <td>{percentage(condition.explicitFullSkipRate)}</td>
                  <td>{condition.fairnessMissingCount}</td>
                  <td>{condition.enjoymentMissingCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="analysis-chart-grid">
        <RateComparison
          title="Run order"
          groups={[analysis.runLabels['Run A'], analysis.runLabels['Run B']]}
        />
        <RateComparison
          title="Condition order"
          groups={[
            analysis.conditionOrders['adaptive-first'],
            analysis.conditionOrders['neutral-first'],
          ]}
        />
      </div>

      <section className="analysis-chart-card" aria-labelledby="pilot-questionnaire-heading">
        <h3 id="pilot-questionnaire-heading">Pilot exit questionnaire</h3>
        <p>
          {analysis.questionnaire.submittedQuestionnaires} submitted · technical problems{' '}
          {percentage(analysis.questionnaire.technicalProblemRate)} · instruction clarity mean{' '}
          {number(analysis.questionnaire.meanInstructionClarity)} · fatigue/repetitiveness mean{' '}
          {number(analysis.questionnaire.meanSurveyFatigue)}
        </p>
        <div className="analysis-table-wrap">
          <table>
            <caption>Pilot session length and run preference responses</caption>
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Response</th>
                <th scope="col">Count</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(analysis.questionnaire.sessionLengthCounts).map(([label, count]) => (
                <tr key={`length-${label}`}>
                  <th scope="row">Session length</th>
                  <td>{label.replaceAll('_', ' ')}</td>
                  <td>{count}</td>
                </tr>
              ))}
              {Object.entries(analysis.questionnaire.preferenceCounts).map(([label, count]) => (
                <tr key={`preference-${label}`}>
                  <th scope="row">Preference</th>
                  <td>{label.replaceAll('_', ' ')}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
