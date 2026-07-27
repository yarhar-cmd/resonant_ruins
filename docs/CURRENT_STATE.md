# Resonant Ruins current state

## Local Research Analysis Lab

Researchers can now open `/research/analysis` outside an active fixed Pilot and combine one or more
validated `research-1` JSON exports without uploading or changing live browser research storage.
The Lab deduplicates identical durable IDs, excludes and reports conflicting evidence, defaults to
Official complete sessions, calculates participant-level and paired descriptive outcomes, displays
accessible charts with tables, reports data-quality warnings, and downloads stable formula-safe
analysis artifacts. It does not run significance tests or alter gameplay, generation, research
collection, reward, model, profile, History, or persistence behavior. See
[Research analysis](RESEARCH_ANALYSIS.md).

## mvp-0.5 visual, audio, and information-hierarchy polish

The current polish layer strengthens the dark ancient-ruins identity with readable stone floors,
heavier walls, flat void, warm decorative torches, restrained transitions, and clearer silhouettes
for the Warden, shield, Rats, Runes, Fountain, Cache, and exits. Full, Reduced, and Off effects modes
remain distinct, and reduced-motion/high-contrast preferences preserve essential non-color cues.

A centralized procedural Web Audio system now provides conservative Master, Effects, Ambience, and
Mute controls; quiet dungeon ambience; limited and varied footsteps; gameplay, Rat, interaction,
transition, and UI cues; lazy autoplay-safe activation; and category voice limiting. It has no
network or asset dependency and no path to mutate gameplay, research, rewards, generation, or model
state.

Player-facing information is simplified through a five-item primary navigation, compact Home and
HUD layouts, a numbered Research flow, grouped Settings, and collapsed technical detail. Local and
Preview-only Topology and Model tools are grouped under Labs and keep their existing Production
gates. No route or underlying feature was removed. See [Visual style](VISUAL_STYLE.md),
[Audio system](AUDIO_SYSTEM.md), and [Accessibility](ACCESSIBILITY.md).

## mvp-0.5 Resonance Cache reward foundation

The implemented `rewards-1` layer runs after generator-4 candidate construction, active Rules or
Neutral selection, and optional shadow scoring. It evaluates only the final selected room. A
validated optional-route opportunity is required before a deterministic 35% eligible-room roll;
authored Awakening Chambers, safe fallbacks, frozen pre-generator-4 continuations, and restored old
rooms are not retrofitted. At most one Cache is added, and complete room validation is rerun with
the Cache treated as a solid feature.

The ruined stone coffer uses the generic E interaction system. It requires a reachable adjacent
tile and correct facing, channels for 400 ms, shares the Fountain living-alerted-Rat combat lock,
and awards exactly one run-local Resonance once. Movement, turning, attack, shield, damage, alert,
defeat, transition, restart, or invalid state cancels the channel; pause and valid refresh preserve
remaining time. Opened Caches remain visible and solid. Active save v9 and run archive v4 migrate
older records to zero/unknown reward state without inventing Cache activity.

Resonance is score-only: it does not affect health, combat, generation, profiles, selectors,
adaptation, or model scoring. Normal runs write History and preset-partitioned Best Resonance;
Research keeps its value and reward telemetry inside isolated research storage; sandbox overrides
remain memory-only. Research records stay on `research-1` through optional backward-compatible
fields, and CSV export now has 104 stable columns. See [Reward system](REWARD_SYSTEM.md) and
[Resonance Cache](RESONANCE_CACHE.md).

## mvp-0.5 baseline learned-selector foundation

The repository now contains an offline, privacy-reduced multinomial logistic pipeline without
granting a model gameplay control. `model-features-1` defines 31 semantic features and fixed one-hot
vocabularies shared by TypeScript preparation/live inference and Python training. Preparation uses
recorded pre-room `profileBefore`, derives only prior ratings, groups by participant/session through
discarded opaque labels, fingerprints canonical data, excludes Pilot by default, and enforces
centralized Official thresholds.

The pinned local Python package compares grouped baselines and three logistic variants, emits
aggregate evaluation plus strict `model-artifact-1`, and refuses silent overwrite/promotion. Zod-
validated TypeScript inference matches committed parity fixtures and returns typed failures. The
only artifact is a synthetic development fixture; no Official model is approved.

