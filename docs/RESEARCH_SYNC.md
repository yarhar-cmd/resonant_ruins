# Research collection synchronization

Research synchronization is local-first and researcher-controlled. Gameplay and ratings are written
to the existing browser research store first. Nothing uploads during gameplay. A researcher may
later open `/research/review`, enter the collection key, and explicitly upload a schema-valid
complete or explicitly incomplete session. Upload failure, rejection, and conflict never delete or
rewrite local evidence.

## Architecture

Vercel serves the Vite frontend and two Node serverless functions. This repository's Express backend
is not known to be connected to Production, so synchronization is implemented only in the Vercel API
layer:

- `POST /api/research/sessions` accepts one normalized `ResearchSession`.
- `GET /api/research/export` returns a canonical multi-session `ResearchExport`.
- PostgreSQL is accessed through `DATABASE_URL` with the small `pg` driver.
- The existing Zod research schema validates uploads and server exports.

Do not create a parallel Express implementation unless deployment architecture is deliberately
changed in a later milestone.

## Setup

Create a standard PostgreSQL database, then run `migrations/001_research_sessions.sql` with the
provider's SQL console or `psql`:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_research_sessions.sql
```

Configure these server-only variables in Vercel for the intended environment:

- `DATABASE_URL`: managed PostgreSQL connection string.
- `RESEARCH_UPLOAD_KEY`: collection key entered in `/research/review`.
- `RESEARCH_ADMIN_TOKEN`: separate export token entered in `/research/analysis`.

Never prefix either token with `VITE_`. The browser holds entered secrets in React memory only; they
are not written to localStorage, canonical evidence, or exports. Rotate either token in the hosting
dashboard and redeploy if it may have been disclosed.

## Idempotency and privacy

The server validates a session, recursively sorts object keys, serializes canonical JSON, and hashes
it with SHA-256. The research session ID is the identity:

- A new ID is inserted and returns `saved`.
- An existing ID with the same canonical hash returns `identical_duplicate`.
- An existing ID with a different hash returns HTTP 409 and `conflict`; the first record remains.

The JSONB payload retains the complete validated evidence. Search columns contain pseudonymous
research metadata only. No participant account is created, and names, email addresses, IP
enrichment, advertising identifiers, and device fingerprints are not collected. Sync state is
separate local metadata under `resonant-ruins:research-sync:v1`.

## Cross-device analysis and backup

In the Analysis Lab, enter the admin token and choose **Import from research server**. Returned
sessions are labeled with a `research-server-...json` source and enter the same schema-validation,
deduplication, and conflict pipeline as files. Imported copies stay in tab memory. Clearing the Lab
does not touch live research storage, and this milestone has no remote deletion route.

Retain local session JSON exports as a backup and periodically back up the PostgreSQL database using
the provider's encrypted snapshot/export feature. Test restores into a non-Production database.

## Deployment protection

Project-level protection was not inspectable without Vercel credentials. To keep Production public
and Preview protected: open the Vercel project, go to **Settings → Deployment Protection**, configure
protection for **Preview** deployments, and ensure **Production** does not require Vercel
Authentication or a protection bypass. Save, then verify both a signed-out Production request and a
signed-out Preview request. The API is publicly reachable at the network layer when Production is
public, but both routes still require their respective runtime secrets.
