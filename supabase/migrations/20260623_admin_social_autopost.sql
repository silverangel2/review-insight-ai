create table if not exists public.admin_social_settings (
  id text primary key default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_auto_enabled boolean not null default false,
  semi_auto_enabled boolean not null default true,
  daily_time text not null default '09:00',
  platforms text[] not null default array['facebook'],
  topics text[] not null default array['shopper_tips','seller_tips','fake_review_warning'],
  emergency_pause boolean not null default false
);

insert into public.admin_social_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.admin_social_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  scheduled_for timestamptz not null default now(),
  platform text not null,
  mode text not null default 'full_auto',
  status text not null default 'draft',
  topic text not null default 'shopper_tips',
  caption text not null,
  hashtags text[] not null default array['ReviewIntel','FakeReviews','SmartShopping'],
  external_post_id text,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.admin_social_settings enable row level security;
alter table public.admin_social_posts enable row level security;

drop policy if exists "Admin social settings service role access" on public.admin_social_settings;
drop policy if exists "Admin social posts service role access" on public.admin_social_posts;

create policy "Admin social settings service role access"
on public.admin_social_settings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create policy "Admin social posts service role access"
on public.admin_social_posts
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