Research shadow scoring runs after active selection and cannot change pool/selection/RNG/content.
Compact optional `shadow-1` evidence attaches the observed rating after feedback, while the feedback
dialog remains prediction-blind. `/model-lab` compares Rules/Neutral/Model locally or in an exact
flagged Preview; its imports and development selection stay in memory. Exact in-memory candidates
may run only under the write-disabled counterfactual sandbox. Production excludes the Lab and
fixture. See the model documents linked from the README.

## mvp-0.4 research foundation

New runs use deterministic `generator-4`. It constructs one profile-independent validated room
pool and then delegates selection to either the rules-based adaptive selector or a neutral
procedural selector. The two selectors share pool identity, feature vectors, Fountain opportunity,
and all safety validation; only the adaptive selector consumes the five behavior traits.

The `/research` flow is opt-in and browser-local. It supports Pilot and Official sessions,
deterministic balanced two-run condition assignment, an isolated session profile and active run,
generated-room-only feedback, exactly-once room records, descriptive summaries, confirmed deletion,
and validated JSON/CSV export. Pilot records are excluded by default. No data is uploaded and no
learned model is installed. See [Research Mode](RESEARCH_MODE.md).

Generated-room defeat now persists the same required-difficulty/optional-fairness-and-enjoyment
feedback flow without inventing an exit. Room duration uses the pause-aware run clock, terminal
shield segments and activation counts are recorded, and successful storage-pressure writes advance
with a separate warning. Legacy defeat-not-requested records remain readable.

Frontend API health now remains `not-configured` without an explicit `VITE_API_BASE_URL`; it does
not silently request localhost. Frozen generator-2 and generator-3 continuations remain supported.

Updated: 2026-07-23

## Current implementation update: Dungeon Topology & Healing foundation v0.3

New runs now use deterministic `generator-3` rooms and `rules-2` selection. The generator produces
six topology archetypes (Open Arena, True L-Ruin, Split Chamber, Pillar Hall, Ring Route, and Twin
Chambers), real irregular floor boundaries, separate outer/internal wall layers, and one to three
cardinal exits placed on reachable physical boundaries. Choosing an exit records its direction and
normally gives the next room the opposite entrance direction; completed rooms remain unavailable.

Generation targets ten valid candidates within twenty attempts. Valid layouts are scored from a
versioned feature vector, and a seeded 50/30/20 roll selects among the top three. With one or two
valid candidates, selection remains deterministic and is marked reduced-diversity; only zero valid
candidates triggers the safe fallback. Normal persistence stores the selected full layout, compact
top-three summaries, aggregate rejection counts, directional decisions, and bounded provenance—not
full rejected masks.

Existing `generator-2` runs remain generator-2. A restored `generator-1` room is preserved exactly,
then future generation transitions explicitly to generator-2. Run History identifies mixed
generator provenance.

Checkpoint 3 adds a reusable KeyE interaction contract and reducer-owned channel state. Restoration
Fountains are optional, single-use, solid features that restore exactly one HP after a 700 ms
channel when the player is adjacent, facing the feature, below maximum health, and no living Rat is
alerted. Movement, turn-away, attack, shield, damage, Rat alert, defeat, transition, or invalid state
cancels; pause preserves remaining time. Awakening Chamber 3 contains the authored introduction.

Generated recovery uses a deterministic bounded multi-signal selector, safe/risky placement scoring,
and a two-generated-room cooldown. Depth unlocks content but does not alter recovery probability.
Active-run schema v8 migrates v7 saves and stores Fountain runtime/channel state. History has
character, experience, game-version, and generator-version filters plus an accessible recent-History
clear operation that preserves bests and unrelated local data. Visual Effects offers Full, Reduced,
and Off. Local development and explicitly enabled Vercel Preview builds include an isolated in-memory
Topology Lab; production does not.

## Current implementation update: Rat Combat & Kiting v0.2

