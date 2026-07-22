# Model feature schema

The language-neutral manifest at
`apps/frontend/src/model/schema/model-features-1.json` defines one shared encoding contract for
TypeScript preparation, Python training, TypeScript inference, artifacts, parity fixtures, and
explanations. Unknown categories and missing required values are compatibility failures.

The target class order is `too_easy`, `about_right`, `too_hard`. The 31 semantic features are:

- Player/context: pace, caution, aggression, hazard tolerance, exploration, health percentage,
  recent damage, recent average duration and count, rooms completed, experience preset, and incoming
  direction.
- Prior ratings: previous rating plus availability, last-three About Right rate and class counts,
  rated-window size, and rooms since the last submitted difficulty rating.
- Candidate room: archetype, boundary family, floor area, openness, chokepoints, dead-end length,
  safe-path distance, directness, Rats, Runes, average Rat distance, and Fountain placement.

Categorical values use fixed full one-hot vocabularies for preset, all four directions, previous
rating including `__missing__`, all generator-4 archetypes/boundaries, and Fountain placement
`none|safe|risky`. There is no ordinal category encoding. Missing previous ratings use both
`__missing__` and `previousRatingAvailable=0`; other documented cold-start fields use explicit count
indicators. `profileForRoom` (the recorded `profileBefore`) is authoritative. `profileAfter` is
forbidden because it includes behavior from the room being predicted.
