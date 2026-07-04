create table if not exists public.site_traffic_events (
  id uuid primary key default gen_random_uuid(),
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
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists site_traffic_events_created_idx on public.site_traffic_events(created_at desc);
create index if not exists site_traffic_events_type_created_idx on public.site_traffic_events(event_type, created_at desc);
create index if not exists site_traffic_events_path_created_idx on public.site_traffic_events(path, created_at desc);
create index if not exists site_traffic_events_visitor_idx on public.site_traffic_events(visitor_key);
create index if not exists site_traffic_events_country_idx on public.site_traffic_events(country);
create index if not exists site_traffic_events_referrer_idx on public.site_traffic_events(referrer_host);
create index if not exists site_traffic_events_campaign_idx on public.site_traffic_events(utm_source, utm_campaign);
create index if not exists site_traffic_events_metadata_gin_idx on public.site_traffic_events using gin(metadata);

alter table public.site_traffic_events enable row level security;
