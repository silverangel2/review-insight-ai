-- ReviewIntel autobot ops ledger (Piece A of the RI bot-family build).
--
-- Append-only job / attempt / evidence tables for the RI ops worker
-- (app/api/cron/ri-ops-worker, every 15 min). The worker claims QUEUED
-- jobs, runs real read-only checks, and writes attempts + evidence back
-- so the admin Operations / Daily-Check-Center view shows real statuses.
-- Level-3 jobs get preparation-only rows and are NEVER executed.
--
-- NOT APPLIED by the app or by this change. Review, then apply manually
-- in the Supabase SQL editor. Until applied, the worker returns 200 with
-- a skipped status (fail-soft) instead of crashing.

create table if not exists public.ri_ops_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null default 'ops_sweep',
  level integer not null default 1 check (level between 1 and 4),
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
  payload jsonb not null default '{}'::jsonb,
  result_summary text,
  claimed_by text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists ri_ops_jobs_queued_idx
  on public.ri_ops_jobs (created_at) where status = 'QUEUED';
create index if not exists ri_ops_jobs_type_idx
  on public.ri_ops_jobs (job_type, status);

create table if not exists public.ri_ops_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ri_ops_jobs (id) on delete cascade,
  attempt_number integer not null default 1,
  status text not null default 'RUNNING',
  checks_total integer not null default 0,
  checks_passed integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists ri_ops_attempts_job_idx
  on public.ri_ops_attempts (job_id, started_at desc);

create table if not exists public.ri_ops_evidence (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ri_ops_jobs (id) on delete cascade,
  attempt_id uuid not null references public.ri_ops_attempts (id) on delete cascade,
  check_id text not null,
  label text not null,
  status text not null default 'info'
    check (status in ('pass', 'warning', 'fail', 'info')),
  message text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ri_ops_evidence_job_idx
  on public.ri_ops_evidence (job_id, created_at desc);
create index if not exists ri_ops_evidence_attempt_idx
  on public.ri_ops_evidence (attempt_id);

-- Server-only access (service role); the admin UI reads through server routes.
alter table public.ri_ops_jobs enable row level security;
alter table public.ri_ops_attempts enable row level security;
alter table public.ri_ops_evidence enable row level security;

revoke all on public.ri_ops_jobs from anon, authenticated;
revoke all on public.ri_ops_attempts from anon, authenticated;
revoke all on public.ri_ops_evidence from anon, authenticated;
