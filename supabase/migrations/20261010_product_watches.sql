-- ReviewIntel "Watch this product" alerts.
-- NOT APPLIED by the app or by this PR. Review, then apply manually. The feature also stays
-- off until REVIEWINTEL_WATCH_ALERTS=on is set, so shipping the code without this table is safe.

create table if not exists public.product_watches (
  id uuid primary key default gen_random_uuid(),
  profile_email text not null,
  listing_url text not null,
  product_key text not null,
  product_name text,
  brand text,
  model text,
  last_verdict text,
  last_accepted_count integer not null default 0,
  last_result_hash text,
  last_checked_at timestamptz,
  last_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  unique (profile_email, product_key)
);

create index if not exists product_watches_active_idx
  on public.product_watches (product_key) where unsubscribed_at is null;

alter table public.product_watches enable row level security;
revoke all on public.product_watches from anon, authenticated;
