create table if not exists public.admin_email_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email_type text not null,
  provider text not null default 'resend',
  status text not null check (status in ('sent', 'failed', 'skipped')),
  recipient text,
  sender text,
  subject text,
  provider_message_id text,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.admin_email_logs enable row level security;

drop policy if exists "Admin email logs service role access" on public.admin_email_logs;

create policy "Admin email logs service role access"
on public.admin_email_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
