create table if not exists public.admin_seo_settings (
  path text primary key,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.admin_seo_settings enable row level security;

drop policy if exists "Admin SEO service role access" on public.admin_seo_settings;

create policy "Admin SEO service role access"
on public.admin_seo_settings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
