create table if not exists research_sessions (
  id bigserial primary key,
  research_session_id text not null unique,
  participant_code text,
  participant_sequence integer,
  pilot boolean not null,
  protocol_id text,
  completion_status text not null check (completion_status in ('active', 'complete', 'incomplete')),
  selected_preset text,
  game_version text,
  research_schema_version text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  uploaded_at timestamptz not null default now(),
  last_attempted_at timestamptz not null default now(),
  identical_retry_count integer not null default 0,
  payload_sha256 char(64) not null,
  source_device_label text,
  payload_json jsonb not null
);

create index if not exists research_sessions_uploaded_at_idx on research_sessions (uploaded_at);
create index if not exists research_sessions_cohort_idx
  on research_sessions (pilot, completion_status, protocol_id, game_version);
