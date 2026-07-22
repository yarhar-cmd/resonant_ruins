# Recommended Resonant Ruins architecture

## Implemented mvp-0.4 research boundaries

`generator-4` separates candidate construction from selection. A profile-independent generator
builds and validates a shared pool and stable pool ID. `RoomSelector` implementations receive that
immutable pool: `RuleBasedRoomSelector` accepts behavioral context, while `NeutralRoomSelector` has
a context type with no adaptive profile. Frozen generator-2 and generator-3 dispatch paths remain
unchanged.

`RunMode` and `RunExecutionPolicy` centralize persistence permission for normal, research, and
sandbox execution. Research uses `resonant-ruins:research:v1` and
`resonant-ruins:research-active-run:v1`; it cannot update normal active-run, permanent-profile,
History, or best-record boundaries. The research active envelope owns the room-start snapshot and
pending feedback so refresh cannot associate an answer with a later room.

Research contracts live in `types/research.ts`, Zod schemas in `research/schemas.ts`, storage in
`services/researchStorage.ts`, and pure assignment/summary/export/record logic in `research/`.
`CandidateScoringModel` is only a future interface: the current shadow status is unavailable, emits
no scores, and is not a player control. The backend is not part of gameplay or research recording.
With no explicit API base URL the frontend makes no network request.

See [Research Mode](RESEARCH_MODE.md), [neutral control](NEUTRAL_CONTROL.md), and
[future model plan](FUTURE_MODEL_PLAN.md).

## Architecture goal

Keep Resonant Ruins understandable as it grows: one frontend application, one API, one shared contract layer, and explicit boundaries around game rules, persistence, authentication, and external providers. The project does not need microservices, event streaming, GraphQL, a complex state library, or a plugin system at its current scale.

## Recommended near-term structure

```text
apps/
  frontend/
    src/
      app/
        App.tsx
        routes.tsx
        providers.tsx
      components/
        common/
        layout/
      features/
        dungeon/
          components/
          data/
          hooks/
          model/
          pages/
        characters/
        history/
        settings/
        contact/
      services/
        api/
        storage/
      styles/
      test/
  backend/
    src/
      config/
      middleware/
      modules/
        adventures/
          adventure.controller.ts
          adventure.repository.ts
          adventure.routes.ts
          adventure.schema.ts
          adventure.service.ts
        contact/
        health/
      providers/
      app.ts
      server.ts
packages/
  contracts/
    src/
      adventure.ts
      api.ts
docs/
```

This should be introduced incrementally. Moving every current file at once would create noise without improving behavior.

## Frontend boundaries

### App layer

The app layer should contain routing, top-level providers, error boundaries, document metadata, and global shell concerns. It should not contain dungeon rules.

### Feature folders

Group files by behavior once a feature has more than a page and one or two components. The dungeon is already large enough to become a feature folder. Characters, history, and settings can remain small until their behavior grows.

### Dungeon domain model

Represent a room as data rather than hard-coded CSS coordinates:

```ts
type TileKind = 'floor' | 'wall' | 'exit' | 'rune' | 'hazard' | 'enemy' | 'treasure';

interface RoomDefinition {
  id: string;
  width: number;
  height: number;
  tiles: Tile[];
  entities: Entity[];
  objectives: Objective[];
  narrative: SceneContent;
}
```

Keep state transitions in a reducer or pure state machine:

```text
SETUP → LOADING_ROOM → PLAYING → ROOM_COMPLETE → LOADING_ROOM
                                          ↘ RUN_COMPLETE
PLAYING → RUN_FAILED
```

Actions such as move, attack, shield, interact, choose narrative option, reset, and retry should produce explicit state changes and events. Pure transition functions can be unit-tested without rendering React.

### Adaptation engine

Start with a deterministic frontend/domain service, not AI. It should accept bounded events and return an explainable profile:

```text
events → metrics → adaptation profile → seeded room composer
```

Suggested initial metrics:

- completion duration
- damage taken
- attacks attempted/hit
- shield timing
- optional hazards entered
- treasure accepted/skipped
- direct vs alternate exit
- retry count

