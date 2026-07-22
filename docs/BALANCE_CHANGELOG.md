# Resonant Ruins balance changelog

## mvp-0.5 - Resonance Cache reward foundation

Reward values are centralized in `apps/frontend/src/config/rewards.ts`.

- Maximum one Cache per newly generated generator-4 room.
- Eligibility requires a meaningful optional-route placement before rolling.
- Spawn chance is 35% of eligible rooms, not 35% of all rooms.
- Opening channel is 400 ms and awards exactly 1 run-local Resonance.
- A living alerted Rat blocks/cancels opening; unaware Rats and corpses do not.
- Placement favors optional dead ends, side chambers, branches, alcoves, longer alternate routes,
  and visible detours while preserving the direct Rune-free route and complete room validation.
- Resonance is score-only and does not change difficulty, recovery, adaptation, or model scoring.

### Remaining balance questions

- Is 35% of eligible rooms frequent enough to make optional exploration feel consistently useful?
- Is 400 ms readable after combat without making collection feel slow?
- Do placement weights create enough visible detours without overusing dead ends?
- Does Best Resonance motivate exploration without distracting from survival and room completion?

## mvp-0.4 — Shared-pool selection

- New runs move from generator-3 to generator-4 because behavior traits no longer participate in
  candidate construction. This changes seeded generated-room sequences and is therefore recorded as
  new generator provenance.
- Candidate target/attempt limits, topology safety, combat, Rune, Fountain, and depth-unlock values
  are unchanged. Frozen generator-2 and generator-3 runs are unchanged.
- Rules-2 behavioral influence and reinforce/poke now operate only during adaptive ranking. The
  neutral condition selects from the identical pool using non-profile quality and variety rules.
- No combat, health, shield, hazard, or recovery tuning value changed in this milestone.

## mvp-0.3 — Restoration and run pacing

Recovery values are centralized in `apps/frontend/src/config/recovery.ts`.

- Restoration Fountain channel: 700 ms; restores exactly 1 HP; maximum one generated Fountain per
  room; no invulnerability; no enemy pause; single use.
- Generated cooldown: a spawn suppresses the next 2 generated rooms, including when skipped.
- Base opportunity: 0.08. Weights: health deficit 0.42, recent damage 0.20, damage streak 0.10,
  recovery drought 0.12, caution 0.06, recent combat pressure 0.06; skipped penalty 0.08.
- Probability ceilings: New Delver 0.72, Seasoned Adventurer 0.56, Dungeon Veteran 0.40.
- Safe placement favors rune/Rat distance and multiple interaction tiles. Risky placement favors an
  optional longer route but must still pass connectivity and safe-route validation.
- Depth only controls feature availability and does not change recovery probability.
- Shield block feedback changed from sage to larger metallic silver/gray; timing and combat rules did
  not change. Health symbols are larger and include explicit current/max text.

### Remaining balance questions

- Do the preset ceilings provide enough support without making Fountains predictable?
- Does a two-room cooldown feel sparse when a spawned Fountain is skipped?
- Are risky placements meaningfully optional without delaying room flow too much?
- Is 700 ms readable under one to three Rat pressure after combat clears?

## mvp-0.3 — Dungeon Topology foundation

Generator values are centralized in `apps/frontend/src/config/topology.ts`.

- Added generator-3 with a target of 10 valid candidates, a 20-attempt ceiling, and seeded top-three
  selection weights of 50%, 30%, and 20%.
- Added preset-specific archetype unlock schedules. Room depth only unlocks layout vocabulary and
  does not multiply difficulty or scoring.
- Added rules-2 poke contrast: one trait, occasionally two at a 22% seeded chance, moves 25% toward
  its inverse for candidate scoring.
- Added mild scoring influence from distinct directional exit options: exploration favors options;
  pace favors a clearer direct route and slightly fewer choices.
- Preserved an effective minimum generated Rat spawn path distance of 5 in generator-3. Generator-2
  has a nominal planner value of 4 but its shipped validator rejects values below 5; generator-2 is
  unchanged.
- Reserved spawn, exits, the direct safe path, and topology articulation points from Rune placement.

### Remaining balance questions

- Do 10 candidates create enough visible layout diversity without making generation feel repetitive?
- Is the 50/30/20 choice varied enough while still reflecting profile scoring?
- Are multi-exit rooms frequent and legible enough for exploratory profiles?
- Are optional routes meaningfully longer without creating confusing dead ends?
- Does rules-2 poke feel like a mild contrast rather than a reversal of the player's style?
- Are preset archetype unlocks introduced at an understandable pace?

## mvp-0.2 — Rat Combat & Kiting

Initial values are centralized in `apps/frontend/src/config/combat.ts`.

- Increased Rat telegraph from 300 ms to 425 ms so one 200 ms player repeat interval leaves a readable dodge/turn response window.
- Replaced the former 1,200 ms cooldown with a 100 ms visual lunge followed by 300 ms standard recovery.
- Added a 500 ms total perfect-block recovery and a final 125 ms perfect-block input window.
- Added 500 ms room-entry awareness grace, 7-tile path awareness, and 3-tile attacked-Rat alert propagation.
- Changed generated Rat minimum spawn path distance from 5 to 4, requiring `generator-2` so generated output provenance remains explicit.
- Preserved Rat health (2), damage (1), movement interval (333 ms), sword range/damage/timing, player invulnerability (500 ms), and existing Rat count caps.
- Added deterministic escape-tile reservation protection only when static geometry offers at least two choices.

### Remaining balance questions

- Is 425 ms readable without making one-Rat attacks trivial to dodge?
- Does 300 ms recovery reliably permit one counterattack with the existing 400 ms sword cooldown?
- Is the 125 ms perfect-block window achievable at normal keyboard latency without dominating dodging?
- Does 500 ms perfect recovery create enough reward without trivializing multi-Rat pressure?
- Does 7-tile awareness activate authored and generated encounters at an understandable distance?
- Does the 4-tile generated spawn minimum create early pressure without unfair room entry?
- How frequently does body-lock prevention activate in real three- and four-Rat play?

Use development-only Combat Debug counters and manual browser sessions for tuning. Do not treat these counters as research telemetry.

## Preview playtest adjustment: attack readability

**Observed problem:** Rat attacks resolve too quickly for players to reliably read facing, recognize the wind-up, and choose a deliberate dodge or directional block.

**Old value:** 425 ms attack telegraph.

**New value:** 600 ms attack telegraph.

**Expected effect:** Provide enough time for one intentional reaction while preserving the timing difficulty of the final-125 ms perfect block. The perfect-block window remains exactly 125 ms relative to logical impact; no other combat timing or rule changed.

**Result:** Requires additional playtesting.
