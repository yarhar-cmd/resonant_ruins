import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function useApiHealth() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'not-configured'>(
    api.configured ? 'checking' : 'not-configured',
  );

  useEffect(() => {
    if (!api.configured) return;
    const controller = new AbortController();
    api
      .health(controller.signal)
      .then(() => setStatus('online'))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  return status;
}
