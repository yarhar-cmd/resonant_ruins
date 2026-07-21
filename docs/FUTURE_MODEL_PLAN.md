# Future learned selector plan

No machine-learning model is trained, installed, or executed in `mvp-0.4`. The active adaptive selector is deterministic rules-based logic. Diagnostics report **No model installed**, model availability `unavailable`, and shadow mode `disabled`; no probabilities, synthetic scores, placeholder ranking, or AI-selected language is generated.

The `CandidateScoringModel` interface reserves a boundary for a future `LearnedRoomSelector`. A future model may score the same prevalidated feature vectors, but it must never bypass room safety, mutate candidate construction, or directly generate unsafe geometry. Deployment should begin in offline evaluation, then opt-in shadow mode, before any player-facing selection authority.

Prerequisites include an approved privacy/retention process, sufficient representative Official data, documented label definitions, missing-data handling, class-balance review, and evaluation grouped by participant/session. Random room-level train/test splits are prohibited because repeated rooms from one person and within-session carryover create leakage.

Evaluation should compare calibration and held-out participant/session outcomes against both `rules-selector-1` and `neutral-selector-1`, report uncertainty and subgroup limitations, and preserve a deterministic safe fallback. Model ID/version, feature schema, input provenance, availability, and decision evidence must be recorded. A model must not be described as improving play until prospective evidence supports that claim.
