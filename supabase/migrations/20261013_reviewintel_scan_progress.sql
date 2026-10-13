-- Live scan progress shared across serverless instances. Service role only.
-- Not applied by the app; deploy this migration separately.

create table if not exists public.reviewintel_scan_progress (
  scan_id text primary key,
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.reviewintel_scan_progress enable row level security;
revoke all on table public.reviewintel_scan_progress from public, anon, authenticated;
grant all on table public.reviewintel_scan_progress to service_role;
