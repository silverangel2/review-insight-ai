-- Scan rescue queue: when a scan ends with no verdict (insufficient review
-- evidence), the flag hook records a row here. The owner reviews the queue,
-- researches the product personally, pastes the reviews they found through
-- the admin rescue page, and the rescore + one service email closes the
-- loop with the customer. Server-only access (service role).

create table if not exists public.scan_rescue_queue (
  id uuid primary key default gen_random_uuid(),
  scan_ref text not null unique,
  account_email text,
  product_key text,
  product_name text,
  product_url text,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'rescued', 'emailed', 'closed')),
  verdict text,
  buying_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rescued_at timestamptz,
  emailed_at timestamptz,
  -- Guest opt-in for the rescue verdict (verdict-purpose consent only).
  consent_source text,
  subscribed_at timestamptz
);

create index if not exists scan_rescue_queue_status_idx
  on public.scan_rescue_queue (status, created_at desc);

alter table public.scan_rescue_queue enable row level security;

drop policy if exists "Scan rescue queue service role access" on public.scan_rescue_queue;
create policy "Scan rescue queue service role access"
on public.scan_rescue_queue
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