Suggested output weights:

- combat density
- hazard density
- puzzle density
- exploration branching
- reward risk
- pressure target

The same seed plus profile should produce the same room. This makes adaptive and control runs comparable and debuggable.

### Client persistence

Keep anonymous preferences, selected character, and a bounded recent-run cache in `localStorage`. Add:

- Zod schemas at the storage boundary
- a storage version number
- migrations for changed shapes
- safe fallbacks when data is corrupt
- explicit clear/export controls

Do not store access tokens, privileged roles, API secrets, or sensitive profile data in `localStorage`.

The current defeat archive is implemented at the frontend storage boundary in
`apps/frontend/src/services/runArchive.ts`. It stores one validated, versioned envelope containing
separate five-record histories and independent best-stat ownership for Warden, Seeker, and Ember.
The separate `activeRunStorage.ts` boundary persists one validated active or defeated run, including
health, elapsed active time, evaluation order and analytics, room position, facing, and stable run
statistics. It excludes held input, transition frames, focus, and temporary action feedback. Neither
active-run progression nor evaluation analytics are written to the completed-run archive.

### Current data-driven room progression

The Resonant Ruins evaluation sequence is defined under `apps/frontend/src/data/rooms`. Five room
definitions describe dimensions, explicit coordinate-based floor and wall sets, exits, spawn points,
and optional hazards. Pure helpers in `roomGeometry.ts` generate rectangular shells and validate
walkability, boundary crossings, and safe spawns without relying on CSS dimensions.

`roomProgression.ts` creates the fixed five-room Awakening order for every new run while accepting
valid legacy shuffled orders during restore. `gameplayState.ts` atomically commits a room
exit, destination spawn, rooms-cleared count, and evaluation timing record. `useRoomTransition.ts`
owns only the temporary 150 ms fade phases and input lock; the destination gameplay state is already
committed and persisted so a refresh cannot restore a half-transitioned source room. After the fifth
Awakening Chamber, the same run continues through deterministic generated Dungeon Rooms.

## Shared contracts

Create `packages/contracts` when the next API response is consumed by the UI. It should contain only serializable TypeScript types and Zod schemas shared by both apps. It must not import React, Express, database libraries, or provider SDKs.

Good shared candidates:

- `AdventureConfig`
- `AdventureSummary`
- `RunEvent`
- `RunSummary`
- API error envelope
- request/response schemas

This removes the current duplicate adventure configuration definitions and gives the API client typed responses.

## Backend boundaries

### Keep frontend-only for now

- anonymous setup state
- immediate movement and combat interactions
- deterministic room rendering
- accessibility preferences
- selected character
- optional recent-run cache
- explainable local adaptation calculations during prototype development

These features benefit from instant feedback and do not require trust or centralized persistence.

### Move to the backend when needed

- durable account-owned runs
- cross-device synchronization
- public/shareable adventures
- authoritative achievements or leaderboards
- contact delivery
- admin moderation
- usage limits
- AI/provider calls
- billing or entitlements

Anything requiring secrecy, authorization, global uniqueness, moderation, or trusted records belongs on the server.

### Module pattern

Each backend module should own its route, request schema, controller, service, and repository interface. Controllers should translate HTTP; services should implement use cases; repositories should isolate persistence. Avoid adding a generic repository abstraction until at least two real repositories need the same behavior.

### Environment configuration

Choose one backend environment location and validate it at startup. Recommended options:

1. Run the backend with `cwd=apps/backend` and keep `apps/backend/.env`, or
2. Use a root `.env` and document it as the single server configuration file.

Parse all values with a schema. Reject invalid ports, origins, missing production secrets, and unsupported environment names before listening.

## Database recommendation

Do not add a database until the run schema and save behavior are stable. When ready, PostgreSQL is the safest default because the data is relational and likely to need filtering, ownership, migrations, and transactional updates.

Recommended first tables:

