import { describe, expect, it } from 'vitest';
import { evaluationRooms } from '../data/rooms/evaluationRooms';
import type { RuinPropFeature, RuinTorchFeature } from '../types/topology';
import { createRoomEnemyState } from './enemySystem';
import { validateAuthoredRoom } from './authoredRoomValidator';

describe('Resonant Ruins official Awakening Chambers', () => {
  it('keeps all five official authored rooms valid', () => {
    for (const room of evaluationRooms) {
      expect(validateAuthoredRoom(room, evaluationRooms).errors, room.id).toEqual([]);
    }
  });

  it('gives every Awakening Chamber the shared authored wall-torch presentation', () => {
    for (const room of evaluationRooms) {
      const torches =
        room.features?.filter(
          (feature): feature is RuinTorchFeature => feature.kind === 'ruin-torch',
        ) ?? [];
      expect(torches, room.id).toHaveLength(2);
      for (const torch of torches) {
        expect(torch.source).toBe('authored');
        expect(torch.blocking).toBe(false);
        expect(torch.tile.y).toBe(0);
      }
    }
  });

  it('adds two authored nonblocking physical props to every Awakening Chamber', () => {
    for (const room of evaluationRooms) {
      const props =
        room.features?.filter(
          (feature): feature is RuinPropFeature => feature.kind === 'ruin-prop',
        ) ?? [];
      expect(props, room.id).toHaveLength(2);
      for (const prop of props) {
        expect(prop.source).toBe('authored');
        expect(prop.blocking).toBe(false);
        expect(room.floorTiles).toContainEqual(prop.tile);
        expect(room.exits.map((exit) => exit.tile)).not.toContainEqual(prop.tile);
        expect(room.hazards ?? []).not.toContainEqual(prop.tile);
        expect(room.enemySpawns?.map((spawn) => spawn.tile) ?? []).not.toContainEqual(prop.tile);
      }
    }
  });

  it('uses fixed Rat encounters in Chambers 4 and 5 with preset counts 1, 2, and 3', () => {
    const chamber4 = evaluationRooms[3]!;
    const chamber5 = evaluationRooms[4]!;
    expect(chamber4.enemySpawns?.map((spawn) => spawn.order)).toEqual([1, 2, 3]);
    expect(chamber5.enemySpawns?.map((spawn) => spawn.order)).toEqual([1, 2, 3]);
    for (const room of [chamber4, chamber5]) {
      expect(
        ['new-delver', 'seasoned-adventurer', 'dungeon-veteran'].map(
          (preset) => createRoomEnemyState(room, preset as never, 1_000).rats.length,
        ),
      ).toEqual([1, 2, 3]);
      expect(room.exits.every((exit) => exit.condition.type === 'enemies-defeated')).toBe(true);
    }
    expect(chamber4.hazards).toEqual([]);
    expect(chamber5.hazards?.length).toBeGreaterThan(0);
    expect(chamber5.width * chamber5.height).toBeGreaterThan(chamber4.width * chamber4.height);
  });

  it('rejects invalid authored Rat coordinates and duplicate spawn order', () => {
    const chamber4 = evaluationRooms[3]!;
    const invalid = {
      ...chamber4,
      enemySpawns: [
        ...chamber4.enemySpawns!,
        {
          ...chamber4.enemySpawns![0]!,
          id: 'invalid-rat',
          tile: { x: 0, y: 0 },
        },
      ],
    };
    expect(validateAuthoredRoom(invalid, evaluationRooms).errors).toEqual(
      expect.arrayContaining([
        'Enemy spawn: enemy-spawn-not-walkable.',
        'Enemy spawn: invalid-enemy-spawn-order.',
      ]),
    );
  });
});
