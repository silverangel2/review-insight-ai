-- Durable, idempotent, server-only free-scan claims.
-- The product policy remains three claims per UTC calendar day.

create table if not exists public.reviewintel_free_scan_claims (
  id uuid primary key default gen_random_uuid(),
  identity_kind text not null check (identity_kind in ('anonymous', 'authenticated')),
  identity_key text not null,
  utc_day date not null,
  scan_id text not null,
  created_at timestamptz not null default now(),
  unique (identity_kind, identity_key, utc_day, scan_id)
);

create index if not exists reviewintel_free_scan_claims_identity_day_idx
  on public.reviewintel_free_scan_claims (identity_kind, identity_key, utc_day);

create index if not exists reviewintel_free_scan_claims_day_idx
  on public.reviewintel_free_scan_claims (utc_day);

-- Preserve existing daily claims when the legacy tables are present. The
-- guarded backfill is intentionally limited to the current three-claim
-- policy and uses deterministic synthetic scan IDs only for historical rows.
do $$
begin
  if to_regclass('public.usage_events') is not null then
    execute $backfill$
      with ranked as (
        select
          lower(trim(profile_email)) as identity_key,
          (created_at at time zone 'UTC')::date as utc_day,
          row_number() over (
            partition by lower(trim(profile_email)), (created_at at time zone 'UTC')::date
            order by created_at asc
          ) as claim_number
        from public.usage_events
        where event_type = 'analysis'
          and profile_email is not null
          and length(trim(profile_email)) > 0
      )
      insert into public.reviewintel_free_scan_claims (
        identity_kind,
        identity_key,
        utc_day,
        scan_id
      )
      select
        'authenticated',
        identity_key,
        utc_day,
        'legacy-auth-' || md5(identity_key || ':' || utc_day::text || ':' || claim_number::text)
      from ranked
      where claim_number <= 3
      on conflict (identity_kind, identity_key, utc_day, scan_id) do nothing
    $backfill$;
  end if;

  if to_regclass('public.anonymous_scan_usage') is not null then
    execute $backfill$
      insert into public.reviewintel_free_scan_claims (
        identity_kind,
        identity_key,
        utc_day,
        scan_id
      )
      select
        'anonymous',
        ip_hash,
        (last_scan_at at time zone 'UTC')::date,
        'legacy-anon-' || id::text || '-' || claim_number::text
      from public.anonymous_scan_usage
      cross join lateral generate_series(
        1,
        least(greatest(coalesce(scan_count, 0), 0), 3)
      ) as claims(claim_number)
      where ip_hash is not null
        and last_scan_at is not null
      on conflict (identity_kind, identity_key, utc_day, scan_id) do nothing
    $backfill$;
  end if;
end;
$$;

alter table public.reviewintel_free_scan_claims enable row level security;

revoke all on table public.reviewintel_free_scan_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.reviewintel_free_scan_claims to service_role;

create or replace function public.claim_reviewintel_free_scan(
  p_identity_kind text,
  p_identity_key text,
  p_scan_id text,
  p_claimed_at timestamptz default now()
)
returns table (
  allowed boolean,
  code text,
  used integer,
  remaining integer,
  "resetAt" timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  claim_day date := (p_claimed_at at time zone 'UTC')::date;
  used_count integer := 0;
  claim_exists boolean := false;
begin
  if p_identity_kind not in ('anonymous', 'authenticated')
     or p_identity_key is null
     or length(trim(p_identity_key)) < 16
     or p_scan_id is null
     or length(trim(p_scan_id)) < 8 then
    raise exception 'invalid free scan claim';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_identity_kind || ':' || trim(p_identity_key) || ':' || claim_day::text,
      0
    )
  );

  delete from public.reviewintel_free_scan_claims
  where utc_day < claim_day - 35;

  select exists (
    select 1
    from public.reviewintel_free_scan_claims
    where identity_kind = p_identity_kind
      and identity_key = trim(p_identity_key)
      and utc_day = claim_day
      and scan_id = trim(p_scan_id)
  ) into claim_exists;

  select count(*)::integer
  from public.reviewintel_free_scan_claims
  where identity_kind = p_identity_kind
    and identity_key = trim(p_identity_key)
    and utc_day = claim_day
  into used_count;

  if claim_exists then
    return query select
      true,
      'idempotent'::text,
      used_count,
      greatest(0, 3 - used_count),
      ((claim_day + 1)::timestamp at time zone 'UTC') - interval '1 millisecond';
    return;
  end if;

  if used_count >= 3 then
    return query select
      false,
      'limit_reached'::text,
      used_count,
      0,
      ((claim_day + 1)::timestamp at time zone 'UTC') - interval '1 millisecond';
    return;
  end if;

  insert into public.reviewintel_free_scan_claims (
    identity_kind,
    identity_key,
    utc_day,
    scan_id
  ) values (
    p_identity_kind,
    trim(p_identity_key),
    claim_day,
    trim(p_scan_id)
  );

  return query select
    true,
    'claimed'::text,
    used_count + 1,
    greatest(0, 3 - used_count - 1),
    ((claim_day + 1)::timestamp at time zone 'UTC') - interval '1 millisecond';
end;
$$;

revoke all on function public.claim_reviewintel_free_scan(text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_reviewintel_free_scan(text, text, text, timestamptz)
  to service_role;
