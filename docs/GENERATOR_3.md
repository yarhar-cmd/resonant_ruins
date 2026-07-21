# Generator 3 topology contract

Generator 3 is the frontend-authoritative, deterministic room generator introduced for Resonant
Ruins `mvp-0.3`. `apps/frontend/src/utils/generatedRoomGenerator.ts` is the version dispatcher;
`generatedRoomGeneratorV3.ts` is the new implementation. Generator 2 remains the frozen
compatibility path and must not be silently reinterpreted as generator 3.

## Deterministic inputs

A room decision is reproducible from the run seed, dungeon room number, chosen exit ID, incoming
entrance direction, effective profile, experience preset, reinforce/poke mode, archetype, game
version, adaptation version, and generator version. The same inputs produce the same candidate
layouts, exits, scores, and selection.

## Candidate pipeline

1. Unlock archetypes from the experience preset and room number. Depth only expands vocabulary.
2. Attempt candidates deterministically, targeting 10 valid rooms and stopping after 20 attempts.
3. Validate layered geometry, reachability, approach space, Rune safety, and Rat placement.
4. Score versioned feature vectors with rules-2 profile influences.
5. Select from the top three with seeded weights of 50%, 30%, and 20%.
6. If only one or two candidates validate, select deterministically and mark reduced diversity.
7. If none validate, emit the deterministic safe fallback.

Normal active-run persistence contains the selected full room, compact top-three summaries, aggregate
rejection counts, and a bounded five-record decision history. It does not contain rejected layouts.

## Layered room model

- `floorTiles` is the exact reachable floor mask, including door tiles.
- `outerWallTiles` is derived from adjacency to that floor mask, not a bounding rectangle.
- `internalWallTiles` represents pillars, dividers, and loop centers inside the boundary.
- `features` is a versioned generic blocking/decorative extension point.
- `hazards` and `enemySpawns` remain separate gameplay layers.
- `topology` stores derived metrics used for validation and diagnostics.

The feature extension point does not implement a Fountain, healing, or any new gameplay object.

## Archetypes

- **Open Arena:** broad open space, with a possible cut corner and exits on several walls.
- **True L-Ruin:** a genuine L floor mask; exits connect to the actual ends of its arms.
- **Split Chamber:** an internal divider with two routes through it.
- **Pillar Hall:** open structure around four blocking pillars.
- **Ring Route:** a loop around a solid central structure.
- **Twin Chambers:** two safely connected chambers; exits may occupy different chambers.

## Directional transitions

Exits use `north`, `east`, `south`, or `west` and are placed only where a reachable approach floor
touches the room's real outer boundary. A selected north exit produces a south entrance in the next
room; south produces north; east produces west; west produces east. The entrance collapses after
entry, so continuity communicates spatial travel without adding room-to-room backtracking.

A room may expose one to three exits. Directions are distinct. Exploration mildly favors more
separate or optional routes; pace mildly favors a shorter, clearer direct route. At least one exit
must retain a Rune-free route from the spawn.

## Validation and diagnostics

Validation rejects disconnected floors, non-derived outer walls, invalid internal structures,
unreachable or trapped exits, duplicate exit directions, unsafe Rune placement, and invalid Rat
spawns. The effective generated Rat spawn minimum is five path tiles in generator 3. This preserves
the effective output constraint of generator 2, whose shared planner nominally requested four while
its validator rejected distances below five.

Development Debug Tools and explicitly enabled preview Playtest Diagnostics show archetype,
topology, candidate counts, compact ranking evidence, directional decisions, provenance, and an ASCII
map. These diagnostic interfaces remain excluded from normal production builds.
