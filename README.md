# Resonant Ruins Local

Resonant Ruins Local is an editable, local-first adaptive dungeon prototype. It preserves the original dark-vault atmosphere while observing five authored Awakening Chambers and deterministically generating an endless sequence of later Dungeon Rooms.

This repository is intentionally a functional prototype. Story scenes and adaptations are labeled mock content. It does not call an AI provider, require an API key, create user accounts, or use a database.

## Planning and architecture

- [Current repository assessment](docs/CURRENT_STATE.md)
- [Development plan and immediate milestone](docs/DEVELOPMENT_PLAN.md)
- [Phased feature roadmap](docs/ROADMAP.md)
- [Recommended architecture](docs/ARCHITECTURE.md)
- [Prioritized checkbox backlog](docs/BACKLOG.md)
- [Enemy Framework v0.2](docs/ENEMY_FRAMEWORK.md)
- [Balance changelog](docs/BALANCE_CHANGELOG.md)
- [Research Mode](docs/RESEARCH_MODE.md)
- [Research schema](docs/RESEARCH_DATA_SCHEMA.md) and [CSV dictionary](docs/RESEARCH_DATA_DICTIONARY.md)
- [Neutral control](docs/NEUTRAL_CONTROL.md), [local and offline analysis](docs/RESEARCH_ANALYSIS.md), and [privacy](docs/RESEARCH_PRIVACY.md)
- [Future learned-selector plan](docs/FUTURE_MODEL_PLAN.md)
- [Model data preparation](docs/MODEL_DATA_PREPARATION.md), [feature schema](docs/MODEL_FEATURE_SCHEMA.md), and [training](docs/MODEL_TRAINING.md)
- [Model evaluation](docs/MODEL_EVALUATION.md), [artifact](docs/MODEL_ARTIFACT.md), and [TypeScript inference](docs/MODEL_INFERENCE.md)
- [Shadow mode](docs/MODEL_SHADOW_MODE.md), [Model Lab](docs/MODEL_COMPARISON_LAB.md), and [model privacy](docs/MODEL_PRIVACY.md)
- [Reward system](docs/REWARD_SYSTEM.md) and [Resonance Cache](docs/RESONANCE_CACHE.md)
- [Earlier future-backend notes](docs/future-backend-plan.md)

## Technology

- React 19, TypeScript, Vite, and React Router for the frontend
- Node.js, Express, TypeScript, Zod validation, CORS, and Morgan for the backend
- npm workspaces for running both apps from one root
- ESLint and Prettier for code quality
- browser `localStorage` for selected character, preferences, experience preset, adaptive profile,
  shortcut unlock, a validated active run snapshot, and preset-partitioned run records and bests
- Playwright for a small Chromium-only critical-flow suite

## Folder structure

```text
mirrorvault-local/
├── apps/
│   ├── frontend/
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── assets/        # Future local images, icons, and fonts
│   │   │   ├── components/    # Common, layout, and domain components
│   │   │   ├── context/       # Shared character and settings state
│   │   │   ├── hooks/         # Context and API-health hooks
│   │   │   ├── pages/         # Route-level screens
│   │   │   ├── routes/        # React Router map
│   │   │   ├── services/      # API, mock-adventure, and storage boundaries
│   │   │   ├── styles/        # Theme, global, component, and page CSS
│   │   │   ├── types/         # Shared frontend domain types
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── .env.example
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── backend/
│       ├── src/
│       │   ├── config/        # Environment configuration
│       │   ├── controllers/   # HTTP response handlers
│       │   ├── middleware/    # Validation, 404, and error handling
│       │   ├── routes/        # Express route definitions
│       │   ├── services/      # Mock adventure and contact logic
│       │   ├── types/         # Backend domain types
│       │   ├── utils/         # Reusable HTTP error
│       │   ├── app.ts
│       │   └── server.ts
│       ├── .env.example
│       └── package.json
├── docs/
│   ├── architecture.md
│   └── future-backend-plan.md
├── AGENTS.md
├── eslint.config.js
├── package.json
└── README.md
```

## Software required

Install a current Node.js LTS release, which includes npm. On Windows, confirm installation in PowerShell:

```powershell
node --version
npm --version
```

## Install and start

From the repository root:

```powershell
npm install
npm run dev
```

Open **http://localhost:5173**. The local API runs at **http://localhost:3001**, and its health endpoint is **http://localhost:3001/api/health**.

