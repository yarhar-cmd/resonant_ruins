import { useContext } from 'react';
import { AudioSystemContext } from '../context/audioContext';

export function useAudio() {
  const context = useContext(AudioSystemContext);
  if (!context) throw new Error('useAudio must be used within AudioProvider.');
  return context;
}
