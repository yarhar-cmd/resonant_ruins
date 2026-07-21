# Neutral control and shared candidate pools

`generator-4` exists because generator-3 allowed behavior traits to influence candidate construction before ranking. Relabeling that behavior as a neutral condition would have confounded generation with selection.

Generator-4 constructs and validates one profile-independent candidate pool from shared non-experimental context: seeds, incoming direction, preset/content unlocks, health/recent damage/recovery state, Fountain cooldown/history, version, and safety configuration. It extracts the feature vectors and computes a stable pool ID before either selector runs.

Changing only pace, caution, aggression, hazard tolerance, exploration, reinforce/poke, or assigned condition cannot change candidate IDs/seeds, masks, walls, exits, Rat/Rune/Fountain opportunities, feature vectors, validation results, or rejection reasons. Tests compare complete pool evidence across neutral and extreme profiles and both conditions.

The adaptive selector alone receives behavioral traits and reinforce/poke context. It applies bounded rules-2 scoring and seeded weighted selection. The neutral selector’s context type contains no behavior profile, imports no adaptive transformations, and chooses deterministically using general quality, variety, repetition avoidance, and fallback avoidance. It does not always choose index zero and does not recreate adaptive scoring.

Fountain opportunity uses the same health and recovery context in both conditions. Behavioral traits cannot change which candidates contain a Fountain or the safe/risky placement candidates; they can only affect the adaptive selector’s preference among the shared rooms.

This is a deterministic rule-based experiment. It is not machine learning and does not establish causality, superiority, or generalizability on its own.
