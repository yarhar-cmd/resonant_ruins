export const RESONANCE_REWARD_CONFIG = {
  cacheSpawnChance: 0.35,
  cacheOpeningChannelMs: 400,
  resonancePerCache: 1,
  minimumEntranceDistance: 4,
  minimumExitDistance: 3,
  minimumDirectRouteDistance: 2,
  preferredInteractionTileCount: 2,
  categoryWeights: {
    'optional-dead-end': 60,
    'side-chamber': 50,
    'optional-branch': 40,
    alcove: 30,
    'longer-alternate-route': 20,
    'visible-detour': 10,
  },
} as const;

export type ResonanceRewardConfig = typeof RESONANCE_REWARD_CONFIG;
