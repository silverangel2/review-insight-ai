-- ReviewIntel Social Auto-Post: media library + 100-day queue foundation

create table if not exists public.admin_social_media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text,
  media_type text not null default 'image', -- image | video
  file_url text not null,
  thumbnail_url text,
  alt_text text,

  topic text,
  tags text[] not null default array[]::text[],
  is_active boolean not null default true,

  used_count integer not null default 0,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.admin_social_posts
add column if not exists queue_day integer,
add column if not exists cycle_number integer not null default 1,
add column if not exists recycle_count integer not null default 0,
add column if not exists media_id uuid references public.admin_social_media(id) on delete set null,
add column if not exists link_url text,
add column if not exists posted_at timestamptz,
add column if not exists content_fingerprint text;

alter table public.admin_social_settings
add column if not exists cycle_length integer not null default 100,
add column if not exists posts_per_day integer not null default 1,
add column if not exists recycle_after_days integer not null default 100,
add column if not exists last_queue_day integer not null default 0,
add column if not exists last_posted_at timestamptz;

alter table public.admin_social_media enable row level security;

drop policy if exists "Admin social media service role access" on public.admin_social_media;

create policy "Admin social media service role access"
on public.admin_social_media
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists admin_social_media_active_idx
on public.admin_social_media (is_active, media_type, last_used_at);

create index if not exists admin_social_posts_queue_idx
on public.admin_social_posts (queue_day, cycle_number, scheduled_for);

create index if not exists admin_social_posts_media_idx
on public.admin_social_posts (media_id);
