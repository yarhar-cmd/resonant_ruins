# Research data schema

Research records are runtime-validated with Zod at storage and export boundaries.

## Versions and namespaces

- Game: `mvp-0.5`
- Generator: `generator-4`
- Adaptation rules: `rules-2`
- Research schema: `research-1`
- Feedback schema: `feedback-1`
- Reward system: optional `rewards-1` extension
- Storage: `resonant-ruins:research:v1`
- Active research run: `resonant-ruins:research-active-run:v1`

The research envelope contains sessions, sessions contain runs, and runs contain one record per generated room. Normal saves use separate `mirrorvault:*` namespaces. Frozen generator-2 and generator-3 normal runs retain their original provenance and implementation.

## Session and run records

A session records Pilot/Official status, optional participant code, assignment unit/method, deterministic session seed, neutral starting-profile source, session-local profile, lifecycle timestamps, and its runs. A run records its stable assigned condition, assignment evidence, experience preset, character, status, and room records.

## Room records

Each room record includes:

- session/run/room identifiers and exactly-once `roomDecisionId`;
- all version metadata and Pilot flag;
- condition, selector ID/version, profile-consumed flag, deterministic roll, explanations, and selected rank/score;
- shared pool ID, requested/valid/rejected counts, rejection counts, top candidates, and selected feature vector;
- entrance, archetype, boundary, exits, Fountain opportunity, and safe-route evidence;
- optional rewards-1 eligibility, roll, placement, Cache encounter/open/skip, Resonance, and
  cancellation evidence;
- profile snapshots, recent performance, health, combat/movement/hazard metrics, exit outcome, and completion/defeat status;
- feedback status, difficulty, optional fairness/enjoyment, skipped fields, and response timing.

The pending active-run envelope stores the exact pending record and current answers before the next room exists. Repeated finalization of an identical `roomDecisionId` is idempotent; conflicting content with the same ID is rejected.

## Defeat and incomplete data

Defeat records preserve available metrics, selected candidate evidence, and room identity. They use `outcome.status: defeated`, no chosen exit, and `feedback.status: not_requested_due_to_defeat`. Ended sessions may retain interrupted runs; analysis reports incomplete sessions and missing feedback as data-quality signals.

See [the CSV dictionary](RESEARCH_DATA_DICTIONARY.md) for flattened export fields.

Rewards remain optional inside `research-1`. This preserves validation and export compatibility for
pre-rewards records instead of inventing values. Cache encounter requires a real adjacent/facing
opportunity; spawn alone is not an encounter. A spawned unopened Cache is skipped when the room
ends, including defeat when that definition is actually satisfied. Pilot and Official use the same
reward rules in both conditions, and reward fields are excluded from model-features-1.