The root development command starts both processes. Press `Ctrl+C` in that PowerShell window to stop them. If Windows asks whether to terminate a batch job, type `Y` and press Enter.

Run only one side when needed:

```powershell
npm run dev:frontend
npm run dev:backend
```

## Routes

- `/` — the original landing experience and methodology
- `/dungeon` — first-time experience choice and minimal run setup
- `/dungeon/run` — dedicated full-viewport Awakening Chamber and generated-room gameplay
- `/characters` — local character selection
- `/history` — completed browser-local runs
- `/about` — adaptation explanation and prototype boundaries
- `/settings` — local accessibility and presentation preferences
- `/research` — opt-in Pilot/Official browser-local research sessions, summaries, and exports
- `/research/run` — isolated research gameplay and generated-room feedback
- `/model-lab` — local/flagged-Preview-only model comparison and in-memory imports
- `/model-lab/sandbox` — memory-only counterfactual candidate play; absent from production
- `/contact` — locally validated test form
- every unmatched URL — custom 404 chamber

React Router owns client-side navigation. To add a page, create a component in `apps/frontend/src/pages`, then add its route in `apps/frontend/src/routes/AppRoutes.tsx`. Add a navigation link only when the route should be globally visible.

## Components and state

Layout components define the shell, header, footer, desktop links, and mobile links. Common components define panels, buttons, and feedback states. The existing `components/mirrorvault` folder holds domain-specific controls such as the intake form, dungeon grid, story choices, and run status; its internal name remains unchanged for now to avoid a broad rename.

To add a component, create a focused `.tsx` file under the best matching component folder. Accept data and callbacks as props, keep page-specific state in the page, and move shared state into context or a dedicated hook only when multiple routes need it.

The `AdventureProvider` shares the selected character, settings, and versioned local player profile.
`DungeonEntryPage` owns setup and creates the initial saved run. `DungeonRunPage` renders the
dedicated game shell, while `useRunController` owns the single live gameplay reducer, generation,
transitions, pause/resume actions, persistence, archive effects, and run navigation. Validated
snapshots allow active, defeated, and paused runs to survive refresh without counting closed-tab or
paused time.

The first run uses `Experience Choice → Run Setup → Delve`. Returning runs begin at Run Setup,
while Restart Run immediately reuses the current preset and settings. Authored room IDs remain
`evaluation-room-*` internally for migration safety, but their player-facing labels are Awakening
Chambers. Completing all five unlocks Chamber 1's persistent generated-dungeon shortcut.

New runs use a fixed five-Chamber order. Chambers 4 and 5 contain ordered authored Rat spawns, with
the first one, two, or three enabled by experience preset. Rats begin unaware, alert by path
distance, chase with deterministic BFS/reservations, lock a tile for a readable telegraph, lunge
visually, and recover after every hit, miss, or block. Hold Shift to raise a directional shield;
raising it or turning it correctly during the final 125 ms before impact produces a perfect block
and longer Rat recovery. See [Enemy Framework v0.2](docs/ENEMY_FRAMEWORK.md) for constants and rules.

Generated rooms are derived from a run seed, room number, chosen exit, incoming entrance direction,
preset, shared recovery context, archetype, and generator version. New runs use
`generator-4`/`rules-2`, which builds one profile-independent validated candidate pool before a
selector ranks it. Normal play and the adaptive research condition use the deterministic
rules-based selector; the neutral research condition uses the same pool without behavioral traits.
Actual floor masks, internal walls, cardinal boundary exits, safe paths, red-rune hazards, Rat
spawns, and Fountain opportunities are validated as one layered room model. Frozen generator-2 and
generator-3 runs retain their existing implementations and provenance.

Generator-3 may also place one optional solid Restoration Fountain. A bounded, seeded recovery
calculation combines current health deficit, recent generated-room damage, damage streak, recovery
drought, recent combat pressure, preset, and profile signals; room depth is not a probability input.
Face an available Fountain and press E (or its visible Interact button) to channel for 700 ms and
restore exactly one HP. Generated Fountains impose a two-room spawn cooldown, remain visible when
depleted, and participate in player, Rat, attack, path, and safe-route validation. Awakening Chamber
3 contains the authored introduction and does not affect generated cooldown.

