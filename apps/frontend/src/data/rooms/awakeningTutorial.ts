import type { RunMode } from '../../types/runMode';
import {
  EVALUATION_ROOM_1_ID,
  EVALUATION_ROOM_2_ID,
  EVALUATION_ROOM_3_ID,
  EVALUATION_ROOM_4_ID,
  EVALUATION_ROOM_5_ID,
} from './evaluationRooms';

export type AwakeningTutorialKind = 'movement' | 'runes' | 'fountain' | 'combat' | 'combined';

export interface AwakeningTutorialDefinition {
  roomId: string;
  kind: AwakeningTutorialKind;
  message: string;
}

export const AWAKENING_TUTORIALS: Readonly<Record<string, AwakeningTutorialDefinition>> = {
  [EVALUATION_ROOM_1_ID]: {
    roomId: EVALUATION_ROOM_1_ID,
    kind: 'movement',
    message: 'Move with WASD or the arrow keys. Step into the glowing exit to continue.',
  },
  [EVALUATION_ROOM_2_ID]: {
    roomId: EVALUATION_ROOM_2_ID,
    kind: 'runes',
    message: 'Red Runes deal damage. Look for a safe path—or take the riskier route.',
  },
  [EVALUATION_ROOM_3_ID]: {
    roomId: EVALUATION_ROOM_3_ID,
    kind: 'fountain',
    message: 'Face the Restoration Fountain and hold E to recover health.',
  },
  [EVALUATION_ROOM_4_ID]: {
    roomId: EVALUATION_ROOM_4_ID,
    kind: 'combat',
    message: 'Attack with Space. Face an incoming Rat and hold Shift to block.',
  },
  [EVALUATION_ROOM_5_ID]: {
    roomId: EVALUATION_ROOM_5_ID,
    kind: 'combined',
    message:
      'Combine what you’ve learned: avoid Runes, defeat the Rats, and use the Fountain when needed.',
  },
};

export const PERFECT_BLOCK_TUTORIAL =
  'Raise or turn your shield just before impact for a perfect block.';

export function getAwakeningTutorial(
  roomId: string,
  runMode: RunMode,
  inGeneratedDungeon: boolean,
): AwakeningTutorialDefinition | null {
  if (runMode !== 'normal' || inGeneratedDungeon) return null;
  return AWAKENING_TUTORIALS[roomId] ?? null;
}
