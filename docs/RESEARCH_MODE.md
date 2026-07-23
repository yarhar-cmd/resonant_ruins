# Resonant Ruins Research Mode

Research Mode is an explicit, browser-local workflow for comparing two `generator-4` room selectors. It investigates whether behavior-adaptive selection increases the share of submitted difficulty ratings marked **About Right** without reducing fairness or enjoyment.

## Fixed Pilot protocol (`fixed-pilot-1`)

The Pilot is five Awakening Chambers once as **Practice**, **Run A** with exactly 10 durably
finalized generated-room outcomes, a neutral optional break, **Run B** with exactly 10 outcomes,
and session completion. Researchers enter a positive participant sequence number. Odd sequences
assign adaptive then neutral; even sequences reverse the order. Participants see only Practice,
Run A, and Run B. The assignment method is `pilot-sequence-alternation-1`.

Pilot participants are locked to the Warden and one selected experience preset. Practice creates
one shared profile baseline. Both condition blocks start from that saved baseline, while each may
update its own condition profile. Run B starts directly in generated-room opportunity 1.

Progress comes only from persisted room records. Submitted and explicitly skipped feedback count
after record-first finalization. Defeated rooms retain their defeated outcome and count after
feedback finalization; a new full-health attempt continues the same condition when fewer than 10
outcomes are stored.

The first participant tab owns the attempt and other tabs are read-only. Active participant play
hides conditions, selector evidence, diagnostics, summaries, exports, and Lab navigation.
Researcher verification and JSON/CSV export are available at `/research/review` after termination.
The optional completion form is stored separately as `pilot-exit-1`.

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

1. Capture the terminal room outcome and persist pending feedback against its `roomDecisionId`.
2. Block gameplay and show the feedback dialog.
3. Submit a required difficulty rating, optionally rate fairness/enjoyment, or explicitly confirm a full skip.
4. Finalize exactly one room record.
5. Continue to the next room after a clear, or show the existing post-defeat results after a defeat.

Awakening Chambers never request research feedback. A generated-room defeat now requests the same
feedback as a clear, while preserving `outcome.status: defeated` and null exit fields. Existing
records with `feedback.status: not_requested_due_to_defeat` remain valid and readable.

Room duration uses the run's pause-aware elapsed-time domain for both entry and terminal snapshots.
It excludes explicit pause time, refresh downtime excluded by active-run restoration, and time spent
answering feedback. The terminal snapshot also closes a still-held shield segment and copies shield
activation count without changing shield controls or combat.

Dataset finalization and active pending state remain separate localStorage writes. A saved record
under storage pressure is treated as committed and presents a separate warning. Identical
`roomDecisionId` retries are idempotent; conflicting retries remain blocked. Gameplay or results do
not advance until the record is committed (or confirmed identical) and pending state clears.

## Approved next Pilot milestone, not implemented here

The next Pilot-flow milestone may count defeated rooms toward a fixed 10-room condition block,
restore full health after feedback without replaying the defeated room, create one shared
post-practice profile baseline, counterbalance condition order from a researcher-entered sequence
(odd adaptive first, even neutral first), and label conditions to participants only as Run A and Run
B. Confirmed full-feedback skips remain allowed and excluded from About Right Rate. None of those
flow changes are implemented by this reliability milestone.

## Local data controls

Research records remain in the current browser until the player exports or deletes them. The Research page supports per-session and all-session JSON/CSV exports, Pilot deletion, individual deletion, and clear all. Every destructive action is confirmed and does not touch normal gameplay data.

There is no automatic upload, analytics SDK, account, device fingerprint, IP collection, or installed learned model. See [privacy](RESEARCH_PRIVACY.md), [schema](RESEARCH_DATA_SCHEMA.md), and [analysis](RESEARCH_ANALYSIS.md).
