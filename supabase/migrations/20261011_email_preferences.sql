-- Email choices for ReviewIntel customer mail. MIGRATION FILE ONLY: NOT APPLIED by the app or this PR.
-- Additive and safe to re-run. It does not send any email and does not change anyone's consent.
--
-- Consent rules (see lib/emailPreferenceStore.ts marketingPermission):
--   * profiles.marketing_consent stays the master switch. It is the optional signup box
--     "Email me product updates and ReviewIntel tips", so it already covers both types below.
--   * The new per-type columns start NULL for everyone (no default, no backfill).
--     NULL means "inherit marketing_consent"; only an explicit FALSE narrows it.
--     Nobody is opted in by this migration: a person with marketing_consent = false
--     (or null) stays unsubscribed from everything.
--   * Unsubscribe writes FALSE to all three, so an opt-out survives a rollback to code
--     that only knows marketing_consent, and a later re-upgrade.
--   * Account, billing and security mail never read these columns.

alter table public.profiles
  add column if not exists email_product_updates boolean,
  add column if not exists email_upgrade_tips boolean,
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists first_scan_upgrade_sent_at timestamptz;

-- If an earlier draft of this file was run, undo its "default true" so new rows inherit
-- the master switch instead of being opted in. Existing values are left untouched.
alter table public.profiles alter column email_upgrade_tips drop default;
alter table public.profiles alter column email_upgrade_tips drop not null;

comment on column public.profiles.email_product_updates is 'Occasional product news. NULL = follow marketing_consent; FALSE = opted out. Never sent unless marketing_consent is true.';
comment on column public.profiles.email_upgrade_tips is 'One note after the first completed scan. NULL = follow marketing_consent; FALSE = opted out. Never sent unless marketing_consent is true.';
comment on column public.profiles.welcome_email_sent_at is 'When the welcome email was accepted for sending. Stops a second welcome.';
comment on column public.profiles.first_scan_upgrade_sent_at is 'When the one first-scan note was accepted for sending.';
