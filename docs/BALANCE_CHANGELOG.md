# Resonant Ruins balance changelog

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
