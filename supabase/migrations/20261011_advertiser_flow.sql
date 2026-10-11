-- ReviewIntel advertiser flow. MIGRATION FILE ONLY: NOT APPLIED by the app or this PR.
-- Apply manually (Supabase SQL editor) after review. Safe to re-run.
alter table if exists public.advertiser_applications
  add column if not exists source text default 'application',      -- 'application' | 'inquiry'
  add column if not exists budget_range text,
  add column if not exists inquiry_message text,
  add column if not exists stripe_session_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_link_sent_at timestamptz,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

alter table if exists public.sponsor_ads
  add column if not exists stripe_session_id text,
  add column if not exists paid_at timestamptz;

create index if not exists advertiser_applications_source_idx on public.advertiser_applications (source, created_at desc);
create index if not exists sponsor_ad_events_sponsor_idx on public.sponsor_ad_events (sponsor_id, event_type);
