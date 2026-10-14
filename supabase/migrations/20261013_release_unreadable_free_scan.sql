-- Give one free-scan claim back when the scan could not read the Amazon page.
-- Idempotent: deleting a missing scan id returns the current day's remaining allowance.

create or replace function public.release_reviewintel_free_scan(
  p_identity_kind text,
  p_identity_key text,
  p_scan_id text,
  p_released_at timestamptz default now()
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
  claim_day date := (p_released_at at time zone 'UTC')::date;
  used_count integer := 0;
  removed_count integer := 0;
begin
  if p_identity_kind not in ('anonymous', 'authenticated')
     or p_identity_key is null
     or length(trim(p_identity_key)) = 0
     or p_scan_id is null
     or length(trim(p_scan_id)) = 0 then
    return query select
      true,
      'idempotent'::text,
      0,
      3,
      ((claim_day + 1)::timestamp at time zone 'UTC') - interval '1 millisecond';
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_identity_kind || ':' || trim(p_identity_key) || ':' || claim_day::text,
      0
    )
  );

  delete from public.reviewintel_free_scan_claims
  where identity_kind = p_identity_kind
    and identity_key = trim(p_identity_key)
    and scan_id = trim(p_scan_id);
  get diagnostics removed_count = row_count;

  select count(*)::integer
  from public.reviewintel_free_scan_claims
  where identity_kind = p_identity_kind
    and identity_key = trim(p_identity_key)
    and utc_day = claim_day
  into used_count;

  return query select
    true,
    case when removed_count > 0 then 'released' else 'idempotent' end,
    used_count,
    greatest(0, 3 - used_count),
    ((claim_day + 1)::timestamp at time zone 'UTC') - interval '1 millisecond';
end;
$$;

revoke all on function public.release_reviewintel_free_scan(text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.release_reviewintel_free_scan(text, text, text, timestamptz)
  to service_role;