- `users`
- `characters`
- `adventures`
- `runs`
- `run_events`
- `adaptation_profiles`
- `refresh_sessions` only if the chosen auth system requires them

Store generated room definitions and adaptation profiles as versioned JSON only where their shapes are naturally document-like. Keep ownership, status, timestamps, and searchable fields as normal columns.

Use migrations from the first database commit. Add a repository interface so unit tests can use an in-memory implementation without pretending the database does not exist.

## Authentication and accounts

Prefer a maintained authentication service or library that supports secure server-side sessions. Do not build password storage from scratch.

Recommended flow:

1. Add authentication only after anonymous runs are stable.
2. Keep anonymous play available.
3. Let a new account import local runs explicitly.
4. Use secure, HTTP-only, same-site cookies where the deployment topology allows it.
5. Enforce authorization in services/repositories, not only route components.
6. Add account data export and deletion before storing meaningful histories.

Frontend route guards improve UX but never replace backend authorization.

## API design

Keep REST for the current product. Suggested future resources:

```text
GET    /api/health
GET    /api/me
GET    /api/characters
GET    /api/runs
POST   /api/runs
GET    /api/runs/:runId
POST   /api/runs/:runId/events
POST   /api/runs/:runId/complete
DELETE /api/runs/:runId
POST   /api/contact
```

Use a consistent error envelope with a request ID, stable error code, user-safe message, and optional validation details. Add pagination before run lists can grow without bounds.

## AI integration

AI should be an optional backend provider behind an `AdventureGenerator` interface. Do not let provider output directly become executable rules or trusted database fields.

Pipeline:

1. Convert validated run signals into a bounded generation brief.
2. Request structured output.
3. Validate output against room/content schemas.
4. Apply deterministic rule validation: reachable exit, bounded enemies, legal coordinates, allowed content.
5. Fall back to authored templates on failure or timeout.
6. Record provider/model/schema version without storing secrets.

Rate limits, content moderation, cost caps, timeouts, retries, and redacted observability are prerequisites for public AI generation.

## Admin dashboard

Do not add an admin dashboard until there is real moderated or operational data. When required, build it as a protected route group or a small separate frontend only if deployment/security needs differ.

Potential capabilities:

- review flagged generated content
- inspect failed generations and schema violations
- manage authored templates
- view aggregate system health and usage
- suspend accounts or revoke shared content

Every admin action must be authorized on the backend and written to an audit log. Never infer admin access from a client-side flag.

## Testing architecture

Use a small testing pyramid:

- Pure unit tests for dungeon transitions, scoring, seeded generation, storage migration, and services
- React component/integration tests for setup, navigation, settings, history, error states, and accessibility semantics
- API integration tests for validation, CORS, errors, and future authorization
- A few end-to-end tests for the critical anonymous run and account save flows

Recommended tools are Vitest, React Testing Library, Supertest, and Playwright. Add them only as the corresponding test layer is introduced.

## Deployment shape

Initially deploy two artifacts:

- static Vite frontend with SPA fallback routing
- Node API process behind HTTPS

Use separate staging and production environments. Configure exact allowed origins, secure headers, request limits, health/readiness checks, structured logs, and a managed secret store. Add a managed PostgreSQL database only in the database phase.

## Decisions to avoid for now

- Microservices
- GraphQL
- Redux or another global state library before reducer/context boundaries prove insufficient
- WebSockets before real-time collaboration exists
- Kubernetes
- Event sourcing
- Custom authentication/password storage
- A separate admin application without real admin use cases
- AI-generated mechanics before deterministic rules are validated

## Current adaptive dungeon boundary

The local frontend now separates three persistence lifetimes:

- `playerProfileStorage.ts` owns the versioned experience preset, first-time status, shortcut unlock,
  long-term adaptive traits, and confidence metadata.
- `activeRunStorage.ts` owns volatile per-run signals, current-run/effective profiles, the run seed,
  poke cooldown, authored Chamber analytics, dungeon-only room count, player state, and the exact
  current generated-room snapshot. Schema version 8 stores generator provenance, cardinal entrance
  and chosen-exit directions, and a bounded five-record compact decision history. It stores only the
  selected full layout plus top-three feature summaries and aggregate rejection counts; rejected
  floor masks are never persisted.
