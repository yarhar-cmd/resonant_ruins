import type { CardinalDirection } from './player';
import type { TileCoordinate } from './rooms';

export type InteractionType = 'restoration-fountain' | 'resonance-cache';
export type InteractionStatus = 'idle' | 'available' | 'channeling' | 'completed' | 'cancelled';
export type InteractionCancellationReason =
  | 'movement'
  | 'turned-away'
  | 'attack'
  | 'shield'
  | 'damage'
  | 'combat-alert'
  | 'defeat'
  | 'room-transition'
  | 'unavailable'
  | 'restart';

export interface InteractableDefinition {
  id: string;
  type: InteractionType;
  tile: TileCoordinate;
  range: 1;
  requiredFacing: CardinalDirection;
  available: boolean;
  accessibleLabel: string;
  prompt: string;
  channelDurationMs: number;
}

export interface InteractionChannelState {
  targetId: string | null;
  type: InteractionType | null;
  startedAt: number | null;
  deadline: number | null;
  remainingMs: number;
  status: Exclude<InteractionStatus, 'available'>;
  cancellationReason: InteractionCancellationReason | null;
  result: 'restored-one-health' | 'awarded-resonance' | null;
}

export interface InteractableRuntimeState {
  depleted: boolean;
  encounteredAt: number | null;
  usedAt: number | null;
  healthWhenUsed?: number | null;
  resonanceAwarded?: boolean;
  cancellationReasons?: InteractionCancellationReason[];
}

export type InteractableRuntimeStates = Record<string, InteractableRuntimeState>;
