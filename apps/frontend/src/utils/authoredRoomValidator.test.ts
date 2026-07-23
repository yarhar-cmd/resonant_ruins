import { describe, expect, it } from 'vitest';
import { evaluationRooms } from '../data/rooms/evaluationRooms';
import type {
  RestorationFountainFeature,
  RuinPropFeature,
  RuinTorchFeature,
} from '../types/topology';
import type { TileCoordinate } from '../types/rooms';
import { createRoomEnemyState } from './enemySystem';
import { validateAuthoredRoom } from './authoredRoomValidator';

function coordinateKey(tile: TileCoordinate) {
  return `${tile.x},${tile.y}`;
}

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

  it('keeps optional authored decor sparse, nonblocking, and clear of tutorial mechanics', () => {
    for (const room of evaluationRooms) {
      const props =
        room.features?.filter(
          (feature): feature is RuinPropFeature => feature.kind === 'ruin-prop',
        ) ?? [];
      expect(props.length, room.id).toBeLessThanOrEqual(1);
      for (const prop of props) {
        expect(prop.source).toBe('authored');
        expect(prop.blocking).toBe(false);
        expect(prop.variant).not.toBe('iron-coffer');
        expect(room.floorTiles).toContainEqual(prop.tile);
        expect(room.exits.map((exit) => exit.tile)).not.toContainEqual(prop.tile);
        expect(room.hazards ?? []).not.toContainEqual(prop.tile);
        expect(room.enemySpawns?.map((spawn) => spawn.tile) ?? []).not.toContainEqual(prop.tile);
      }
    }
  });

  it('builds a movement-only opening room with its approved inactive shortcut', () => {
    const chamber1 = evaluationRooms[0]!;
    expect(chamber1.hazards).toEqual([]);
    expect(chamber1.enemySpawns).toEqual([]);
    expect(chamber1.features?.some((feature) => feature.kind === 'restoration-fountain')).toBe(
      false,
    );
    expect(chamber1.exits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'standard', enabled: true }),
        expect.objectContaining({ kind: 'shortcut', enabled: false }),
      ]),
    );
  });

  it('gives Chamber 2 a short Rune-adjacent route and a longer Rune-clear route', () => {
    const chamber2 = evaluationRooms[1]!;
    const hazards = new Set(chamber2.hazards!.map(coordinateKey));
    const directRoute = Array.from({ length: 16 }, (_, index) => ({ x: index + 1, y: 5 }));
    const safeRoute = [
      { x: 1, y: 5 },
      { x: 1, y: 4 },
      { x: 1, y: 3 },
      ...Array.from({ length: 15 }, (_, index) => ({ x: index + 1, y: 2 })),
      { x: 15, y: 3 },
      { x: 15, y: 4 },
      { x: 15, y: 5 },
      { x: 16, y: 5 },
    ];
    expect(chamber2.hazards).toEqual([
      { x: 8, y: 4 },
      { x: 8, y: 6 },
    ]);
    expect(directRoute.every((tile) => !hazards.has(coordinateKey(tile)))).toBe(true);
    expect(
      Math.min(
        ...directRoute.flatMap((tile) =>
          chamber2.hazards!.map(
            (hazard) => Math.abs(tile.x - hazard.x) + Math.abs(tile.y - hazard.y),
          ),
        ),
      ),
    ).toBe(1);
    expect(
      safeRoute.every((tile) =>
        chamber2.floorTiles.some((floor) => coordinateKey(floor) === coordinateKey(tile)),
      ),
    ).toBe(true);
    expect(safeRoute.every((tile) => !hazards.has(coordinateKey(tile)))).toBe(true);
    expect(safeRoute.length).toBeGreaterThan(directRoute.length);
  });

  it('gives Chamber 3 one approachable Fountain and optional Runes without Rats', () => {
    const chamber3 = evaluationRooms[2]!;
    const fountain = chamber3.features?.find(
      (feature): feature is RestorationFountainFeature => feature.kind === 'restoration-fountain',
    );
    expect(chamber3.hazards).toHaveLength(2);
    expect(chamber3.enemySpawns).toEqual([]);
    expect(fountain).toBeDefined();
    expect(fountain?.interactionTiles).toEqual(
      expect.arrayContaining([
        { x: 10, y: 2 },
        { x: 9, y: 1 },
        { x: 11, y: 1 },
      ]),
    );
  });

  it('uses preset-scaled Rat lessons and enemy-sealed exits in Chambers 4 and 5', () => {
    const chamber4 = evaluationRooms[3]!;
    const chamber5 = evaluationRooms[4]!;
    const presets = ['new-delver', 'seasoned-adventurer', 'dungeon-veteran'] as const;
    expect(chamber4.enemySpawns?.map((spawn) => spawn.order)).toEqual([1, 2]);
    expect(chamber5.enemySpawns?.map((spawn) => spawn.order)).toEqual([1, 2]);
    expect(
      presets.map((preset) => createRoomEnemyState(chamber4, preset, 1_000).rats.length),
    ).toEqual([1, 1, 2]);
    expect(
      presets.map((preset) => createRoomEnemyState(chamber5, preset, 1_000).rats.length),
    ).toEqual([1, 2, 2]);
    expect(chamber4.exits.every((exit) => exit.condition.type === 'enemies-defeated')).toBe(true);
    expect(chamber5.exits.every((exit) => exit.condition.type === 'enemies-defeated')).toBe(true);
    expect(chamber4.hazards).toEqual([]);
    expect(chamber4.features?.some((feature) => feature.kind === 'restoration-fountain')).toBe(
      false,
    );
    expect(chamber5.hazards).toHaveLength(2);
    expect(
      chamber5.features?.filter((feature) => feature.kind === 'restoration-fountain'),
    ).toHaveLength(1);
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
