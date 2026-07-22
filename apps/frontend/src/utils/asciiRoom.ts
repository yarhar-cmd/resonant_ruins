import type { RoomDefinition } from '../types/rooms';
import { coordinateKey } from './roomGeometry';

export function asciiRoom(room: RoomDefinition): string {
  const floor = new Set(room.floorTiles.map(coordinateKey));
  const walls = new Set(
    [...(room.outerWallTiles ?? []), ...(room.internalWallTiles ?? [])].map(coordinateKey),
  );
  const hazards = new Set((room.hazards ?? []).map(coordinateKey));
  const rats = new Set((room.enemySpawns ?? []).map((rat) => coordinateKey(rat.tile)));
  const exits = new Set(room.exits.map((exit) => coordinateKey(exit.tile)));
  const fountain = room.features?.find((feature) => feature.kind === 'restoration-fountain');
  const lines: string[] = [];
  for (let y = 0; y < room.height; y += 1) {
    let line = '';
    for (let x = 0; x < room.width; x += 1) {
      const key = coordinateKey({ x, y });
      line +=
        fountain && coordinateKey(fountain.tile) === key
          ? 'F'
          : exits.has(key)
            ? 'E'
            : rats.has(key)
              ? 'R'
              : hazards.has(key)
                ? '^'
                : walls.has(key)
                  ? '#'
                  : floor.has(key)
                    ? '.'
                    : ' ';
    }
    lines.push(line.trimEnd());
  }
  return lines.join('\n');
}
