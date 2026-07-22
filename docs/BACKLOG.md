# Resonant Ruins backlog

## Completed mvp-0.5 presentation polish

- [x] **High - Visual identity** - Refine dungeon materials, entities, lighting, interactions,
      transitions, and shared interface styling without changing tile geometry or gameplay state.
- [x] **High - Centralized audio** - Add procedural typed effects, quiet route-scoped ambience,
      autoplay-safe activation, voice limits, persistent volume controls, and mute.
- [x] **High - Player-facing decluttering** - Focus navigation, Home, HUD, and Research on their
      primary flows and collapse researcher/development detail by default.
- [x] **High - Accessible progressive disclosure** - Group Settings and Labs, preserve routes and
      build gates, and retain keyboard, skip-link, focus, contrast, reduced-motion, and responsive
      behavior.

## Completed mvp-0.5 sidequest: Resonance Caches

- [x] **High - Resonance Cache reward foundation** - Add deterministic post-selection rewards-1,
      optional-route eligibility, one solid Cache, generic 400 ms interaction, and score-only
      run-local Resonance without changing generator-4 selection or model-features-1.
- [x] **High - Reward persistence and reporting** - Migrate active save v9 and archive v4; show
      Resonance in HUD, Pause, Game Over, History, and preset-partitioned Best Resonance.
- [x] **High - Research/model isolation** - Use identical Rules/Neutral reward behavior, optional
      research-1 telemetry, 103-column exports, model prediction invariance, diagnostics, sandbox
      controls, and Production exclusion checks.

## mvp-0.5: Baseline Learned Selector & Model Laboratory

- [x] **Critical — Privacy-safe model data boundary** · Allowlisted `model-features-1`, prior-only
      ratings, opaque grouping, fingerprints, Pilot exclusion, and Official thresholds.
- [x] **Critical — Offline grouped model pipeline** · Pinned Python environment, baselines,
      deterministic grouped evaluation, logistic variants, and strict development/approval gates.
- [x] **Critical — Zero-control shadow inference** · Zod artifact validation, TypeScript parity,
      typed failures, post-selection isolation, compact evidence, and prediction blinding.
- [x] **High — Model Comparison Lab** · Local/flagged-Preview registry/import/comparison/
      explanation tools with production exclusion.
- [x] **High — Counterfactual and data safety** · Memory-only sandbox, centralized no-write policy,
      staged/tracked data scanner, privacy ignores, and browser contamination tests.
- [ ] **High — Collect adequate Official data** · Wait for reviewed protocol, consent/retention,
      100-room minimums (prefer 300–500), sufficient groups/classes, and both conditions.
- [ ] **High — Manually review an approved artifact** · Compare baselines, calibration, subgroup
      variation, dominance/collapse risks, privacy, and exact compatibility before registry entry.
- [ ] **Deferred — v0.6 learned-selector experiment** · No control authority until a prospective
      experiment and deterministic fallback are separately approved.

## mvp-0.4: Research Mode & Data Foundation

- [x] **Critical — Generator-4 shared pool** · Keep behavior traits out of construction and give
      both experimental selectors identical validated candidates.
- [x] **Critical — Isolated Research Mode** · Add centralized run policies, separate persistence,
      session-local profiles, and balanced condition assignment.
- [x] **High — Pilot and feedback workflow** · Require opt-in, persist outcomes before feedback,
      restore pending answers, finalize exactly once, and preserve defeat records.
- [x] **High — Research data controls** · Validate schemas, summarize locally, export JSON/CSV, and
      confirm Pilot/session/all deletion without touching normal data.
- [x] **High — Analysis and diagnostics** · Add descriptive offline analysis, Preview provenance,
      production safety, and an explicit no-model state.
- [ ] **High — Pilot protocol review** · Run Pilot sessions and review wording, timing, missingness,
      storage/export workflow, and condition balance before Official collection.
- [ ] **Medium — Prospective Official collection plan** · Predefine inclusion rules, sample targets,
      participant/session grouping, and carryover analysis before interpreting outcomes.
- [ ] **Deferred — LearnedRoomSelector** · No training or deployment until privacy, data volume,
      grouped evaluation, and shadow-mode gates are approved.

## Checkpoint 3: Dungeon Topology & Run Pacing

