-- ============================================================================
-- OWNER-APPLIED MIGRATION — run ONCE in the Supabase SQL editor (as the
-- table owner / service role). Safe to re-run: fully idempotent.
--
-- File: 20261016_product_review_library_dedupe_unique.sql
-- Date:  2026-10-16
--
-- BACKGROUND
--   The original 20261015 migration declared product_key UNIQUE, but the
--   live table accumulated DUPLICATE rows per product_key (upserts against
--   a table whose constraint does not match 409, and unordered limit=1
--   reads then flip between rows — three different corpora were observed
--   for one product within minutes). Consequences: scans consolidated the
--   wrong corpus and "same corpus = same verdict" broke.
--
-- WHAT THIS DOES
--   1. Reports the duplicate keys it finds (check the Messages/Results).
--   2. Merges each duplicate key into ONE canonical row:
--        - corpora merged by review-identity union: stableEvidenceHash when
--          the record carries one, else md5 of the normalized body plus
--          reviewer/rating (mirrors the app's unionLibraryCorpora);
--        - metadata (canonical_url, product_name, brand, store,
--          aggregate_*) taken from the FRESHEST row;
--        - scan_count = MAX seen (honest: true totals across dupes are
--          unknowable, max does not invent scans);
--        - review_count = length of the merged corpus.
--   3. Enforces uniqueness going forward (unique index, absent-safe).
--
-- EXPECTED OUTPUT (paste back to Dylan as the receipt):
--   the two verification SELECTs at the end must return:
--     remaining_duplicate_keys = 0
--     unique_index_present     = t
-- ============================================================================

-- STEP 0: report what we are about to repair.
select
  product_key,
  count(*) as row_count,
  string_agg(review_count::text, ', ' order by updated_at desc) as review_counts_freshest_first
from public.product_review_library
group by product_key
having count(*) > 1
order by count(*) desc;

-- STEP 1: merge duplicate keys into one canonical row each.
do $$
declare
  r record;
  merged_corpus jsonb;
  v_canonical_url text;
  v_product_name text;
  v_brand text;
  v_store text;
  v_aggregate_rating numeric;
  v_aggregate_count integer;
  v_scan_count integer;
  v_first_seen timestamptz;
  v_last_seen timestamptz;
  dup_total integer := 0;
begin
  for r in
    select product_key
    from public.product_review_library
    group by product_key
    having count(*) > 1
  loop
    dup_total := dup_total + 1;

    -- Merged corpus: identity union, freshest occurrence of each review wins.
    select coalesce(jsonb_agg(rec order by rn), '[]'::jsonb)
    into merged_corpus
    from (
      select distinct on (ident) ident, rec,
             row_number() over (order by ident) as rn
      from (
        select
          coalesce(
            nullif(rec->>'stableEvidenceHash', ''),
            'body:' || md5(
              lower(regexp_replace(trim(coalesce(rec->>'body', '')), '\s+', ' ', 'g'))
              || '|' || coalesce(rec->>'reviewerName', '')
              || '|' || coalesce(rec->>'rating', '')
            )
          ) as ident,
          rec,
          t.updated_at as row_updated
        from public.product_review_library t,
        lateral jsonb_array_elements(coalesce(t.corpus, '[]'::jsonb)) as rec
        where t.product_key = r.product_key
          and jsonb_typeof(rec) = 'object'
      ) s
      order by ident, row_updated desc nulls last
    ) d;

    -- Metadata from the freshest row; counters honestly consolidated.
    select canonical_url, product_name, brand, store,
           aggregate_rating, aggregate_count
    into v_canonical_url, v_product_name, v_brand, v_store,
         v_aggregate_rating, v_aggregate_count
    from public.product_review_library
    where product_key = r.product_key
    order by updated_at desc nulls last
    limit 1;

    select coalesce(max(scan_count), 0) into v_scan_count
    from public.product_review_library where product_key = r.product_key;
    select min(first_seen_at) into v_first_seen
    from public.product_review_library where product_key = r.product_key;
    select max(last_seen_at) into v_last_seen
    from public.product_review_library where product_key = r.product_key;

    delete from public.product_review_library where product_key = r.product_key;

    insert into public.product_review_library (
      product_key, canonical_url, product_name, brand, store,
      aggregate_rating, aggregate_count,
      corpus, review_count, scan_count,
      first_seen_at, last_seen_at, created_at, updated_at
    ) values (
      r.product_key, v_canonical_url, v_product_name, v_brand, v_store,
      v_aggregate_rating, v_aggregate_count,
      merged_corpus, jsonb_array_length(merged_corpus), v_scan_count,
      coalesce(v_first_seen, now()), coalesce(v_last_seen, now()), now(), now()
    );
  end loop;

  raise notice 'product_review_library dedupe: merged % duplicate product_key values.', dup_total;
end
$$;

-- STEP 2: enforce uniqueness going forward (absent-safe).
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = c.conkey[1]
    where c.conrelid = 'public.product_review_library'::regclass
      and c.contype in ('u', 'p')
      and cardinality(c.conkey) = 1
      and a.attname = 'product_key'
  ) then
    create unique index if not exists product_review_library_product_key_uidx
      on public.product_review_library (product_key);
    raise notice 'unique index on product_review_library(product_key) created.';
  else
    raise notice 'unique constraint/index on product_key already present; skipped.';
  end if;
end
$$;

-- STEP 3: verification (receipt for Dylan).
select count(*) as remaining_duplicate_keys
from (
  select product_key from public.product_review_library
  group by product_key having count(*) > 1
) d;

select exists (
  select 1
  from pg_constraint c
  join pg_attribute a
    on a.attrelid = c.conrelid
   and a.attnum = c.conkey[1]
  where c.conrelid = 'public.product_review_library'::regclass
    and c.contype in ('u', 'p')
    and cardinality(c.conkey) = 1
    and a.attname = 'product_key'
) or exists (
  select 1 from pg_indexes
  where schemaname = 'public'
    and tablename = 'product_review_library'
    and indexdef ilike '%unique%product_key%'
) as unique_index_present;
