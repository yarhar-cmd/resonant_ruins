import { RESTORATION_FOUNTAIN_CONFIG } from '../config/recovery';
import type { EnemyRoomState } from '../types/enemies';
import type {
  InteractableDefinition,
  InteractableRuntimeStates,
  InteractionChannelState,
} from '../types/interactions';
import type { CardinalDirection, PlayerState } from '../types/player';
import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import type { RestorationFountainFeature } from '../types/topology';
import { isAnyLivingRatAlerted } from './enemySystem';
import { coordinateKey, gridPositionToCoordinate } from './roomGeometry';

export function createIdleInteractionState(): InteractionChannelState {
  return {
    targetId: null,
    type: null,
    startedAt: null,
    deadline: null,
    remainingMs: 0,
    status: 'idle',
    cancellationReason: null,
    result: null,
  };
}

export function createInteractableRuntimeStates(room: RoomDefinition): InteractableRuntimeStates {
  return Object.fromEntries(
    getRestorationFountains(room).map((feature) => [
      feature.id,
      { depleted: false, encounteredAt: null, usedAt: null },
    ]),
  );
}

export function getRestorationFountains(room: RoomDefinition): RestorationFountainFeature[] {
  return (room.features ?? []).filter(
    (feature): feature is RestorationFountainFeature =>
      feature.kind === 'restoration-fountain' && feature.blocking,
  );
}

export function directionBetweenAdjacent(
  from: TileCoordinate,
  to: TileCoordinate,
): CardinalDirection | null {
  if (to.x === from.x && to.y === from.y - 1) return 'up';
  if (to.x === from.x && to.y === from.y + 1) return 'down';
  if (to.x === from.x - 1 && to.y === from.y) return 'left';
  if (to.x === from.x + 1 && to.y === from.y) return 'right';
  return null;
}

export function getAvailableInteraction(input: {
  room: RoomDefinition;
  player: PlayerState;
  currentHealth: number;
  maximumHealth: number;
  enemies: EnemyRoomState;
  runtime: InteractableRuntimeStates;
}): InteractableDefinition | null {
  if (input.currentHealth >= input.maximumHealth || isAnyLivingRatAlerted(input.enemies))
    return null;
  const playerTile = gridPositionToCoordinate(input.player.position);
  return (
    getRestorationFountains(input.room)
      .filter((feature) => !input.runtime[feature.id]?.depleted)
      .map((feature) => ({ feature, facing: directionBetweenAdjacent(playerTile, feature.tile) }))
      .filter(
        ({ feature, facing }) =>
          Boolean(facing) &&
          facing === input.player.facing &&
          feature.interactionTiles.some(
            (tile) => coordinateKey(tile) === coordinateKey(playerTile),
          ),
      )
      .sort((left, right) => left.feature.id.localeCompare(right.feature.id))
      .map(({ feature, facing }) => ({
        id: feature.id,
        type: 'restoration-fountain' as const,
        tile: feature.tile,
        range: 1 as const,
        requiredFacing: facing!,
        available: true,
        accessibleLabel: 'Restore Health',
        prompt: 'E — Restore Health',
        channelDurationMs: RESTORATION_FOUNTAIN_CONFIG.channelDurationMs,
      }))[0] ?? null
  );
}

export function getFacingRestorationFountain(
  room: RoomDefinition,
  player: PlayerState,
): RestorationFountainFeature | null {
  const playerTile = gridPositionToCoordinate(player.position);
  return (
    getRestorationFountains(room)
      .filter((feature) =>
        feature.interactionTiles.some((tile) => coordinateKey(tile) === coordinateKey(playerTile)),
      )
      .filter((feature) => directionBetweenAdjacent(playerTile, feature.tile) === player.facing)
      .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null
  );
}

export function isInteractionTargetValid(
  targetId: string,
  input: Parameters<typeof getAvailableInteraction>[0],
): boolean {
  return getAvailableInteraction(input)?.id === targetId;
}

export function isGameplayInteractionFocus(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest('[data-game-input-surface]')) return true;
  return !target.closest(
    'input,textarea,select,button,a[href],summary,[contenteditable]:not([contenteditable="false"]),[role="dialog"],[role="button"],[tabindex]:not([tabindex="-1"])',
  );
}
