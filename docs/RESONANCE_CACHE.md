# Resonance Cache

## Player behavior

A Resonance Cache is a compact ruined stone coffer with restrained brass details and a pale ivory
glow. It occupies one solid tile. The player and Rats cannot enter or path through it, and sword or
Rat attacks do not pass through it. Opening removes the glow and visibly opens the lid, but the
coffer remains present and solid.

To open a Cache, the player must stand on one of its validated cardinal interaction tiles, face the
coffer, and press a fresh E key. The visible Interact button provides the pointer equivalent. Held E
does not repeat, Enter remains focused-button activation, and touching the Cache does nothing.

The opening channel lasts 400 ms. Completion awards exactly one Resonance once. It cannot begin
while any living Rat is alerted; unaware Rats and corpses do not block it. A newly alerted Rat
cancels an active channel. Movement, tile change, turn-away, attack, shield, damage, defeat, room
transition, restart, target invalidation, lost adjacency, or lost facing also cancels. Pause freezes
the remaining duration; refresh restores only a still-valid channel.

## Accessibility and effects

The unopened accessible label is `Resonance Cache, unopened, grants one Resonance`; the opened label
is `Resonance Cache, opened`. The prompt is `E - Open Resonance Cache`. Opened/unopened states differ
in lid geometry and glow, so the distinction does not depend only on color and remains visible with
effects Off. Reduced-motion preferences suppress Cache animation while preserving state.

## State and telemetry

The generated feature stores ID, coordinate, `rewards-1` provenance, placement category, spawn
reason/roll, interaction tiles, optional-route score, blocking state, and visual variant. Generic
runtime state stores encounter/open timestamps, health at opening, exactly-once award state, and
channel cancellation reasons.

Research room records optionally store eligibility, candidate count, roll, spawn reason, location,
placement category/score, interaction-space count, encounter/open/skip outcomes, time to opening,
health at opening, Resonance before/after/earned, and cancellation reasons.

## Balance constants

All values are centralized in `apps/frontend/src/config/rewards.ts`:

- eligible-room spawn chance: 0.35;
- opening channel: 400 ms;
- award: 1 Resonance;
- minimum entrance distance: 4 path tiles;
- minimum exit distance: 3 path tiles;
- direct-safe-route exclusion and deterministic category weights.
