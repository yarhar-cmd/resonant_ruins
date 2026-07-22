import { RESTORATION_FOUNTAIN_CONFIG } from '../config/recovery';
import { RESONANCE_REWARD_CONFIG } from '../config/rewards';
import type { EnemyRoomState } from '../types/enemies';
import type {
  InteractableDefinition,
  InteractableRuntimeStates,
  InteractionChannelState,
} from '../types/interactions';
import type { CardinalDirection, PlayerState } from '../types/player';
import type { RoomDefinition, TileCoordinate } from '../types/rooms';
import type { ResonanceCacheFeature, RestorationFountainFeature } from '../types/topology';
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

function createRuntimeState() {
  return {
    depleted: false,
    encounteredAt: null,
    usedAt: null,
    healthWhenUsed: null,
    resonanceAwarded: false,
    cancellationReasons: [],
  };
}

export function createInteractableRuntimeStates(room: RoomDefinition): InteractableRuntimeStates {
  return Object.fromEntries(
    [...getRestorationFountains(room), ...getResonanceCaches(room)].map((feature) => [
      feature.id,
      createRuntimeState(),
    ]),
  );
}

export function getRestorationFountains(room: RoomDefinition): RestorationFountainFeature[] {
  return (room.features ?? []).filter(
    (feature): feature is RestorationFountainFeature =>
      feature.kind === 'restoration-fountain' && feature.blocking,
  );
}

export function getResonanceCaches(room: RoomDefinition): ResonanceCacheFeature[] {
  return (room.features ?? []).filter(
    (feature): feature is ResonanceCacheFeature =>
      feature.kind === 'resonance-cache' && feature.blocking,
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

type AvailableInteractionInput = {
  room: RoomDefinition;
  player: PlayerState;
  currentHealth: number;
  maximumHealth: number;
  enemies: EnemyRoomState;
  runtime: InteractableRuntimeStates;
};

function facesFeature(
  player: PlayerState,
  feature: { tile: TileCoordinate; interactionTiles: TileCoordinate[] },
): CardinalDirection | null {
  const playerTile = gridPositionToCoordinate(player.position);
  const facing = directionBetweenAdjacent(playerTile, feature.tile);
  return facing === player.facing &&
    feature.interactionTiles.some((tile) => coordinateKey(tile) === coordinateKey(playerTile))
    ? facing
    : null;
}

export function getAvailableInteraction(
  input: AvailableInteractionInput,
): InteractableDefinition | null {
  if (isInteractionCombatLocked(input.enemies)) return null;
  const fountains: InteractableDefinition[] = getRestorationFountains(input.room)
    .filter(() => input.currentHealth < input.maximumHealth)
    .filter((feature) => !input.runtime[feature.id]?.depleted)
    .map((feature) => ({ feature, facing: facesFeature(input.player, feature) }))
    .filter(({ facing }) => Boolean(facing))
    .map(({ feature, facing }) => ({
      id: feature.id,
      type: 'restoration-fountain',
      tile: feature.tile,
      range: 1,
      requiredFacing: facing!,
      available: true,
      accessibleLabel: 'Restore Health',
      prompt: 'E — Restore Health',
      channelDurationMs: RESTORATION_FOUNTAIN_CONFIG.channelDurationMs,
    }));
  const caches: InteractableDefinition[] = getResonanceCaches(input.room)
    .filter((feature) => !input.runtime[feature.id]?.depleted)
    .map((feature) => ({ feature, facing: facesFeature(input.player, feature) }))
    .filter(({ facing }) => Boolean(facing))
    .map(({ feature, facing }) => ({
      id: feature.id,
      type: 'resonance-cache',
      tile: feature.tile,
      range: 1,
      requiredFacing: facing!,
      available: true,
      accessibleLabel: 'Resonance Cache, unopened, grants one Resonance',
      prompt: 'E — Open Resonance Cache',
      channelDurationMs: RESONANCE_REWARD_CONFIG.cacheOpeningChannelMs,
    }));
  return (
    [...fountains, ...caches].sort((left, right) => left.id.localeCompare(right.id))[0] ?? null
  );
}

export function getFacingRestorationFountain(
  room: RoomDefinition,
  player: PlayerState,
): RestorationFountainFeature | null {
  return (
    getRestorationFountains(room)
      .filter((feature) => Boolean(facesFeature(player, feature)))
      .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null
  );
}

export function getFacingResonanceCache(
  room: RoomDefinition,
  player: PlayerState,
): ResonanceCacheFeature | null {
  return (
    getResonanceCaches(room)
      .filter((feature) => Boolean(facesFeature(player, feature)))
      .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null
  );
}

export function isInteractionCombatLocked(enemies: EnemyRoomState): boolean {
  return isAnyLivingRatAlerted(enemies);
}

export function interactionChannelDuration(type: InteractionChannelState['type']): number {
  return type === 'resonance-cache'
    ? RESONANCE_REWARD_CONFIG.cacheOpeningChannelMs
    : RESTORATION_FOUNTAIN_CONFIG.channelDurationMs;
}

export function isInteractionTargetValid(
  targetId: string,
  input: AvailableInteractionInput,
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
