create table if not exists public.admin_finance_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  entry_date date not null default current_date,
  type text not null check (type in ('income', 'expense')),
  category text not null default 'General',
  amount numeric(12,2) not null default 0,
  currency text not null default 'CAD',
  description text,
  tax_note text,
  receipt_url text,
  status text not null default 'logged'
);

create table if not exists public.admin_finance_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  entry_id uuid,
  entry_type text,
  category text,
  amount numeric(12,2),
  currency text,
  note text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.admin_finance_entries enable row level security;
alter table public.admin_finance_logs enable row level security;

drop policy if exists "Admin finance entries service role access" on public.admin_finance_entries;
drop policy if exists "Admin finance logs service role access" on public.admin_finance_logs;

create policy "Admin finance entries service role access"
on public.admin_finance_entries
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Admin finance logs service role access"
on public.admin_finance_logs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
