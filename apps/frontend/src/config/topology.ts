import type { ExperiencePreset } from '../types/adaptation';
import type { RoomArchetype } from '../types/topology';

export const TOPOLOGY_CONFIG = {
  requestedCandidateCount: 10,
  maximumGenerationAttempts: 20,
  topCandidateCount: 3,
  topCandidateWeights: [0.5, 0.3, 0.2],
  rules2PokeContrast: 0.25,
  rules2SecondTraitChance: 0.22,
  minimumGeneratedRatPathDistance: 5,
  maximumWidth: 21,
  maximumHeight: 15,
  minimumWidth: 11,
  minimumHeight: 9,
} as const;

export const ARCHETYPE_IDS: Exclude<RoomArchetype, 'safe-fallback'>[] = [
  'open-arena',
  'true-l-ruin',
  'split-chamber',
  'pillar-hall',
  'ring-route',
  'twin-chambers',
];

export const ARCHETYPE_UNLOCK_ROOM: Record<
  ExperiencePreset,
  Record<Exclude<RoomArchetype, 'safe-fallback'>, number>
> = {
  'new-delver': {
    'open-arena': 1,
    'true-l-ruin': 1,
    'split-chamber': 1,
    'pillar-hall': 4,
    'twin-chambers': 6,
    'ring-route': 8,
  },
  'seasoned-adventurer': {
    'open-arena': 1,
    'true-l-ruin': 1,
    'split-chamber': 1,
    'pillar-hall': 3,
    'twin-chambers': 4,
    'ring-route': 6,
  },
  'dungeon-veteran': {
    'open-arena': 1,
    'true-l-ruin': 1,
    'split-chamber': 1,
    'pillar-hall': 1,
    'twin-chambers': 1,
    'ring-route': 3,
  },
};
