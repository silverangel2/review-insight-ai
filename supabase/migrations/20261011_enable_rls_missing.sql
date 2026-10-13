-- Enable RLS on tables created without it. MIGRATION FILE ONLY: NOT APPLIED by the app or this PR.
-- The app reads/writes these with the service role (which bypasses RLS), so behaviour is unchanged;
-- this only stops the public anon key from reading/writing them directly. Verify in staging first.
alter table if exists public.site_traffic_events enable row level security;
alter table if exists public.reviewintel_scan_operations enable row level security;
alter table if exists public.reviewintel_daily_budget_usage enable row level security;