New generator-4 rooms then pass through the deterministic `rewards-1` post-selection layer. The
layer runs only after the active selector and shadow observer are finished, examines only the
selected room, and never changes candidate pools, selector evidence, model inputs, topology,
Fountains, Rats, Runes, or exits. A room must first contain a validated optional-route placement;
eligible rooms receive a seeded 35% spawn roll and can contain at most one solid Resonance Cache.
Face the ruined stone coffer and press E (or Interact) to channel for 400 ms and collect exactly one
run-local Resonance. Opened Caches remain visible and solid. Resonance is score-only in mvp-0.5,
persists for the run, and appears in the HUD, Pause, Game Over, Runs, and Best Resonance records.
Research uses the identical condition- and profile-independent reward process in both conditions.

The active-run record stores the exact selected current-room snapshot, compact top-three candidate
summaries, bounded decision history, chosen exit direction, and generator provenance. Refreshes do
not regenerate the current room. Existing `generator-2` runs continue under generator-2; legacy
`generator-1` rooms remain intact and explicitly transition to generator-2 for future rooms. See
[Generator 3 topology](docs/GENERATOR_3.md) and [architecture](docs/architecture.md).

## Frontend and backend communication

All HTTP calls go through `apps/frontend/src/services/api.ts`. It reads:

```text
VITE_API_BASE_URL=http://localhost:3001
```

Copy `apps/frontend/.env.example` to `.env` only if you need to change the value. Do not commit `.env` files.

The frontend makes no request when `VITE_API_BASE_URL` is absent or blank and labels the experience
local-only/API-not-configured. When the variable is explicitly configured, the unobtrusive status
indicator calls only `GET /api/health`. Gameplay and research recording remain
frontend-authoritative, and research records are never included in that health request.

## Mock generation and localStorage

`mockAdventureService.ts` returns deterministic example scenes. The first three are assessment rooms. Rooms four through six add an adaptation sentence based on the selected mode, challenge, and playstyle. The service interface is deliberately separate from UI code so a future API implementation can replace it.

The browser stores only prototype data under these keys:

- `mirrorvault:character`
- `mirrorvault:settings`
- `mirrorvault:player-profile:v1`
- `mirrorvault:run-archive:v1` (version 4 envelope)
- `mirrorvault:active-run:v1`
- `resonant-ruins:research:v1` (opt-in research sessions and generated-room records)
- `resonant-ruins:research-active-run:v1` (resumable research run and pending feedback)

Development builds may also use `mirrorvault:awakening-editor-drafts:v1`. It is isolated from normal
gameplay storage and absent from production output.

Local development exposes an in-memory Topology Lab at `/topology-lab`. A Vercel Preview includes it
only when `VERCEL_ENV=preview` and `VITE_ENABLE_TOPOLOGY_LAB=true`; normal production builds exclude
the route, navigation, and mutation controls. The Lab does not call normal active-run, profile,
History, best-record, recovery, or research persistence. No research records are written.

Local development also exposes the Model Comparison Lab at `/model-lab`. Preview builds require
both `VERCEL_ENV=preview` and `VITE_ENABLE_MODEL_LAB=true`; production excludes the route, fixture,
imports, and counterfactual controls. Imported artifacts/ResearchExports, explicit development-model
selection, and generated sandbox candidates stay in memory. Official Research has no approved model
installed; the synthetic fixture can be selected only for Pilot testing in a Lab-enabled build.

The active-run record contains the run ID, character, health, elapsed active time, room order,
current room and tile, facing, stable statistics, Awakening analytics, authoritative pause state,
and remaining invulnerability, pending-rune, and attack-cooldown durations. Temporary held input,
fade, visual feedback, and focus state remain excluded. Active-run Pause-menu navigation to Settings
or Main Menu preserves the record; Game Over Main Menu intentionally clears it. Restart replaces it.
The v8 active-run schema also keeps exact Rat facing, awareness, combat state, locked target,
outcome, recovery kind, and remaining enemy deadlines for the current room only. Physically held
keyboard/pointer input is intentionally cleared on pause or refresh so the shield resumes lowered.
Schema v8 adds generated-recovery cooldown, Fountain unused/depleted state, and remaining interaction
channel time; schema-v7 saves migrate with safe defaults.
It keeps exact visited tiles only for the current room, five detailed recent
room snapshots, and a fixed-size numeric summary for older rooms. The completed archive keeps five
recent defeats per character plus fixed-size best statistics. Clear site data in browser settings to
reset everything.

## API routes and adding another route

- `GET /api/health`
- `GET /api/adventures`
- `POST /api/adventures`
- `POST /api/contact`

To add an endpoint:

