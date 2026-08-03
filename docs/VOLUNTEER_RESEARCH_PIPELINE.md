# Volunteer research pipeline v1

The volunteer flow is local-first. A participant claims a unique study code at `/join`, completes the existing session and exit questionnaire, and the browser then submits the immutable local session. Submission creates a `pending_review` record; submission is not approval. Only approved Official evidence is returned by `/api/research/model-dataset` by default.

No participant account, name, email, advertising identifier, IP enrichment, or device fingerprint is collected. Do not promise anonymity or institutional approval. Upload credentials are stored separately from research evidence and are never included in JSON/CSV exports.

## Supabase PostgreSQL setup

1. Create a Supabase project and run `migrations/001_research_sessions.sql`, then `migrations/002_volunteer_research_pipeline.sql` in order. Store applied migration hashes in the deployment record.
2. For Vercel serverless functions, use Supabase's pooled transaction-mode PostgreSQL connection string as `DATABASE_URL`; use the direct connection only for migrations and administrative backup tools. Confirm current Supabase connection guidance for the chosen project/region.
3. Generate a high-entropy `RESEARCH_ADMIN_TOKEN` in a password manager. Set `DATABASE_URL` and `RESEARCH_ADMIN_TOKEN` as server-only Vercel variables. Never prefix either with `VITE_` and never commit `.env` files. There is no global participant upload key.
4. Use different databases or credentials for Preview and Production. Keep Preview protected. Before recruitment, Production must be public; do not disable account-level deployment protection automatically. `/research/admin` remains guarded by its runtime token, which is an operational shared secret rather than account authentication.
5. Apply migrations to Preview first, run synthetic evidence tests, then apply to Production during a recorded maintenance window. A rollback may drop the new tables only before real submissions exist. After collection begins, back up and use a forward migration; never drop immutable evidence to roll back application code.

## Operations

Back up with `pg_dump --format=custom` using a restricted administrative connection, encrypt the artifact, verify restore into a disposable database, and record its retention location. Also export approved model datasets with their audit manifests. These approved exports—not unrestricted raw table queries—are the canonical future model-training input.

Rotate the admin token in the password manager and both Vercel environments, then invalidate the old value. Rotate database credentials in Supabase and immediately update Vercel. Redeploy and test `/api/research/access/codes`, claim, upload, moderation, and approved export using synthetic data. Access codes and upload tokens are individually hashed, so database listings and logs never reveal plaintext.

The access-code lifecycle is `active → reserved → consumed`, with optional `revoked` or `expired`. Claim uses a row lock; upload binds the hashed opaque token to the reserved session. A client-generated recovery secret is separately hashed, allowing only the same session to rotate an upload token if the original claim response is lost. Validation and insertion occur before consumption in one transaction. Identical retries succeed; conflicting payloads never overwrite evidence.

The server uses bounded `pg` pools and only unnamed parameterized statements (`pool.query(text, values)`). Do not add a query `name`: named prepared statements are session-scoped and incompatible with Supabase Transaction Pooler mode.
