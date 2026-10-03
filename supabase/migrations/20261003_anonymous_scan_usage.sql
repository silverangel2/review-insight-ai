-- Anonymous shopper scan allowance (3 free scans without sign-in).
-- Keyed by HMAC-SHA256 hash of the visitor IP (never stores raw IPs).
-- Counts are lifetime per IP hash, not per day.

create table if not exists public.anonymous_scan_usage (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null unique,
  scan_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_scan_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.anonymous_scan_usage enable row level security;

drop policy if exists "Anonymous scan usage service role access" on public.anonymous_scan_usage;

create policy "Anonymous scan usage service role access"
on public.anonymous_scan_usage
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