Resonant Ruins now has a reducer-owned, deterministic Rat combat loop: unaware Rats alert by path distance, chase with stable cardinal BFS, lock a tile for a 600 ms telegraph, resolve damage exactly once at visual-lunge entry, and recover after every outcome. The player can bait, dodge, directional-block, perfect-block by a last-window raise or turn, and counterattack during recovery. Stable destination reservations prevent Rat overlap/swaps and avoid an otherwise preventable final-escape body lock without protecting genuine dead ends.

Rat facing, awareness, target, lunge/recovery outcome, and remaining deadlines restore through active-run schema v6. Held physical shield input is intentionally cleared on pause/refresh. New deterministic rooms use `generator-2` after the minimum Rat spawn distance changed to 4 path tiles; saved rooms retain the generator version that created them. Development-only Combat Debug exposes bounded playtest counters and is rejected from production bundles by the safety scan.

At the mvp-0.2 checkpoint, boundaries remained intentionally narrow: no new enemies, rewards,
healing, upgrades, backend gameplay authority, database, accounts, research telemetry, machine
learning, audio, or mobile controls were added. Later implementation updates are documented above.
See [Enemy Framework v0.2](ENEMY_FRAMEWORK.md) and
[Balance changelog](BALANCE_CHANGELOG.md).

## Historical audit: executive assessment

The remainder of this section is the original repository audit snapshot. Its implementation-gap
claims are retained for traceability and are superseded by the milestone updates above.

Mirrorvault is a coherent, attractive local prototype rather than a finished adaptive game or production web service. Its strongest qualities are the distinct visual identity, clear separation between frontend and backend, strict TypeScript configuration, centralized API and storage boundaries, usable responsive layouts, and honest labeling of mock content. Its biggest gap is behavioral: the interface describes an adaptive dungeon, but most game signals, combat rules, hazards, rewards, health, character traits, and room generation are still decorative or disconnected from state.

The safest next milestone is to stabilize the prototype's contracts and make one complete six-room run internally consistent before adding accounts, databases, or AI generation.

## Stack and tooling

### Frontend

- React 19 and React DOM
- TypeScript with strict mode, unused-local checks, and project references
- Vite 7
- React Router 7
- Four global CSS files organized by theme, global rules, components, and pages
- Browser `localStorage` for character choice, settings, and completed runs

### Backend

- Node.js and TypeScript
- Express 5
- Zod request validation
- CORS restricted to one configured frontend origin
- Morgan request logging
- dotenv for environment variables
- In-memory/static mock services; no database

### Workspace and quality tools

- Root npm workspaces plus a pnpm workspace/lockfile
- ESLint flat configuration with TypeScript and React Hooks rules
- Prettier configuration
- Git repository on `main`, tracking `origin/main`

## Repository structure

```text
apps/
  frontend/
    public/                  # Present but empty
    src/
      assets/                # Empty fonts/icons/images placeholders
      components/
        common/              # Buttons, panel, loading/error/empty states
        layout/              # Shell, header, footer, nav, logo, page container
        mirrorvault/         # Setup form, grid, status, story panel
      context/               # Character/settings provider
      hooks/                 # Context access and API health check
      pages/                 # Eight routed pages
      routes/                # Route table
      services/              # API, mock generation, localStorage
      styles/                # Theme, global, component, and page CSS
      types/                 # Frontend domain contracts
  backend/
    src/
      config/                # Environment parsing
      controllers/           # Health, adventure, contact HTTP handlers
      middleware/            # Validation, 404, centralized errors
      routes/                # API route definitions
      services/              # Static adventure and contact behavior
      types/                 # Backend adventure contracts
      utils/                 # HttpError
docs/                        # Architecture and future-development guidance
```

There are no tests, CI workflows, deployment definitions, database schemas, migrations, authentication modules, or shared frontend/backend contract package.

## Pages and user flows

| Route         | Current purpose                                                                     | Status                                     |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `/`           | Branded landing page, experiment summary, visual dungeon preview, adaptation method | Working                                    |
| `/dungeon`    | Intake, mode selection, six mock scenes, movement controls, run completion          | Partly functional                          |
| `/characters` | Select one of three local characters                                                | Working, but traits/health are not applied |
| `/history`    | Read and clear locally saved completed runs                                         | Working with unvalidated stored data       |
| `/about`      | Explain observe/interpret/recompose model and prototype boundaries                  | Working                                    |
| `/settings`   | Persist sound, reduced-motion, and high-contrast preferences                        | Partly functional; sound is a placeholder  |
| `/contact`    | Validate a local contact form through Express                                       | Working as a non-persistent demo           |
| `*`           | Branded client-side 404                                                             | Working                                    |

