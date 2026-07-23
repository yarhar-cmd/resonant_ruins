import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdventure } from '../hooks/useAdventure';
import { AudioEngine, type AudioAvailability } from '../services/audioEngine';
import { AudioSystemContext } from './audioContext';
import { AUDIO_EVENT_NAMES, type AudioEvent, type AudioEventName } from '../types/audio';

export const AUDIO_ACTIVATION_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'] as const;

export function AudioProvider({ children }: { children: ReactNode }) {
  const { settings } = useAdventure();
  const location = useLocation();
  const engineRef = useRef<AudioEngine | null>(null);
  const [availability, setAvailability] = useState<AudioAvailability>('idle');
  if (!engineRef.current) engineRef.current = new AudioEngine(settings.audio);
  const engine = engineRef.current;

  useEffect(() => {
    engine.updateSettings(settings.audio);
  }, [engine, settings.audio]);

  useEffect(() => {
    engine.setAmbienceEnabled(
      location.pathname === '/dungeon/run' ||
        location.pathname === '/research/run' ||
        location.pathname === '/model-lab/sandbox',
    );
  }, [engine, location.pathname]);

  useEffect(() => {
    let mounted = true;
    if (import.meta.env.DEV) {
      void import('../services/audioDebug').then(({ recordDevelopmentAudioEvent }) => {
        if (mounted) engine.setObserver(recordDevelopmentAudioEvent);
      });
    }

    const activate = () => {
      void engine.activate().then((next) => mounted && setAvailability(next));
    };
    const playUiEvent = (event: MouseEvent) => {
      const target =
        event.target instanceof Element ? event.target.closest('[data-audio-event]') : null;
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      const name = target.getAttribute('data-audio-event');
      if (AUDIO_EVENT_NAMES.includes(name as AudioEventName))
        engine.emit({ name: name as AudioEventName });
    };
    const visibility = () => engine.setDocumentHidden(document.hidden);
    for (const eventName of AUDIO_ACTIVATION_EVENTS) {
      document.addEventListener(eventName, activate, {
        capture: true,
        passive: eventName !== 'keydown',
      });
    }
    document.addEventListener('click', playUiEvent, { capture: true });
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      mounted = false;
      for (const eventName of AUDIO_ACTIVATION_EVENTS) {
        document.removeEventListener(eventName, activate, { capture: true });
      }
      document.removeEventListener('click', playUiEvent, { capture: true });
      document.removeEventListener('visibilitychange', visibility);
      void engine.dispose();
    };
  }, [engine]);

  const value = useMemo(
    () => ({
      availability,
      emit: (event: AudioEvent) => engine.emit(event),
      resetTransientEffects: () => engine.resetTransientEffects(),
    }),
    [availability, engine],
  );

  return <AudioSystemContext.Provider value={value}>{children}</AudioSystemContext.Provider>;
}
