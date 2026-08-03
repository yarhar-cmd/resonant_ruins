alter table research_sessions add column if not exists data_quality_warnings jsonb not null default '[]'::jsonb;

create table if not exists research_access_codes (
  id bigserial primary key,
  code_hash char(64) not null unique,
  participant_code text not null,
  participant_sequence integer not null check (participant_sequence > 0),
  study_mode text not null check (study_mode in ('pilot','official')),
  status text not null default 'active' check (status in ('active','reserved','consumed','revoked','expired')),
  expires_at timestamptz,
  reserved_session_id text,
  claim_recovery_hash char(64),
  upload_token_hash char(64) unique,
  reserved_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by_label text,
  internal_note text
);
create index if not exists research_access_codes_status_idx on research_access_codes(status,expires_at);

create table if not exists research_session_reviews (
  research_session_id text primary key references research_sessions(research_session_id),
  review_status text not null check (review_status in ('pending_review','approved','quarantined','rejected')),
  model_eligible boolean not null default false,
  reason_code text,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (not model_eligible or review_status='approved')
);
create table if not exists research_review_comments (
  id uuid primary key,
  research_session_id text not null references research_sessions(research_session_id),
  category text not null,
  comment_text text not null,
  researcher_label text,
  created_at timestamptz not null default now()
);
create table if not exists research_room_reviews (
  research_session_id text not null references research_sessions(research_session_id),
  room_decision_id text not null,
  status text not null check(status in ('accepted','needs_review','excluded_technical')),
  reason_code text,
  note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(research_session_id,room_decision_id)
);
create table if not exists research_review_events (
  id bigserial primary key,
  research_session_id text not null references research_sessions(research_session_id),
  event_type text not null,
  event_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Raw payload immutability is enforced in PostgreSQL, not merely by UI convention.
create or replace function prevent_research_payload_update() returns trigger language plpgsql as $$
begin
  if new.payload_json is distinct from old.payload_json or new.payload_sha256 is distinct from old.payload_sha256 then
    raise exception 'research evidence is immutable';
  end if;
  return new;
end $$;
drop trigger if exists research_sessions_immutable_payload on research_sessions;
create trigger research_sessions_immutable_payload before update on research_sessions
for each row execute function prevent_research_payload_update();
