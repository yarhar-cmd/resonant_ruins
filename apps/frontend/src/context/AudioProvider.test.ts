import { describe, expect, it } from 'vitest';
import { AUDIO_ACTIVATION_EVENTS } from './AudioProvider';

describe('Resonant Ruins mobile audio activation', () => {
  it('retries activation across pointer, touch, click, and keyboard gestures', () => {
    expect(AUDIO_ACTIVATION_EVENTS).toEqual(['pointerdown', 'touchend', 'click', 'keydown']);
  });
});
