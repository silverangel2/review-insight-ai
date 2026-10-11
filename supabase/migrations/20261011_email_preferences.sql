-- ReviewIntel email preferences. MIGRATION FILE ONLY: NOT APPLIED by the app or this PR.
-- Without this table the app uses defaults (all optional mail on, transactional always) and
-- skips once-only lifecycle emails (welcome/upgrade) because it can't remember they were sent.
create table if not exists public.email_preferences (
  email text primary key,
  tips boolean not null default true,
  upgrade boolean not null default true,
  watch_alerts boolean not null default true,
  marketing boolean not null default true,
  unsubscribed_all boolean not null default false,
  welcome_sent_at timestamptz,
  upgrade_email_sent_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.email_preferences enable row level security;
-- Service role only (no public policies).