1. Put domain work in `apps/backend/src/services`.
2. Add an HTTP handler in `controllers`.
3. Add a route in `routes`, with a Zod schema for incoming data.
4. Mount the router in `routes/index.ts`.
5. Add the corresponding centralized frontend method to `services/api.ts` when the UI needs it.

## Future integrations

A real adventure model should be called from a backend service, never directly from React. Authentication middleware would sit before protected API routes. Database repositories would live behind services so controllers do not depend on a specific database. See [docs/future-backend-plan.md](docs/future-backend-plan.md) for a staged plan.

Environment variables belong in app-specific `.env` files and are documented in each `.env.example`. Variables beginning with `VITE_` are visible to browser code and must never contain secrets.

## Vercel preview diagnostics

Normal production builds exclude both the full local Debug Tools and the read-only Playtest
Diagnostics. To enable the safe diagnostics panel for pull-request previews, open the Vercel
dashboard and use this exact path:

1. Open **Project Settings**.
2. Open **Environment Variables**.
3. Add `VITE_ENABLE_PLAYTEST_DIAGNOSTICS=true`.
4. Select **Preview** only; do not select **Production**.
5. Redeploy the pull-request preview.

The Vite build includes the panel only when Vercel also supplies `VERCEL_ENV=preview` and the public
feature flag is exactly `true`. Hostnames, query strings, local development, malformed values, and
production builds cannot enable it. This variable is public build configuration and must not contain
secrets.

## Quality commands

```powershell
npm run test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
npm run verify:production-safety
npm run analyze:research -- path\to\export.json
npm run prepare:model-data -- path\to\exports --output model-data\private\prepared.json
npm run test:model-training
npm run verify:model-parity
npm run verify:model-safety
npm run format
```

The current presentation layer is documented in [Visual style](docs/VISUAL_STYLE.md),
[Audio system](docs/AUDIO_SYSTEM.md), [Audio assets](docs/AUDIO_ASSETS.md),
[Accessibility](docs/ACCESSIBILITY.md), and the [manual polish checklist](docs/POLISH_CHECKLIST.md).
Gameplay one-shots use a compact, documented local CC0 OGG library; only the quiet dungeon room
tone and torch-like crackle remain procedurally synthesized. No external media host or runtime
audio service is used. Normal navigation prioritizes Home, Play, Research, History, and Settings,
while Preview/local Topology and Model tools are grouped under Labs and remain excluded from
Production.

Offline model training uses the ignored `.venv-model` environment and the pinned requirements in
`tools/model_training/requirements.txt`. See [model training](docs/MODEL_TRAINING.md) before using
`train:model`, `evaluate:model`, or `inspect:model`; no command uploads data or auto-promotes an
artifact.

To verify the separately built preview artifact, run
`node scripts/verify-production-bundle.mjs --mode=preview --dir=apps/frontend/dist-preview`.

The end-to-end suite uses the installed Chrome channel as its Chromium runtime. To use Playwright's
bundled Chromium instead, remove `channel: 'chrome'` from `playwright.config.ts` and install it with
`npx playwright install chromium`.
Parallel worktrees can avoid an already-running development server by setting a different
`PLAYWRIGHT_PORT`, for example
`$env:PLAYWRIGHT_PORT='5174'; npm run test:e2e`.

The production frontend output is under `apps/frontend/dist`; compiled backend output is under `apps/backend/dist`.

## Windows troubleshooting

- **`npm` is not recognized:** install Node.js LTS, close PowerShell, and open a new PowerShell window.
- **Port 5173 or 3001 is already in use:** stop the earlier development process with `Ctrl+C`, or locate it with `Get-NetTCPConnection -LocalPort 5173,3001`.
- **PowerShell blocks scripts:** run npm through `npm.cmd`, or review your user execution policy with your administrator.
- **The API indicator says demo-only:** make sure `npm run dev` is still running and open the health URL directly.
- **A stale page appears:** use `Ctrl+F5` to refresh Vite's client, then restart `npm run dev` if necessary.
- **Dependencies behave unexpectedly:** delete `node_modules` and `package-lock.json` only when you intentionally want a clean reinstall, then run `npm install` again.

## Current boundaries

No screenshots or image files were supplied with the build brief, so the accessible hosted Mirrorvault page was used as the visual reference. The dungeon tiles and symbols are recreated with CSS instead of copied proprietary assets. Contact submissions are validated and discarded; adventure responses are mock data.
