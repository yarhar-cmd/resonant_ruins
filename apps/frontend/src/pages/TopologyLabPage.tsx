import { useMemo, useState } from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { VERSION_INFO } from '../config/version';
import type { ExperiencePreset } from '../types/adaptation';
import type { ExitDirection } from '../types/rooms';
import type { FountainPlacementStyle, RoomArchetype } from '../types/topology';
import { generateArchetypeRoomV3 } from '../utils/generatedRoomGeneratorV3';
import { coordinateKey } from '../utils/roomGeometry';

const archetypes: Exclude<RoomArchetype, 'safe-fallback'>[] = [
  'open-arena',
  'true-l-ruin',
  'split-chamber',
  'pillar-hall',
  'ring-route',
  'twin-chambers',
];
const entrances: ExitDirection[] = ['north', 'east', 'south', 'west'];

function asciiRoom(room: ReturnType<typeof generateArchetypeRoomV3>['roomSnapshot']): string {
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

export function TopologyLabPage() {
  const [archetype, setArchetype] = useState<(typeof archetypes)[number]>('open-arena');
  const [entrance, setEntrance] = useState<ExitDirection>('west');
  const [preset, setPreset] = useState<ExperiencePreset>('seasoned-adventurer');
  const [fountain, setFountain] = useState<'force' | 'disable'>('force');
  const [placement, setPlacement] = useState<FountainPlacementStyle>('safe');
  const [seed, setSeed] = useState('topology-lab-001');
  const [generation, setGeneration] = useState(0);
  const save = useMemo(
    () =>
      generateArchetypeRoomV3(
        {
          runSeed: `${seed}:${generation}`,
          dungeonRoomNumber: 8,
          chosenExitId: 'sandbox-entry',
          entranceDirection: entrance,
          experiencePreset: preset,
          effectiveProfile: {
            pace: 0.5,
            caution: placement === 'safe' ? 0.8 : 0.25,
            aggression: 0.5,
            hazardTolerance: placement === 'risky' ? 0.8 : 0.25,
            exploration: placement === 'risky' ? 0.8 : 0.35,
          },
          mode: 'reinforce',
          generatorVersion: 'generator-3',
          adaptationVersion: 'rules-2',
          gameVersion: VERSION_INFO.gameVersion,
          recovery: {
            currentHealth: 1,
            maximumHealth: 3,
            recentGeneratedDamage: [1, 1],
            damageStreak: 2,
            roomsSinceLastGeneratedSpawn: 5,
            roomsSinceLastUse: 5,
            previousSkipped: false,
            recentCombatPressure: 2,
            cooldownRemaining: 0,
            placementOverride: fountain,
            placementPreference: placement,
          },
        },
        archetype,
      ),
    [archetype, entrance, fountain, generation, placement, preset, seed],
  );
  const ascii = asciiRoom(save.roomSnapshot);
  return (
    <PageContainer
      eyebrow="Generator-3 development instrument"
      title="Topology Lab"
      intro="In-memory room experiments. No active run, profile, best record, recovery cooldown, or Run History data is written."
    >
      <div className="sandbox-banner" role="status">
        SANDBOX · persistence guards active
      </div>
      <div className="topology-lab-controls">
        <label>
          Archetype
          <select
            value={archetype}
            onChange={(event) => setArchetype(event.target.value as typeof archetype)}
          >
            {archetypes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Incoming entrance
          <select
            value={entrance}
            onChange={(event) => setEntrance(event.target.value as ExitDirection)}
          >
            {entrances.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Experience
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as ExperiencePreset)}
          >
            <option value="new-delver">New Delver</option>
            <option value="seasoned-adventurer">Seasoned Adventurer</option>
            <option value="dungeon-veteran">Dungeon Veteran</option>
          </select>
        </label>
        <label>
          Fountain
          <select
            value={fountain}
            onChange={(event) => setFountain(event.target.value as typeof fountain)}
          >
            <option value="force">Force</option>
            <option value="disable">Disable</option>
          </select>
        </label>
        <label>
          Placement
          <select
            value={placement}
            onChange={(event) => setPlacement(event.target.value as FountainPlacementStyle)}
          >
            <option value="safe">Safe</option>
            <option value="risky">Risky</option>
          </select>
        </label>
        <label>
          Seed
          <input value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => setGeneration((value) => value + 1)}
        >
          Generate new seed
        </button>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => navigator.clipboard?.writeText(ascii)}
        >
          Copy ASCII map
        </button>
      </div>
      <div className="topology-lab-output">
        <pre aria-label="Generated room ASCII map">{ascii}</pre>
        <dl>
          <div>
            <dt>Archetype</dt>
            <dd>{save.details.archetype}</dd>
          </div>
          <div>
            <dt>Boundary</dt>
            <dd>{save.details.boundaryFamily}</dd>
          </div>
          <div>
            <dt>Exits</dt>
            <dd>{save.roomSnapshot.exits.map((exit) => exit.direction).join(', ')}</dd>
          </div>
          <div>
            <dt>Fountain</dt>
            <dd>
              {save.details.recoveryDecision?.spawned
                ? `${save.details.recoveryDecision.placementStyle} · ${save.details.recoveryDecision.visualVariant}`
                : 'not spawned'}
            </dd>
          </div>
          <div>
            <dt>Recovery roll</dt>
            <dd>
              {save.details.recoveryDecision
                ? `${save.details.recoveryDecision.roll.toFixed(3)} / ${save.details.recoveryDecision.probability.toFixed(3)}`
                : 'n/a'}
            </dd>
          </div>
          <div>
            <dt>Reason tokens</dt>
            <dd>{save.details.recoveryDecision?.reasons.join(', ') || 'none'}</dd>
          </div>
        </dl>
      </div>
    </PageContainer>
  );
}