### Primary run flow

1. Choose a character.
2. Open the dungeon and select experience, challenge, playstyle, and generation mode.
3. Begin a run; the frontend makes a best-effort mock API request and loads a local scene.
4. Move a token around a static grid or press attack; these actions do not affect room completion.
5. Choose one story option to advance to the next room.
6. After the sixth story choice, save a run summary to `localStorage`.
7. Review or clear the summary on `/history`.

## What is working well

- All declared routes and the custom 404 rendered successfully during the audit.
- No horizontal overflow was detected at approximately 375px, 768px, or 1440px widths.
- Desktop and mobile navigation switch at the expected breakpoint.
- The mobile dungeon grid and story panel fit within the viewport.
- The browser console produced no warnings or errors during route and dungeon-start checks.
- `npm run lint` equivalent passes with zero warnings.
- Strict TypeScript checks pass for both apps.
- The production build passes: approximately 253.3 kB JavaScript (80.9 kB gzip) and 19.6 kB CSS (4.8 kB gzip).
- The API health, adventure listing, valid adventure creation, invalid adventure rejection, API 404, and CORS preflight work.
- The production dependency audit reported no known vulnerabilities on the audit date.
- Zod validation, a small JSON body limit, centralized API errors, CORS, and disabled `x-powered-by` provide a sensible local baseline.
- Secrets were not found by filename or common high-confidence secret patterns. Only blank `.env.example` templates are present.
- `.gitignore` covers real environment files, credentials, keys, dependencies, builds, caches, logs, editor files, and OS files.
- Mock and non-persistent behavior is labeled honestly in the UI.

## Functional gaps and bugs

### High-impact behavior gaps

1. **The dungeon is not actually adaptive.** Later adaptive scenes only append a sentence using the intake values. Enemy, hazard, puzzle, and reward placement never changes.
2. **“Completely random” is not random.** It cycles through the same three authored scenes and static grid as adaptive mode.
3. **Grid play and story progression are disconnected.** Moving to the exit/rune, colliding with hazards, opening treasure, attacking enemies, and shielding have no effect. Story buttons alone advance the run.
4. **Combat and health are placeholders.** Attack only appends the word `Attacked` to an internal array. Shield is inert. Health is always displayed as five, and the selected character's `health` value is unused.
5. **Advertised signals are not measured.** Completion time, damage, retries, alternate exits, blocks, and treasure risk are described but never recorded.
6. **Character traits are descriptive only.** No character changes movement, visibility, cooldowns, health, or scene logic.

### State and data fragility

- `localStorage` values are cast to TypeScript types without runtime validation or migration. Malformed or old data can produce invalid settings/history state.
- Saved run decisions are stored but not shown on the history page.
- Story choice IDs are passed through the component boundary but ignored by the page.
- The adventure-list API client method and backend list endpoint are not used by any page.
- Adventure creation responses are ignored; failures are silently swallowed, so “API linked” does not mean a run is using backend data.
- The API client has no timeout, cancellation, retry policy, or structured error type.
- `useApiHealth` creates an `AbortController` but never passes its signal to `fetch`, so unmount cleanup does not cancel the request.

### Environment configuration bug

The root development script starts `apps/backend/src/server.ts` while the process working directory remains the repository root. `dotenv/config` therefore looks for a root `.env`, while the documented backend template lives at `apps/backend/.env.example`. Copying that template to `apps/backend/.env` may not affect the root development command. Environment loading needs one explicit, documented location.

### UI and accessibility gaps

