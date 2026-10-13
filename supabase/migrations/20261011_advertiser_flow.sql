-- ReviewIntel advertiser flow. MIGRATION FILE ONLY: NOT APPLIED by the app or this PR.
-- Apply manually (Supabase SQL editor) after review. Additive only and safe to re-run:
-- no drops of data, no table rewrites, no backfills of existing rows.
--
-- Reconciled 2026-10-12 against the production schema (read-only check):
--   * public.sponsor_ad_events did NOT exist, so the old last line (create index ... on
--     sponsor_ad_events) would have failed. The table is now created here first (same shape as
--     db/schema.sql). The app already degrades to "no stats" while it is missing.
--   * advertiser_applications / sponsor_ads were missing the package/payment/schedule columns
--     that db/schema.sql adds; they are added here with IF NOT EXISTS.
--   * advertiser_applications.website_url was NOT NULL, which made inquiries without a website
--     fail to save. Dropping NOT NULL loosens a constraint only; no row changes.
--   * One sponsor ad per application (partial unique index) so repeated approvals cannot create
--     duplicate ads. Production has 0 sponsor_ads rows, so the index cannot conflict.

alter table if exists public.advertiser_applications
  add column if not exists source text default 'application',      -- 'application' | 'inquiry'
  add column if not exists budget_range text,
  add column if not exists inquiry_message text,
  add column if not exists headline text,
  add column if not exists creative_url text,
  add column if not exists media_type text not null default 'image',
  add column if not exists package_id text not null default 'sponsored_monthly',
  add column if not exists package_name text,
  add column if not exists package_price text,
  add column if not exists daily_impression_cap integer not null default 1000,
  add column if not exists duration_days integer not null default 30,
  add column if not exists payment_reference text,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists reviewed_at timestamptz,
  add column if not exists stripe_session_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_link_sent_at timestamptz,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

alter table if exists public.advertiser_applications alter column website_url drop not null;

alter table if exists public.sponsor_ads
  add column if not exists creative_url text,
  add column if not exists media_type text not null default 'image',
  add column if not exists package_id text not null default 'sponsored_monthly',
  add column if not exists package_name text,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists daily_impression_cap integer,
  add column if not exists duration_days integer not null default 30,
  add column if not exists stripe_session_id text,
  add column if not exists paid_at timestamptz;

create table if not exists public.sponsor_ad_events (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid references public.sponsor_ads(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'click')),
  placement text,
  path text,
  occurred_at timestamptz not null default now(),
  user_agent text,
  created_at timestamptz not null default now()
);

-- Server (service role) only, like the other ReviewIntel tables.
alter table public.sponsor_ad_events enable row level security;
revoke all on public.sponsor_ad_events from anon, authenticated;

create index if not exists advertiser_applications_source_idx on public.advertiser_applications (source, created_at desc);
create index if not exists sponsor_ad_events_sponsor_idx on public.sponsor_ad_events (sponsor_id, event_type);
create index if not exists sponsor_ad_events_sponsor_day_idx on public.sponsor_ad_events (sponsor_id, event_type, created_at);
create unique index if not exists sponsor_ads_one_per_application_idx on public.sponsor_ads (application_id) where application_id is not null;
