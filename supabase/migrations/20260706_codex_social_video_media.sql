-- ReviewIntel Codex social video generation metadata

alter table public.admin_social_media
add column if not exists mime_type text;

create index if not exists admin_social_media_codex_video_idx
on public.admin_social_media (media_type, is_active, last_used_at)
where media_type = 'video'
  and (metadata ->> 'codex_library') = 'true';
