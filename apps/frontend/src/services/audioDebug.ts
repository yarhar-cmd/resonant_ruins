import type { AudioDebugObserver } from './audioEngine';

declare global {
  interface Window {
    __RESONANT_RUINS_AUDIO_DEBUG__?: Array<{
      name: string;
      played: boolean;
      pitch: number;
      timestamp: number;
    }>;
  }
}

export const recordDevelopmentAudioEvent: AudioDebugObserver = ({ event, played, pitch }) => {
  const events = window.__RESONANT_RUINS_AUDIO_DEBUG__ ?? [];
  events.push({ name: event.name, played, pitch, timestamp: Date.now() });
  window.__RESONANT_RUINS_AUDIO_DEBUG__ = events.slice(-200);
};