- `runArchive.ts` owns completed records. Version 3 records store `experiencePreset`,
  `dungeonRoomsCleared`, game/adaptation/generator versions, and whether provenance is mixed. Legacy
  records migrate to explicit unknown values. Bests remain partitioned by character and preset.

Enemy Framework v0.2 is reducer-owned and frontend-authoritative. `config/combat.ts` centralizes
timing and awareness values; `enemySystem.ts` provides deterministic cardinal BFS, path distance,
escape-tile queries, stable move candidates, and generated quantity selection; `useEnemyClock.ts`
provides one shared real-time clock; and `types/enemies.ts` defines serializable Rat combat state.
The reducer sequence is idle/unaware → chasing → telegraphing → lunging → recovering → chasing.
Logical impact resolves once when entering lunge; CSS animation cannot deal damage. Stable Rat-ID
ordering and transient destination reservations prevent overlap/swaps and avoid reserving the
player's final current escape when static geometry offers at least two choices.

Active-run schema v6 stores exact current-room facing, awareness, target, outcome, recovery kind,
metrics, and remaining awareness/movement/telegraph/lunge/recovery deadlines. Schema v5 cooldowns
migrate to recovery. Pause shifts deadlines exactly; refresh reconstructs them. Physical held-input
and perfect-block input timestamps are deliberately not restored, so the shield resumes lowered.
Living Rats seal `enemies-defeated` exits, corpses become non-blocking immediately, and adaptation
affects generated Rat quantity only—not Rat stats, timing, awareness, or intelligence.

Generation remains frontend-only and deterministic behind a version dispatcher. The generator-2
implementation is retained as the frozen compatibility path. New runs use generator-3, which derives
candidate seeds from the run seed, room number, chosen exit, incoming entrance direction, profile,
preset, archetype, rules version, and generator version. It targets ten valid candidates within a
twenty-attempt ceiling, ranks typed feature vectors under rules-2, and uses a seeded 50/30/20 choice
among the top three. One or two candidates produce a deterministic reduced-diversity result; zero
valid candidates produces a known-safe fallback.

Generator-3 rooms separate reachable floor, floor-derived outer walls, internal walls, generic
versioned features, hazards, exits, and entity spawns. Its six archetypes are Open Arena, True L-Ruin,
Split Chamber, Pillar Hall, Ring Route, and Twin Chambers. Cardinal exits sit on the actual reachable
floor boundary rather than the room's bounding rectangle. Choosing north/south/east/west gives the
next room a south/north/west/east entrance through an explicit opposite-direction helper. Entrances
collapse after entry; the model does not add completed-room backtracking.

Rules-2 uses a stable long-term/current profile blend and bounded scoring influences. Exploration may
favor distinct directional options and optional routes; pace may favor a shorter direct option and
fewer choices. Poke deterministically contrasts one, occasionally two, traits by 25 percent toward
their inverse. Depth unlocks archetype vocabulary only and is not a difficulty multiplier. Rune
placement reserves a safe path, articulation points, spawn, and exits; Rat pathing uses all solid
topology and preserves the effective five-path-tile generated spawn minimum.

`VERSION_INFO` identifies new gameplay as `mvp-0.3`, generated rooms as `generator-3`, and adaptation
as `rules-2`; telemetry schema remains `1`. Existing generator-2 runs continue under generator-2.
Legacy generator-1 current rooms restore unchanged, with a recorded transition to generator-2 for
future rooms. This intentionally allows mixed-provenance archives without relabeling old layouts.
The generic feature layer includes solid Restoration Fountains and non-blocking deterministic
torches. `types/interactions.ts` defines the reusable contract; `utils/interactions.ts` owns
deterministic adjacent-facing discovery; and `gameplayState.ts` owns channel start, pause shifting,
cancellation, idempotent completion, one-HP restoration, and depleted runtime state.
`config/recovery.ts` and `recoverySelection.ts` own the bounded rule-based recovery selector. This
is deterministic adaptive rules logic, not machine learning.

