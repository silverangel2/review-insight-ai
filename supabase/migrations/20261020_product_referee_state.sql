-- Make-Sense Referee state: the last verdict the Referee allowed to
-- print for a product, so the next scan's flip gate (duty D3: no flip
-- without a reason) can compare against it. One row per product key
-- (the review library's canonical key when known, else the scan's
-- stable product key). Written and read only by the server (service
-- role); shoppers never see it. The code is fail-soft: until this
-- migration is applied, the Referee simply has no stored state and
-- falls back to the stored-corpus verdict.

create table if not exists public.product_referee_state (
  product_key text primary key,
  verdict text not null,
  score numeric,
  corpus_fingerprint text,
  unique_opinions integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.product_referee_state enable row level security;

drop policy if exists "Product referee state service role access" on public.product_referee_state;

create policy "Product referee state service role access"
on public.product_referee_state
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
