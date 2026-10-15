-- First-party community reviews: shoppers write product reviews on
-- ReviewIntel itself. One row per account per product (unique
-- (account_email, product_key)). Moderated via status
-- (pending/approved/hidden). Approved + purchase-verified reviews are
-- eligible to feed the product library corpus; everything else stays
-- display-only ("community experiences"). Server-only access
-- (service role); shoppers never see emails or this table directly.
--
-- community_review_asks records the one-time "write a review?" email per
-- account per product so a shopper is never asked twice.

create table if not exists public.community_reviews (
  id uuid primary key default gen_random_uuid(),
  account_email text not null,
  product_key text not null,
  product_name text,
  product_url text,
  stars integer not null check (stars between 1 and 5),
  body text not null,
  store text,
  bought_it boolean not null default false,
  verified_purchase boolean not null default false,
  proof_sha256 text,
  proof_ocr_confidence integer,
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_reviews_one_per_account_per_product unique (account_email, product_key)
);

create index if not exists community_reviews_product_idx
  on public.community_reviews (product_key, status, created_at desc);

create table if not exists public.community_review_asks (
  id uuid primary key default gen_random_uuid(),
  account_email text not null,
  product_key text not null,
  analysis_id text,
  asked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint community_review_asks_one_per_account_per_product unique (account_email, product_key)
);

create index if not exists community_review_asks_email_idx
  on public.community_review_asks (account_email);

alter table public.community_reviews enable row level security;
alter table public.community_review_asks enable row level security;

drop policy if exists "Community reviews service role access" on public.community_reviews;
create policy "Community reviews service role access"
on public.community_reviews
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Community review asks service role access" on public.community_review_asks;
create policy "Community review asks service role access"
on public.community_review_asks
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
