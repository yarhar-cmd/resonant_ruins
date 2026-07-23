import type { RoomDefinition } from '../../types/rooms';
import type {
  RuinPropFeature,
  RuinPropVisualVariant,
  RuinTorchFeature,
} from '../../types/topology';
import { createRectangularRoom } from '../../utils/roomGeometry';

export const EVALUATION_ROOM_1_ID = 'evaluation-room-01';
export const EVALUATION_ROOM_2_ID = 'evaluation-room-02';
export const EVALUATION_ROOM_3_ID = 'evaluation-room-03';
export const EVALUATION_ROOM_4_ID = 'evaluation-room-04';
export const EVALUATION_ROOM_5_ID = 'evaluation-room-05';

export const EVALUATION_ROOM_IDS = [
  EVALUATION_ROOM_1_ID,
  EVALUATION_ROOM_2_ID,
  EVALUATION_ROOM_3_ID,
  EVALUATION_ROOM_4_ID,
  EVALUATION_ROOM_5_ID,
] as const;

export const MIDDLE_EVALUATION_ROOM_IDS = [
  EVALUATION_ROOM_2_ID,
  EVALUATION_ROOM_3_ID,
  EVALUATION_ROOM_4_ID,
] as const;

function awakeningTorchPair(
  roomId: string,
  westColumn: number,
  eastColumn: number,
): RuinTorchFeature[] {
  return [
    {
      id: `${roomId}-torch-west`,
      kind: 'ruin-torch',
      tile: { x: westColumn, y: 0 },
      blocking: false,
      source: 'authored',
    },
    {
      id: `${roomId}-torch-east`,
      kind: 'ruin-torch',
      tile: { x: eastColumn, y: 0 },
      blocking: false,
      source: 'authored',
    },
  ];
}

function awakeningProps(
  roomId: string,
  props: ReadonlyArray<{
    variant: RuinPropVisualVariant;
    x: number;
    y: number;
  }>,
): RuinPropFeature[] {
  return props.map(({ variant, x, y }, index) => ({
    id: `${roomId}-prop-${index + 1}`,
    kind: 'ruin-prop',
    tile: { x, y },
    blocking: false,
    source: 'authored',
    variant,
  }));
}

