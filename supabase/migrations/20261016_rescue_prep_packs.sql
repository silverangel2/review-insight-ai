-- Rescue prep packs: the Rescue Prep bot's one-page research pack per
-- pending scan_rescue_queue item. Advisory only — the queue item itself is
-- never touched by the pack (no status change, no auto-rescue, no emails).
-- Idempotent: safe to apply more than once.
--
-- OWNER ACTION (Junel): paste this file's contents into the Supabase SQL
-- editor and run it once. Until applied, rescue-prep code runs normally
-- and simply reports "storage not provisioned" on the fail-soft path —
-- nothing breaks.

create table if not exists public.rescue_prep_packs (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.scan_rescue_queue(id) on delete cascade,
  scan_ref text not null,
  product_key text,
  pack jsonb not null,
  created_at timestamptz not null default now(),
  constraint rescue_prep_packs_queue_unique unique (queue_id)
);

create index if not exists rescue_prep_packs_queue_id_idx
  on public.rescue_prep_packs (queue_id);

alter table public.rescue_prep_packs enable row level security;

drop policy if exists "Rescue prep packs service role access" on public.rescue_prep_packs;
create policy "Rescue prep packs service role access"
on public.rescue_prep_packs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