- [x] **Critical — Reusable interactions, Fountain channel, collision, validation, and persistence**
- [x] **High — Seeded recovery selection, safe/risky placement, cooldown, and outcome records**
- [x] **High — Visual Effects, health/shield polish, and deterministic torches**
- [x] **High — History provenance filters and best-preserving clear confirmation**
- [x] **High — Production-excluded, preview-gated, in-memory Topology Lab**
- [ ] **Medium — Tune recovery ceilings and safe/risky weights from structured local playtests**
- [ ] **Medium — Expand the Lab with optional path overlays and manual candidate selection**

## Checkpoint 2: Dungeon Topology foundation

- [x] **Critical — Generator dispatcher and provenance** · Preserve generator-2 output and migrate generator-1 continuation explicitly.
- [x] **Critical — Layered topology** · Generate and validate real floor, outer-wall, internal-wall, and void layers.
- [x] **Critical — Directional transitions** · Place physical cardinal exits and persist chosen/opposite entrance directions.
- [x] **High — Candidate selection** · Target ten valid candidates, cap at twenty attempts, and store only compact decision evidence.
- [x] **High — Rules-2 adaptation** · Score topology from profile/preset/mode without making depth a difficulty multiplier.
- [x] **High — Placement safety** · Keep at least one Rune-free route and enforce topology-aware Rat placement.
- [x] **Medium — Inspection and history** · Add read-only topology diagnostics, ASCII maps, and mixed-provenance filters.
- [ ] **Deferred — Fountain gameplay and healing** · Not part of Checkpoint 2; requires a separately approved milestone.

Checkboxes are grouped by phase and priority. The matching task in [ROADMAP.md](ROADMAP.md) contains the full scope, rationale, affected areas, prerequisites, difficulty, backend requirement, and definition of done. Completion gates are repeated here so this file can be used during execution.

## Phase 1: Fix and stabilize

### Critical

- [ ] **P1.1 — Align the game model with the interface** · Hard · Backend: No · Prerequisite: room rules decided
  - Done when room data drives rendering and typed/testable transitions govern every action.
- [ ] **P1.2 — Implement honest baseline mechanics** · Hard · Backend: No · Prerequisite: P1.1
  - Done when collision, objective, health, combat, shield, hazard, treasure, failure, and retry behavior are real and tested.
- [ ] **P1.3 — Fix environment and package-manager consistency** · Easy · Backend: No · Prerequisite: package-manager choice
  - Done when a clean clone uses one documented tool and the documented backend env file controls port/origin.

### High

- [ ] **P1.4 — Validate local data and API contracts** · Medium · Backend: Shared contract work
  - Done when storage/network input is runtime-validated, versioned, and safely migrated or rejected.
- [ ] **P1.5 — Repair request lifecycle and feedback** · Medium · Backend: No
  - Done when requests cancel/timeout, submissions cannot duplicate, and fallback/error states are explicit.
- [ ] **P1.6 — Establish automated baseline tests** · Medium · Backend: No
  - Done when one root command tests game transitions, storage, routes, and existing API behavior.

### Medium

- [ ] **P1.7 — Normalize formatting and line endings** · Easy · Backend: No · Independent
  - Done when Prettier check passes and Windows line endings remain stable.

## Phase 2: Design, responsiveness, and accessibility

### Critical

- [ ] **P2.1 — Make dungeon state accessible** · Hard · Backend: No · Prerequisites: P1.1–P1.2
  - Done when keyboard and screen-reader users can perceive state and complete/fail a run independently.

### High

- [ ] **P2.2 — Complete settings or remove placeholders** · Medium · Backend: No
  - Done when every visible setting produces a persistent, verified effect.
- [ ] **P2.3 — Perform a formal accessibility pass** · Medium · Backend: No · Prerequisite: P2.1
  - Done when automated and manual checks have no critical violations across all routes and the full run.

### Medium

- [ ] **P2.4 — Refine responsive compositions** · Medium · Backend: No
  - Done when stressed content and real-device interactions show no clipping, overlap, or unreachable controls.
- [ ] **P2.5 — Add route metadata and visual polish** · Easy · Backend: No
  - Done when every route has appropriate metadata and all branded assets/states are local and consistent.

## Phase 3: Important frontend features

### Critical

- [ ] **P3.1 — Build deterministic adaptive and control generation** · Hard · Backend: No · Prerequisite: Phase 1 mechanics/events
  - Done when seeds reproduce rooms, profiles change only adaptive composition, and tests prove control isolation.

