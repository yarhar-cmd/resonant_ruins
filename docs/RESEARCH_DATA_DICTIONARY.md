# Research CSV data dictionary

CSV export uses one generated room per row and a stable header from `RESEARCH_CSV_COLUMNS` in `apps/frontend/src/research/export.ts`. Empty values are empty cells. Arrays and nested objects are compact JSON strings, not JavaScript object coercions. Fields beginning with spreadsheet formula characters are prefixed safely, then all fields receive RFC 4180 quoting where needed.

## Identity and versions

| Field group                                                                                                     | Meaning                                            |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `research_session_id`, `run_id`, `room_id`, `room_decision_id`, `room_sequence`                                 | Pseudonymous record linkage and room ordering      |
| `pilot`, `participant_code`                                                                                     | Pilot/Official marker and optional researcher code |
| `research_schema_version`, `feedback_schema_version`, `game_version`, `generator_version`, `adaptation_version` | Exact provenance                                   |
| `captured_at`                                                                                                   | Local record timestamp serialized as ISO 8601      |

## Assignment and selection

| Field group                                                    | Meaning                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| `condition`, `assignment_method_id`                            | Stable run condition and balanced assignment method          |
| `selector_id`, `selector_version`, `selector_profile_consumed` | Selector boundary and whether behavior traits were inputs    |
| `shared_pool_id`                                               | Stable identity of the shared validated candidate pool       |
| requested/valid/rejected candidate fields                      | Candidate construction and validation evidence               |
| selected candidate/rank/score/roll fields                      | Deterministic selection evidence; neutral score may be empty |
| `top_candidates`, `rejection_counts`, `explanation_tokens`     | Compact JSON evidence                                        |

## Selected room features

Flattened feature columns describe archetype/boundary, dimensions and floor area, openness and walls, path/directness, exits, loops/branches/articulation/chokepoints/dead ends, combat area, Rune density, Rat count/distance, unlock level, and fallback use. These are the selected candidate’s pre-outcome features.

## Context and outcome

Profile-before/profile-after columns contain the five bounded traits. Performance columns describe recent damage, damage streak, combat pressure, and Fountain drought/cooldown. Outcome columns include status, duration, health, damage, Rune contacts, combat actions, shield time, movement/exploration, exit choice, and Fountain encounter/use/skip details.

## Feedback

`feedback_status` distinguishes pending, submitted, skipped, and defeat-not-requested records. `difficulty` is `too_easy`, `about_right`, or `too_hard` when submitted. Fairness and enjoyment are optional 1–5 values. Skip fields and response duration retain missingness explicitly.

The authoritative header and row mapping are tested in `apps/frontend/src/research/export.test.ts`.
