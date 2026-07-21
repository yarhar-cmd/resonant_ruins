export const RESTORATION_FOUNTAIN_CONFIG = {
  channelDurationMs: 700,
  generatedCooldownRooms: 2,
  baseProbability: 0.08,
  healthDeficitWeight: 0.42,
  recentDamageWeight: 0.2,
  damageStreakWeight: 0.1,
  recoveryDroughtWeight: 0.12,
  cautionWeight: 0.06,
  recentPressureWeight: 0.06,
  skippedPenalty: 0.08,
  probabilityCeilings: {
    'new-delver': 0.72,
    'seasoned-adventurer': 0.56,
    'dungeon-veteran': 0.4,
  },
} as const;
