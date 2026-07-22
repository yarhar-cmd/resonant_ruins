import { createContext } from 'react';
import type { AudioEvent } from '../types/audio';
import type { AudioAvailability } from '../services/audioEngine';

export interface AudioContextValue {
  emit: (event: AudioEvent) => boolean;
  resetTransientEffects: () => void;
  availability: AudioAvailability;
}

export const AudioSystemContext = createContext<AudioContextValue | null>(null);
