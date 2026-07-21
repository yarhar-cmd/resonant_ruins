import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from '../config/topology';
import { EXPERIENCE_PRESET_IDS } from '../types/adaptation';
import type { ExitDirection } from '../types/rooms';
import { getRestorationFountains } from './interactions';
import { generateArchetypeRoomV3 } from './generatedRoomGeneratorV3';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';

const directions: ExitDirection[] = ['north', 'east', 'south', 'west'];

describe('generator-3 Restoration Fountain stress verification', () => {
  it('validates 240 forced safe/risky Fountain layouts across all topology inputs', () => {
    const variants = new Set<string>();
    const styles = new Set<string>();
    for (let index = 0; index < 240; index += 1) {
      const seed = `fountain-stress-${index}`;
      const archetype = ARCHETYPE_IDS[index % ARCHETYPE_IDS.length]!;
      const entranceDirection = directions[index % directions.length]!;
      const experiencePreset = EXPERIENCE_PRESET_IDS[index % EXPERIENCE_PRESET_IDS.length]!;
      const placementPreference = index % 2 === 0 ? 'safe' : 'risky';
      const profile = {
        pace: index % 3 === 0 ? 0.8 : 0.3,
        caution: placementPreference === 'safe' ? 0.85 : 0.2,
        aggression: 0.5,
        hazardTolerance: placementPreference === 'risky' ? 0.9 : 0.2,
        exploration: placementPreference === 'risky' ? 0.9 : 0.25,
      };
      const generated = generateArchetypeRoomV3(
        {
          runSeed: seed,
          dungeonRoomNumber: 12,
          chosenExitId: `${entranceDirection}-entry`,
          entranceDirection,
          experiencePreset,
          effectiveProfile: profile,
          mode: index % 3 === 0 ? 'poke' : 'reinforce',
          generatorVersion: 'generator-3',
          adaptationVersion: 'rules-2',
          gameVersion: 'mvp-0.3',
          recovery: {
            currentHealth: index % 4 === 0 ? 1 : 3,
            maximumHealth: 4,
            recentGeneratedDamage: index % 4 === 0 ? [2, 1] : [0],
            damageStreak: index % 4 === 0 ? 2 : 0,
            roomsSinceLastGeneratedSpawn: 6,
            roomsSinceLastUse: 6,
            previousSkipped: false,
            recentCombatPressure: index % 5,
            cooldownRemaining: 0,
            placementOverride: 'force',
            placementPreference,
          },
        },
        archetype,
        index % 20,
      );
      const validation = validateGeneratedRoomV3(generated.roomSnapshot);
      const fountains = getRestorationFountains(generated.roomSnapshot);
      if (!validation.valid || fountains.length > 1) {
        throw new Error(
          JSON.stringify({
            seed,
            archetype,
            entranceDirection,
            exitDirections: generated.roomSnapshot.exits.map((exit) => exit.direction),
            profile,
            fountainDecision: generated.details.recoveryDecision,
            placementCoordinate: fountains[0]?.tile ?? null,
            validation: validation.errors,
          }),
        );
      }
      if (fountains[0]) {
        variants.add(fountains[0].variant);
        styles.add(fountains[0].placementStyle);
      }
    }
    expect(styles).toEqual(new Set(['safe', 'risky']));
    expect(variants).toEqual(new Set(['wall-integrated', 'freestanding']));
  }, 120_000);

  it('never spawns while disabled or during cooldown', () => {
    for (let index = 0; index < 48; index += 1) {
      const generated = generateArchetypeRoomV3(
        {
          runSeed: `fountain-suppressed-${index}`,
          dungeonRoomNumber: 40,
          chosenExitId: 'suppressed',
          entranceDirection: directions[index % directions.length]!,
          experiencePreset: 'new-delver',
          effectiveProfile: {
            pace: 0.5,
            caution: 1,
            aggression: 0.5,
            hazardTolerance: 0.5,
            exploration: 0.5,
          },
          mode: 'reinforce',
          generatorVersion: 'generator-3',
          adaptationVersion: 'rules-2',
          gameVersion: 'mvp-0.3',
          recovery: {
            currentHealth: 1,
            maximumHealth: 6,
            recentGeneratedDamage: [3, 2],
            damageStreak: 3,
            roomsSinceLastGeneratedSpawn: 8,
            roomsSinceLastUse: 8,
            previousSkipped: false,
            recentCombatPressure: 4,
            cooldownRemaining: index % 2 === 0 ? 2 : 0,
            placementOverride: index % 2 === 0 ? 'force' : 'disable',
          },
        },
        ARCHETYPE_IDS[index % ARCHETYPE_IDS.length]!,
      );
      expect(getRestorationFountains(generated.roomSnapshot)).toHaveLength(0);
    }
  }, 60_000);
});