export const evaluationRooms: readonly RoomDefinition[] = [
  createRectangularRoom({
    id: EVALUATION_ROOM_1_ID,
    phase: 'evaluation',
    width: 15,
    height: 11,
    exitEnabled: true,
    exits: [
      {
        id: `${EVALUATION_ROOM_1_ID}-east-exit`,
        direction: 'east',
        tile: { x: 14, y: 4 },
        kind: 'standard',
        condition: { type: 'always' },
        enabled: true,
      },
      {
        id: `${EVALUATION_ROOM_1_ID}-shortcut-exit`,
        direction: 'east',
        tile: { x: 14, y: 6 },
        kind: 'shortcut',
        condition: { type: 'always' },
        enabled: false,
      },
    ],
    features: [
      ...awakeningTorchPair(EVALUATION_ROOM_1_ID, 4, 10),
      ...awakeningProps(EVALUATION_ROOM_1_ID, [{ variant: 'rubble-cluster', x: 4, y: 3 }]),
    ],
  }),
  createRectangularRoom({
    id: EVALUATION_ROOM_2_ID,
    phase: 'evaluation',
    width: 17,
    height: 11,
    exitEnabled: true,
    hazards: [
      { x: 8, y: 4 },
      { x: 8, y: 6 },
    ],
    features: [...awakeningTorchPair(EVALUATION_ROOM_2_ID, 5, 11)],
  }),
  createRectangularRoom({
    id: EVALUATION_ROOM_3_ID,
    phase: 'evaluation',
    width: 15,
    height: 13,
    exitEnabled: true,
    hazards: [
      { x: 6, y: 5 },
      { x: 7, y: 8 },
    ],
    features: [
      {
        id: `${EVALUATION_ROOM_3_ID}-restoration-fountain`,
        kind: 'restoration-fountain',
        tile: { x: 10, y: 1 },
        blocking: true,
        source: 'authored',
        placementStyle: 'safe',
        variant: 'wall-integrated',
        orientation: 'south',
        interactionTiles: [
          { x: 10, y: 2 },
          { x: 9, y: 1 },
          { x: 11, y: 1 },
        ],
      },
      {
        id: `${EVALUATION_ROOM_3_ID}-torch-west`,
        kind: 'ruin-torch',
        tile: { x: 8, y: 0 },
        blocking: false,
        source: 'authored',
      },
      {
        id: `${EVALUATION_ROOM_3_ID}-torch-east`,
        kind: 'ruin-torch',
        tile: { x: 12, y: 0 },
        blocking: false,
        source: 'authored',
      },
      ...awakeningProps(EVALUATION_ROOM_3_ID, [{ variant: 'rubble-cluster', x: 4, y: 10 }]),
    ],
  }),
  createRectangularRoom({
    id: EVALUATION_ROOM_4_ID,
    phase: 'evaluation',
    width: 17,
    height: 11,
    exitEnabled: true,
    exits: [
      {
        id: `${EVALUATION_ROOM_4_ID}-east-exit`,
        direction: 'east',
        tile: { x: 16, y: 5 },
        kind: 'standard',
        condition: { type: 'enemies-defeated' },
        enabled: true,
      },
    ],
    enemySpawns: [
      {
        id: `${EVALUATION_ROOM_4_ID}-rat-1`,
        type: 'rat',
        tile: { x: 10, y: 5 },
        order: 1,
        source: 'authored',
        reason: 'Primary combat introduction',
      },
      {
        id: `${EVALUATION_ROOM_4_ID}-rat-2`,
        type: 'rat',
        tile: { x: 12, y: 3 },
        order: 2,
        source: 'authored',
        reason: 'Veteran-only secondary combat pressure',
        experiencePresets: ['dungeon-veteran'],
      },
    ],
    features: [...awakeningTorchPair(EVALUATION_ROOM_4_ID, 5, 11)],
  }),
  createRectangularRoom({
    id: EVALUATION_ROOM_5_ID,
    phase: 'evaluation',
    width: 21,
    height: 15,
    exitEnabled: true,
    hazards: [
      { x: 8, y: 5 },
      { x: 12, y: 9 },
    ],
    exits: [
      {
        id: `${EVALUATION_ROOM_5_ID}-east-exit`,
        direction: 'east',
        tile: { x: 20, y: 7 },
        kind: 'standard',
        condition: { type: 'enemies-defeated' },
        enabled: true,
      },
    ],
    enemySpawns: [
      {
        id: `${EVALUATION_ROOM_5_ID}-rat-1`,
        type: 'rat',
        tile: { x: 10, y: 3 },
        order: 1,
        source: 'authored',
        reason: 'Combined encounter lead',
      },
      {
        id: `${EVALUATION_ROOM_5_ID}-rat-2`,
        type: 'rat',
        tile: { x: 14, y: 9 },
        order: 2,
        source: 'authored',
        reason: 'Combined encounter center pressure',
        experiencePresets: ['seasoned-adventurer', 'dungeon-veteran'],
      },
    ],
    features: [
      ...awakeningTorchPair(EVALUATION_ROOM_5_ID, 6, 14),
      {
        id: `${EVALUATION_ROOM_5_ID}-restoration-fountain`,
        kind: 'restoration-fountain',
        tile: { x: 10, y: 13 },
        blocking: true,
        source: 'authored',
        placementStyle: 'safe',
        variant: 'wall-integrated',
        orientation: 'north',
        interactionTiles: [
          { x: 10, y: 12 },
          { x: 9, y: 13 },
          { x: 11, y: 13 },
        ],
      },
      ...awakeningProps(EVALUATION_ROOM_5_ID, [{ variant: 'rubble-cluster', x: 5, y: 3 }]),
    ],
  }),
];

export function getEvaluationRoom(roomId: string, shortcutUnlocked = false): RoomDefinition | null {
  const room = evaluationRooms.find((item) => item.id === roomId);
  if (!room) return null;
  if (room.id !== EVALUATION_ROOM_1_ID) return room;
  return {
    ...room,
    exits: room.exits.map((exit) =>
      exit.kind === 'shortcut' ? { ...exit, enabled: shortcutUnlocked } : exit,
    ),
  };
}