Active-run schema v8 stores remaining channel duration rather than a wall-clock deadline, restores
only a still-valid channel, and migrates schema v7 with safe defaults. Fountain tiles use the
existing blocking-feature lookup, so player movement, Rat BFS, topology paths, body-lock analysis,
and sword collision share one physical rule. Full validation runs after placement.

The dungeon has two route boundaries. `/dungeon` uses the normal website shell and contains only
experience selection and run setup. `/dungeon/run` uses `GameShell` without the website header,
footer, narrative, or page padding. `DungeonRunPage` composes the view, and `useRunController` is the
single gameplay authority for reducer state, restoration, transitions, generation, adaptation,
persistence, archives, pause timing, and run navigation.

Pause is reducer-owned rather than a page boolean. Survival time subtracts accumulated and current
pause duration. Resume shifts absolute gameplay deadlines by the pause duration, and persistence
stores remaining durations so refresh and time spent in Settings or Main Menu cannot consume them.
Held keyboard/pointer input is cleared when the shared gameplay input gate closes.

Development-only inspection reuses `DebugTools.tsx` inside the right-side `DebugDrawer`, behind
`import.meta.env.DEV`. It displays raw signals, long-term/current/effective traits, generation inputs
and reasons, validation state, poke cooldown, active/archive byte sizes, retained snapshots,
current-room visited tiles, summarized-room count, schema versions, and centralized build metadata.
Its advance and override controls use the same normal reducer/generation paths. It also contains
current-room enemy controls and the isolated Awakening editor. `apps/frontend/src/config/version.ts`
is the typed source of truth for game, generator, adaptation-rules, and future telemetry-schema
versions; persisted storage-envelope versions remain owned by their storage modules because they
govern migrations.
`import.meta.env.DEV` removes the Debug boundary from production, and the post-build
production-safety scanner verifies emitted JavaScript and CSS.

Topology Lab gating follows the same compile-time boundary. Local `vite serve` enables the Lab;
Vercel Preview requires exact preview metadata plus `VITE_ENABLE_TOPOLOGY_LAB=true`; production
builds eliminate the lazy route and navigation. The Lab holds room mutations in component memory
and imports no normal persistence writer, providing one sandbox boundary rather than scattered
gameplay conditionals. User Visual Effects settings remain the only shared mutable preference.

Preview diagnostics are deliberately separate from `DebugTools`. `config/buildEnvironment.ts`
requires both Vercel's exact `VERCEL_ENV=preview` marker and the exact public flag
`VITE_ENABLE_PLAYTEST_DIAGNOSTICS=true`; `vite.config.ts` converts that decision into the only flag
read by application code. `DungeonRunPage` then lazy-loads the read-only
`PlaytestDiagnostics.tsx` drawer. Its pure selector reads reducer-owned room, player, Rat, timer,
and combat-counter state without running pathfinding or creating a second gameplay state. The
normal production bundle eliminates the diagnostic import and identifying UI assets, while a
preview safety scan requires the panel and still forbids full Debug Tools, editor features, and
mutation controls.

The active record, settings, profile, and completed archive are parsed and recovered independently.
A malformed area resets only that area. A valid preset may be salvaged from a malformed profile,
but adaptive traits and shortcut unlocks return to safe defaults. Invalid player positions are
repaired to the nearest safe spawn; malformed room geometry is rejected. Storage write failures do
not stop the in-memory run and show a rate-limited warning that refresh may lose progress.

The deterministic generator validator checks terrain bounds and duplicates, directional boundary
openings, exit structure and spacing, spawn safety, hazard separation, connected floors, complete
perimeter walls, and hazard-free spawn-to-exit paths. Unit tests cover 5,000 varied deterministic
seeds. The root Playwright configuration adds a Chromium-only smoke suite for start, pause/refresh,
Main Menu resume, restart, defeat/archive, maximum room layout, and stored-position repair.
