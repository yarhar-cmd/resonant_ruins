import { Outlet } from 'react-router-dom';
import { useAdventure } from '../../hooks/useAdventure';
import { useApiHealth } from '../../hooks/useApiHealth';
import { Footer } from './Footer';
import { Header } from './Header';
import { MobileNavigation } from './MobileNavigation';
import { StorageWarning } from '../mirrorvault/StorageWarning';

export function AppShell() {
  const apiStatus = useApiHealth();
  const { settings, storageWarning, dismissStorageWarning } = useAdventure();

  return (
    <div
      className={`app-shell effects-${settings.visualEffects} ${settings.highContrast ? 'is-high-contrast' : ''} ${settings.reducedMotion ? 'reduce-motion' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      <main id="main-content">
        {storageWarning && (
          <StorageWarning message={storageWarning} onDismiss={dismissStorageWarning} />
        )}
        <Outlet />
      </main>
      <Footer />
      <MobileNavigation />
      <div
        className={`api-status ${apiStatus === 'online' ? 'is-online' : ''}`}
        title="Local API status"
      >
        <span aria-hidden="true" />
        {apiStatus === 'checking'
          ? 'API checking'
          : apiStatus === 'online'
            ? 'Local API linked'
            : apiStatus === 'not-configured'
              ? 'Local only · API not configured'
              : 'Local API unavailable'}
      </div>
    </div>
  );
}
