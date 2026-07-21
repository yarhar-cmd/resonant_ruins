import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from '../config/topology';
import { NEUTRAL_ADAPTIVE_PROFILE } from '../services/playerProfileStorage';
import { generateArchetypeRoomV3 } from './generatedRoomGeneratorV3';
import { validateGeneratedRoomV3 } from './generatedRoomValidatorV3';

describe('generator-3 stress verification', () => {
  for (let batch = 0; batch < 10; batch += 1) {
    it(`validates seeded archetype layouts ${batch * 500 + 1}-${(batch + 1) * 500}`, async () => {
      for (let offset = 0; offset < 500; offset += 1) {
        const index = batch * 500 + offset;
        const archetype = ARCHETYPE_IDS[index % ARCHETYPE_IDS.length]!;
        const request = {
          runSeed: `stress-${index}`,
          dungeonRoomNumber: 10,
          chosenExitId: `exit-${index}`,
          entranceDirection: (['north', 'east', 'south', 'west'] as const)[index % 4]!,
          experiencePreset: 'dungeon-veteran' as const,
          effectiveProfile: NEUTRAL_ADAPTIVE_PROFILE,
          mode: index % 2 ? ('reinforce' as const) : ('poke' as const),
          generatorVersion: 'generator-3' as const,
          adaptationVersion: 'rules-2' as const,
          gameVersion: 'mvp-0.3' as const,
        };
        const generated = generateArchetypeRoomV3(request, archetype, index);
        const validation = validateGeneratedRoomV3(generated.roomSnapshot);
        expect(validation.errors, `${generated.roomSeed}:${archetype}`).toEqual([]);
        if (offset % 25 === 24) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }
    }, 90_000);
  }
});
