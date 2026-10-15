-- ReviewIntel FYI watchlist alerts (Piece B of the RI bot-family build).
--
-- 1) product_watch_alert_log — dedup log for watchlist alert emails.
--    One row per (watcher, product, library snapshot hash): the
--    ri-watchlist-alerts cron never sends the same alert twice, and never
--    runs a reminder series.
-- 2) Library-snapshot columns on the existing product_watches table
--    (created by 20261010_product_watches.sql): the cron compares the
--    CURRENT product_review_library snapshot (aggregate rating +
--    review count) against these STORED values.
--
-- NOT APPLIED by the app or by this change. Review, then apply manually
-- in the Supabase SQL editor. Until applied, the ri-watchlist-alerts cron
-- returns 200 with a skipped status (fail-soft) instead of crashing.

create table if not exists public.product_watch_alert_log (
  id uuid primary key default gen_random_uuid(),
  profile_email text not null,
  product_key text not null,
  library_key text,
  result_hash text not null,
  reason text not null,
  sent_at timestamptz not null default now(),
  constraint product_watch_alert_log_one_per_change
    unique (profile_email, product_key, result_hash)
);

create index if not exists product_watch_alert_log_email_idx
  on public.product_watch_alert_log (profile_email, sent_at desc);

alter table public.product_watch_alert_log enable row level security;
revoke all on public.product_watch_alert_log from anon, authenticated;

-- Stored library snapshot on the watch itself (baseline for change
-- detection). Added idempotently so re-running the migration is safe.
alter table public.product_watches
  add column if not exists last_aggregate_rating numeric;
alter table public.product_watches
  add column if not exists last_review_count integer not null default 0;
alter table public.product_watches
  add column if not exists last_library_hash text;
