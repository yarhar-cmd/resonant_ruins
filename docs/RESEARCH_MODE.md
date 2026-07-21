# Resonant Ruins Research Mode

Research Mode is an explicit, browser-local workflow for comparing two `generator-4` room selectors. It investigates whether behavior-adaptive selection increases the share of submitted difficulty ratings marked **About Right** without reducing fairness or enjoyment.

## Conditions

- `RULES_ADAPTIVE` uses `rules-adaptive` / `rules-selector-1`. It scores a shared validated candidate pool with the five session-local behavior traits and bounded reinforce/poke context.
- `NEUTRAL_PROCEDURAL` uses `neutral-procedural` / `neutral-selector-1`. It sees the same pool and safety evidence but does not receive behavior traits or adaptive transformations.

Both conditions use identical generator, candidate-attempt limits, experience preset, room validation, Rat/Rune/Fountain rules, exits, fallbacks, and deterministic seed structure. The neutral selector is a fair control, not an intentionally weaker generator.

## Starting and running a session

Research recording is disabled until the player reads the participation notice and explicitly chooses **Start Pilot Session** or **Start Research Session**. The optional participant code accepts 1–32 letters, numbers, underscores, or hyphens after trimming. It is a researcher-assigned code, not a guarantee of anonymity.

The default assignment unit is per run. `balanced-two-run-blocks-1` deterministically assigns one adaptive and one neutral run in every two-run block, with seeded order. A session can start another run after its active run ends. The assigned condition stays stable and is hidden from normal gameplay UI.

Pilot sessions use the same conditions, schemas, feedback, storage, and exports as Official sessions, with `pilot: true`. They are excluded from official summaries and offline analysis unless explicitly included.

## Isolation and room completion

Normal and research active runs use separate keys and may coexist. Research Mode never writes the normal active run, permanent profile, History, or best records. Adaptive learning is held in the research session profile. Neutral runs may update that profile for later analysis but never consume it for selection.

Generated-room completion follows this order:

1. Capture the completed room outcome and persist pending feedback against its `roomDecisionId`.
2. Block gameplay and show the feedback dialog.
3. Submit a required difficulty rating, optionally rate fairness/enjoyment, or explicitly confirm a full skip.
4. Finalize exactly one room record, then generate and enter the next room.

Awakening Chambers never request research feedback. Defeat stores an incomplete generated-room outcome with `not_requested_due_to_defeat`; it does not fabricate an exit or rating.

## Local data controls

Research records remain in the current browser until the player exports or deletes them. The Research page supports per-session and all-session JSON/CSV exports, Pilot deletion, individual deletion, and clear all. Every destructive action is confirmed and does not touch normal gameplay data.

There is no automatic upload, analytics SDK, account, device fingerprint, IP collection, or installed learned model. See [privacy](RESEARCH_PRIVACY.md), [schema](RESEARCH_DATA_SCHEMA.md), and [analysis](RESEARCH_ANALYSIS.md).
