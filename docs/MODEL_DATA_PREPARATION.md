# Model data preparation

`apps/frontend/src/model/dataPreparation.ts` is the authoritative privacy-reduction boundary for
`mvp-0.5`. It accepts validated `research-1` JSON exports, discovers rated room records in stable
session/run/room order, excludes Pilot sessions by default, derives prior-rating history, applies an
explicit feature allowlist, assigns opaque `group-0001` labels, and writes `model-dataset-1` JSON.
CSV is an analysis export, not a training input.

```powershell
pnpm prepare:model-data -- research-exports --output model-data/private/prepared.json
pnpm prepare:model-data -- export-a.json export-b.json --output model-data/private/prepared.json
```

`--include-pilot` is an explicit development-only override. Output creation is exclusive and will
not overwrite an existing file. The dataset fingerprint is SHA-256 over canonical preparation
configuration, feature schema, opaque groups, ordered decision IDs, labels, semantic values,
duplicate decisions, Pilot policy, and compatible versions. Paths, timestamps, participant codes,
session IDs, and the discarded identity-to-group mapping are excluded.

The quality report counts duplicates, conflicting duplicates, unsupported versions/categories,
rejected feature rows, labels, groups, conditions, rated rooms, and missing labels. Preparation may
succeed below the Official thresholds, but it marks the dataset development-only. Official
readiness requires at least 100 rated Official rooms, five groups, ten labels in each class, no
conflicts, no unsupported input, and valid grouped evaluation. A serious artifact should preferably
have 300–500 rated rooms, ten groups, both conditions, and no Pilot data.

The current room's rating, outcome, damage, duration, post-room health, combat events, exit choice,
selector evidence, identities, and `profileAfter` are never features. Defeat-unrated and skipped
rooms do not enter the rating-class window, but they increment rooms since the last submitted
difficulty rating. History carries across runs in one research session and resets between sessions.
