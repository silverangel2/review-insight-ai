create table if not exists public.site_traffic_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  event_type text not null default 'page_view',
  path text,
  url text,
  title text,

  referrer text,
  referrer_host text,

  visitor_key text,
  account_role text,
  account_plan text,

  country text,
  region text,
  city text,

  device_type text,
  platform text,
  browser text,
  user_agent text,

  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,

  affiliate_source text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.site_traffic_events
  add column if not exists event_type text default 'page_view',
  add column if not exists path text,
  add column if not exists url text,
  add column if not exists title text,
  add column if not exists referrer text,
  add column if not exists referrer_host text,
  add column if not exists visitor_key text,
  add column if not exists account_role text,
  add column if not exists account_plan text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists device_type text,
  add column if not exists platform text,
  add column if not exists browser text,
  add column if not exists user_agent text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists affiliate_source text,
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists idx_site_traffic_events_created_at
  on public.site_traffic_events(created_at desc);

create index if not exists idx_site_traffic_events_event_type
  on public.site_traffic_events(event_type);

create index if not exists idx_site_traffic_events_path
  on public.site_traffic_events(path);

create index if not exists idx_site_traffic_events_visitor_key
  on public.site_traffic_events(visitor_key);

create index if not exists idx_site_traffic_events_referrer_host
  on public.site_traffic_events(referrer_host);