### High

- [ ] **P3.2 — Add an end-of-run interpretation report** · Medium · Backend: No · Prerequisite: P3.1
  - Done when recorded events visibly explain every changed weight without personality claims.

### Medium

- [ ] **P3.3 — Make characters mechanically distinct** · Medium · Backend: No · Prerequisite: P1.2
  - Done when each documented trait changes one balanced, tested mechanic.
- [ ] **P3.4 — Expand local history and run management** · Medium · Backend: No · Prerequisites: stable schema, P3.2
  - Done when validated runs can be inspected, compared, exported, imported, and individually deleted.

### Low

- [ ] **P3.5 — Add authored content packs and seeds** · Medium · Backend: No · Prerequisite: P3.1
  - Done when at least two packs share one schema and a copied seed reproduces the same local setup.

## Phase 4: Backend and database

### High

- [ ] **P4.1 — Introduce PostgreSQL and migrations** · Hard · Backend: Yes · Prerequisite: stable contracts
  - Done when migrations and repository integration tests create, read, and delete run data reproducibly.
- [ ] **P4.2 — Add durable anonymous run APIs** · Hard · Backend: Yes · Prerequisites: P4.1, shared contracts
  - Done when valid transitions persist transactionally, invalid transitions fail, and lists are paginated.
- [ ] **P4.4 — Add backend operational foundations** · Medium · Backend: Yes · Prerequisite: public backend scope
  - Done when config fails fast and request IDs, redacted logs, limits, headers, timeouts, and readiness are tested.

### Low

- [ ] **P4.3 — Implement real contact delivery if required** · Medium · Backend: Yes · Prerequisite: confirmed product need
  - Done when messages reach an approved destination with abuse controls and observable safe failure handling.

## Phase 5: Authentication, accounts, and saved data

### High

- [ ] **P5.1 — Select and integrate authentication** · Hard · Backend: Yes · Prerequisites: database, deployment/privacy decisions
  - Done when secure sessions work and authorization tests reject anonymous and cross-user access.
- [ ] **P5.2 — Add account-owned saves and local import** · Hard · Backend: Yes · Prerequisites: P5.1, P4.2
  - Done when ownership is enforced and local runs import explicitly without duplication.
- [ ] **P5.3 — Add profile, privacy, export, and deletion** · Hard · Backend: Yes · Prerequisites: P5.1–P5.2
  - Done when users can view, export, and delete all owned data through authorization-tested workflows.

### Low

- [ ] **P5.4 — Add admin tools for real moderation needs** · Hard · Backend: Yes · Prerequisite: defined roles/use cases
  - Done when every admin operation is server-authorized, least-privilege, and audit-logged.

## Phase 6: Testing, security, deployment, and maintenance

### High

- [ ] **P6.1 — Add CI quality and security gates** · Medium · Backend: No · Prerequisites: canonical package manager/tests
  - Done when required pull-request checks block format, lint, type, test, build, advisory, or secret failures.
- [ ] **P6.2 — Add end-to-end and accessibility regression coverage** · Hard · Backend: Partly · Prerequisite: stable flows
  - Done when critical flows and supported viewports pass reliably in CI with useful failure artifacts.
- [ ] **P6.4 — Add monitoring, privacy, backup, and incident practices** · Hard · Backend: Yes · Prerequisite: public stored data
  - Done when alerts are redacted/actionable and backup restores, retention, deletion, and incident ownership are tested.

### Medium

- [ ] **P6.3 — Deploy a production-like staging environment** · Hard · Backend: Yes for API · Prerequisite: approved platform/security baseline
  - Done when direct SPA routes, HTTPS, CORS, secrets, health checks, migrations, and rollback are verified.
- [ ] **P6.5 — Add performance budgets and maintenance cadence** · Medium · Backend: Partly · Prerequisite: CI/metrics
  - Done when agreed bundle/API budgets are enforced and runtime/dependency maintenance has an owner and schedule.

## Deferred ideas pending product answers

These are not approved backlog tasks yet:

- AI-generated prose or room layouts
- Public run sharing
- Leaderboards or achievements
- Multiplayer or real-time collaboration
- Billing/subscriptions
- Native mobile packaging
- A separate admin application

Promote an idea only after its user value, privacy impact, backend authority, failure behavior, and definition of done are documented.
