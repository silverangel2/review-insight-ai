-- Product review library: ReviewIntel's own accumulated review evidence.
-- One row per canonical product (marketplace:identifier). `corpus` holds the
-- accepted review records from ReviewIntel's own scans, consolidated over
-- time; later scans adjudicate fresh reviews together with this corpus.
-- Written and read only by the server (service role); shoppers never see
-- stored counts or this table.

create table if not exists public.product_review_library (
  id uuid primary key default gen_random_uuid(),
  product_key text not null unique,
  canonical_url text,
  product_name text,
  brand text,
  store text,
  aggregate_rating numeric,
  aggregate_count integer,
  corpus jsonb not null default '[]'::jsonb,
  review_count integer not null default 0,
  scan_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_review_library enable row level security;

drop policy if exists "Product review library service role access" on public.product_review_library;

create policy "Product review library service role access"
on public.product_review_library
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
