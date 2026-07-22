import { NavLink } from 'react-router-dom';
import { MirrorvaultLogo } from './MirrorvaultLogo';
import { MODEL_LAB_ENABLED, TOPOLOGY_LAB_ENABLED } from '../../config/environment';

const links = [
  ['/', 'Home'],
  ['/dungeon', 'Play'],
  ['/research', 'Research'],
  ['/history', 'History'],
  ['/settings', 'Settings'],
];

export function Header() {
  return (
    <header className="site-header">
      <MirrorvaultLogo />
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
          </NavLink>
        ))}
        {(TOPOLOGY_LAB_ENABLED || MODEL_LAB_ENABLED) && (
          <details className="nav-menu nav-menu--labs">
            <summary>Labs</summary>
            <div className="nav-menu__links">
              {TOPOLOGY_LAB_ENABLED && <NavLink to="/topology-lab">Topology Lab</NavLink>}
              {MODEL_LAB_ENABLED && <NavLink to="/model-lab">Model Lab</NavLink>}
            </div>
          </details>
        )}
        <details className="nav-menu nav-menu--more">
          <summary>More</summary>
          <div className="nav-menu__links">
            <NavLink to="/characters">Characters</NavLink>
            <NavLink to="/about">About</NavLink>
          </div>
        </details>
      </nav>
      <span className="local-badge">LOCAL ONLY</span>
    </header>
  );
}
