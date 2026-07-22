# Reward system

## Scope and version

`rewards-1` is the first reward-system contract in Resonant Ruins. It adds only one reward object,
one collected unit, and one run-local score:

- object: Resonance Cache;
- unit: Resonance Shard;
- resource: Resonance;
- reward: exactly 1 Resonance per successfully opened Cache;
- maximum: one Cache per generated room;
- use in mvp-0.5: score only.

There is no inventory, currency spending, rarity, loot table, upgrade, permanent progression, or
generation/adaptation feedback from Resonance.

## Authoritative pipeline

The pipeline order is fixed:

1. generator-4 builds one profile-independent validated shared candidate pool;
2. the active Rules or Neutral selector chooses a room;
3. the active decision is final;
4. an optional shadow model scores the unchanged pool and finalizes evidence;
5. rewards-1 evaluates only the selected room;
6. eligibility, seeded spawn roll, and seeded placement are computed;
7. complete validation reruns with the Cache as a solid feature;
8. the selected-room snapshot stores the reward decision and gameplay begins.

The layer does not mutate pool identity, candidate IDs, selector rank/roll/explanation, feature
vectors, shadow probabilities/ranks, topology, entrances, exits, Rats, Runes, or Fountains.

## Eligibility, roll, and placement

A selected generator-4 room is eligible only when a validated location rewards a meaningful
optional route: a dead end, branch, side chamber, alcove, longer alternate path, or a visible but
intentional detour. Direct safe-route tiles, entrance/exit areas, Open Arena centers, articulation
points, walls, void, hazards, Rats, Fountains, and other solid features are excluded.

Eligible rooms receive a deterministic `0.35` spawn roll derived from run seed, room number,
selected candidate ID, and reward-system version. The roll never uses condition, player profile,
preset traits, selector output, ratings, reinforce/poke, or model predictions. Placement scoring
prioritizes optional dead ends, side chambers, branches, alcoves, longer routes, and visible
detours, then uses entrance/direct-route/exit distance and interaction space. Stable seeded
tie-breaking makes identical inputs reproduce identical output.

If final validation fails, the Cache is removed without regenerating the room or changing the
selection. Authored rooms and safe fallbacks are suppressed. Only new generator-4 rooms use the
layer; old restored room snapshots and frozen generator-2/generator-3 continuations are unchanged.

## Execution modes and research

Normal, Pilot Research, and Official Research use the same rewards-1 process. Rules Adaptive and
Neutral Procedural receive identical reward results for identical selected-room inputs. Research
stores reward presence/use so later analysis can control for it, but reward data is not part of
`model-features-1` and cannot affect current shadow predictions.

The Model Lab sandbox can explicitly force or disable a Cache. These controls are memory-only,
write-disabled, and compiled only for local development or an explicitly enabled Preview.
Production scans reject the mutation controls.

## Persistence

Active-run schema v9 stores current Resonance, the selected Cache feature, generic interaction
runtime, opened/encountered/award state, cancellation reasons, and safe remaining channel time.
Archive schema v4 stores per-run Resonance and reward provenance. Legacy data migrates to zero
Resonance with no reward provenance instead of fabricating Cache activity. Normal best records are
partitioned by character and experience preset; Research and sandbox never update them.

Research remains schema `research-1`: rewards-1 fields are optional, so old records remain valid.
The flat CSV contract contains 103 stable columns after the reward extension.

## Future possibilities

Spendable Resonance, upgrades, additional Cache types, keys, reward rooms, and adaptive reward
pacing require separate product, experimental, migration, and model-feature decisions. None are
implemented by rewards-1.
