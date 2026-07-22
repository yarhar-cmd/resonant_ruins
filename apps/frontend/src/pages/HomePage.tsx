import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loadActiveRun } from '../services/activeRunStorage';
import { loadRunArchive } from '../services/runArchive';
import { formatSurvivalTime } from '../utils/gameplayState';

const signals = [
  [
    'A',
    'Skill signal',
    'Completion time, damage, and retries estimate how much pressure feels manageable.',
    'hazard density and route width',
  ],
  [
    'B',
    'Playstyle signal',
    'Attacks, shields, movement, and exits reveal aggressive, defensive, or exploratory tendencies.',
    'room shape and traversal',
  ],
  [
    'C',
    'Route signal',
    'Floor coverage and directional choices estimate whether direct or optional space feels satisfying.',
    'room size and exits',
  ],
];

export function HomePage() {
  const [resumableRun] = useState(() => Boolean(loadActiveRun().record));
  const [runSummary] = useState(() => {
    const histories = Object.values(loadRunArchive().data.histories)
      .flat()
      .sort((left, right) => Date.parse(right.endedAt) - Date.parse(left.endedAt));
    return {
      recent: histories[0],
      bestRooms: histories.reduce((best, run) => Math.max(best, run.dungeonRoomsCleared), 0),
      bestResonance: histories.reduce((best, run) => Math.max(best, run.resonanceCollected), 0),
    };
  });

  return (
    <>
      <section className="hero">
        <div className="hero__seal" aria-hidden="true">
          R
        </div>
        <p className="eyebrow">An adaptive dungeon experiment</p>
        <h1>
          The dungeon is <em>watching how you play.</em>
        </h1>
        <p className="hero__intro">
          Cross five Awakening Chambers, then enter an endless dungeon shaped by your pace, tactics,
          and appetite for risk.
        </p>
        <div className="hero__actions">
          <Link className="button button--primary" to={resumableRun ? '/dungeon/run' : '/dungeon'}>
            {resumableRun ? 'Resume Run' : 'Start Run'}
          </Link>
          <Link className="button button--secondary" to="/research">
            Join Research
          </Link>
        </div>
      </section>

      <section className="home-overview">
        <header>
          <p className="section-number">How it adapts</p>
          <h2>Same rules. Different rooms.</h2>
          <p>
            Your behavior influences which deterministic room candidate is selected. Movement,
            combat rules, and damage stay constant.
          </p>
        </header>
        <div className="home-method" aria-label="Adaptive signals">
          {signals.map(([letter, title, copy, change]) => (
            <article key={letter}>
              <h3>
                <span aria-hidden="true">{letter}</span>
                {title}
              </h3>
              <p>{copy}</p>
              <small>Influences {change}</small>
            </article>
          ))}
        </div>
        <div className="home-run-summary" aria-label="Local run summary">
          <div>
            <span>Recent run</span>
            <strong>
              {runSummary.recent
                ? `${runSummary.recent.dungeonRoomsCleared} rooms · ${formatSurvivalTime(runSummary.recent.timeSurvivedMs)}`
                : 'No completed runs'}
            </strong>
          </div>
          <div>
            <span>Best rooms</span>
            <strong>{runSummary.bestRooms}</strong>
          </div>
          <div>
            <span>Best Resonance</span>
            <strong>{runSummary.bestResonance}</strong>
          </div>
          <Link to="/history">View History</Link>
        </div>
      </section>
    </>
  );
}
