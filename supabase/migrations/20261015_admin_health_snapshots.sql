-- App Health snapshots: one row per UTC day with the day's key metrics and
-- computed data-integrity alerts. Written only by the server-side daily cron
-- (/api/cron/health-snapshot) via the service role; read by the admin health
-- page (/admin/health). Shoppers never see this table.

create table if not exists public.admin_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  metrics jsonb not null default '{}'::jsonb,
  alerts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_health_snapshots enable row level security;

drop policy if exists "Admin health snapshots service role access" on public.admin_health_snapshots;

create policy "Admin health snapshots service role access"
on public.admin_health_snapshots
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists admin_health_snapshots_date_idx
  on public.admin_health_snapshots (snapshot_date desc);
