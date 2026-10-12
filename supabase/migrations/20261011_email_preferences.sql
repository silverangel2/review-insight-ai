-- Email choices for ReviewIntel customer mail.
-- Apply this with the rest of the database updates before welcome and first-scan emails can be recorded.
-- It does not send any email.

alter table public.profiles
  add column if not exists email_product_updates boolean,
  add column if not exists email_upgrade_tips boolean not null default true,
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists first_scan_upgrade_sent_at timestamptz;

update public.profiles
set email_product_updates = marketing_consent
where email_product_updates is null;

comment on column public.profiles.email_product_updates is 'Occasional product news. Kept in step with marketing_consent.';
comment on column public.profiles.email_upgrade_tips is 'One note after the first completed scan. On until the person turns it off.';
comment on column public.profiles.welcome_email_sent_at is 'When the welcome email was accepted for sending. Stops a second welcome.';
comment on column public.profiles.first_scan_upgrade_sent_at is 'When the one first-scan note was accepted for sending.';