- The dungeon uses `role="application"` while hiding every tile from assistive technology. There is no announced player position, entity description, room change, damage, or action result.
- Shield advertises the Shift key but has no click or keyboard behavior.
- WASD handling recognizes lowercase keys only.
- Room transitions do not move focus or announce the newly loaded chamber.
- The API status is not an ARIA live region.
- Contact submission has no disabled/pending button state and can be submitted repeatedly.
- Contact fields lack `autocomplete` hints.
- The ambient-sound setting is persisted but intentionally does nothing.
- High contrast changes only a few tokens and has not been contrast-tested as a complete mode.
- Several small interactive controls are close to, rather than consistently at or above, a 44px touch target.

### Organization and maintainability gaps

- Frontend and backend independently define overlapping adventure contracts, creating drift risk.
- `DungeonPage.tsx` owns setup, loading, progression, movement, API calls, local persistence, and completion. A reducer or domain hook would make transitions testable.
- Static room coordinates live inside the rendering component rather than a room model.
- `pages.css` and parts of the page markup are densely formatted and difficult to review.
- Empty asset and utility directories imply planned structure but provide no current value.
- Route metadata, page titles, and descriptions are not route-specific.
- No error boundary protects the React tree from unexpected runtime failures.

## Technical health results

| Check                       | Result  | Notes                                                    |
| --------------------------- | ------- | -------------------------------------------------------- |
| ESLint                      | Pass    | Zero warnings/errors                                     |
| TypeScript                  | Pass    | Frontend and backend strict checks                       |
| Production build            | Pass    | One eagerly loaded JS bundle; acceptable at current size |
| Prettier check              | Fail    | 18 files reported formatting differences                 |
| Production dependency audit | Pass    | No known vulnerabilities on 2026-07-14                   |
| Browser console             | Pass    | No warnings/errors during audited flows                  |
| Routes                      | Pass    | Seven named routes plus 404 rendered                     |
| Responsive overflow         | Pass    | None at audited 375/768/1440 widths                      |
| Automated tests             | Missing | No unit, integration, component, or end-to-end tests     |
| CI                          | Missing | No automated pull-request/build gate                     |
| Secrets                     | Pass    | No high-confidence matches; examples only                |

## Dependencies and performance

All declared production dependencies are used. The current bundle is small enough that route-level code splitting is optional, not urgent. There are no remote images, web fonts, analytics scripts, or large media assets. The largest performance concern is future growth: all routes are eagerly imported, and there is no performance budget or bundle report in CI.

Package-management guidance is inconsistent: the repository has npm workspaces, a pnpm lockfile/workspace file, and README commands that use npm. Choose one canonical package manager, declare it with `packageManager` and `engines`, and keep only the matching install instructions and lockfile strategy.

## Security posture

The current local prototype has a reasonable baseline for non-sensitive mock data. It should not be considered production-ready because it has no authentication, authorization, rate limiting, security headers, durable audit trail, request IDs, production secret management, abuse controls, or privacy workflow. These are not urgent until the API stores data or is exposed publicly, but they become prerequisites before accounts, contact delivery, or AI generation.

## Assumptions

- Mirrorvault is intended first as a portfolio-quality interactive prototype and later as a replayable adaptive dungeon product.
- The initial audience is players, design reviewers, and potential collaborators rather than paying customers.
- “Adaptive” should eventually mean deterministic, explainable changes derived from measurable play events.
- Local-first play should remain possible even after accounts and cloud saves are added.
- The current dark green, parchment, oxidized red, and brass identity should be preserved.
- The Express API is intended to become a real application boundary rather than be removed.

## Product questions to answer

1. Is the near-term goal a polished portfolio demo, a research experiment, or a commercial game?
2. Should grid actions determine room completion, or should story choices remain the primary mechanic?
3. Which behaviors should adaptation measure, and how should players see or challenge the resulting profile?
4. Must adaptive and random modes be reproducible from a seed for fair comparison?
5. What constitutes success, failure, damage, retry, and completion in a room?
6. Should characters materially change mechanics or remain narrative presets?
7. Which data should remain device-local after accounts exist?
8. Are runs private by default, shareable by link, or eligible for public leaderboards?
9. Is contact feedback an actual product requirement or only a local API demonstration?
10. Will AI generate prose, layouts, encounters, or all three—and what authored fallback is required?
11. What age rating and content boundaries should generated adventures follow?
12. Which deployment target and expected traffic level should guide backend choices?
