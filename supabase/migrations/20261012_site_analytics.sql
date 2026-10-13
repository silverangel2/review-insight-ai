-- ReviewIntel first-party site analytics (2026-10-12)
-- FILE ONLY (NOT APPLIED by this PR): apply through the normal Supabase migration process; never run against prod from a dev box.
-- Reuses public.site_traffic_events (created in 20260703 / 20260704). Safe to re-run.
-- Privacy: no raw IPs or raw user agents are stored. visitor_key is a salted HMAC.
-- New event types written by the app: sign_in, sign_up (server-only), plus the existing
-- page_view, affiliate_click, upsell_view, checkout_start, etc. Visitors sending
-- Do Not Track (DNT: 1) or Global Privacy Control (Sec-GPC: 1) are never recorded.

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

-- Dashboard queries filter by event type and date range.
create index if not exists idx_site_traffic_events_type_created
  on public.site_traffic_events (event_type, created_at desc);

-- Existing rows are never rewritten here. Stored user_agent values are kept exactly as they are
-- (the Owner decides separately whether to age them out); this file only adds missing pieces.

-- Row level security: only the server (service role) reads or writes analytics.
-- No anon/authenticated policies are created, so the public API cannot read or insert rows.
alter table public.site_traffic_events enable row level security;
revoke all on public.site_traffic_events from anon, authenticated;

comment on table public.site_traffic_events is
  'First-party analytics: page views, sign-ins, signups, upsell/checkout and affiliate events. Salted visitor hash only; no raw IP. user_agent values already stored are retained unchanged. Service role access only (RLS on, no public policies).';
