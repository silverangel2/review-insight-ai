-- Durable ReviewIntel operation idempotency and conservative daily budget reservations.
-- Apply separately after review; this migration is intentionally not applied by the app task.

create table if not exists public.reviewintel_scan_operations (
  operation_key text primary key,
  account_key text not null,
  scan_id text not null,
  status text not null check (status in ('RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED')),
  result_json jsonb,
  error_code text,
  reservation_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviewintel_daily_budget_usage (
  usage_date date not null default current_date,
  scope_key text not null,
  openai_calls_reserved integer not null default 0,
  openai_input_tokens_reserved bigint not null default 0,
  openai_output_tokens_reserved bigint not null default 0,
  openai_total_tokens_reserved bigint not null default 0,
  firecrawl_calls_reserved integer not null default 0,
  firecrawl_pages_reserved integer not null default 0,
  paid_provider_calls_reserved integer not null default 0,
  retrieval_requests_reserved integer not null default 0,
  primary key (usage_date, scope_key)
);

alter table public.reviewintel_scan_operations
  add column if not exists reservation_json jsonb;

create or replace function public.reviewintel_begin_scan_operation(
  p_operation_key text,
  p_account_key text,
  p_scan_id text,
  p_limits jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  existing public.reviewintel_scan_operations;
  d date := current_date;
  account_row public.reviewintel_daily_budget_usage;
  global_row public.reviewintel_daily_budget_usage;
  per_scan jsonb := p_limits->'perScan';
  account_daily jsonb := p_limits->'accountDaily';
  global_daily jsonb := p_limits->'globalDaily';
begin
  select * into existing from public.reviewintel_scan_operations where operation_key = p_operation_key for update;
  if found then
    return jsonb_build_object('status', existing.status, 'created', false, 'scan_id', existing.scan_id, 'result_json', existing.result_json, 'error_code', existing.error_code);
  end if;

  insert into public.reviewintel_daily_budget_usage(usage_date, scope_key) values (d, '__global__') on conflict do nothing;
  insert into public.reviewintel_daily_budget_usage(usage_date, scope_key) values (d, 'account:' || p_account_key) on conflict do nothing;
  select * into global_row from public.reviewintel_daily_budget_usage where usage_date=d and scope_key='__global__' for update;
  select * into account_row from public.reviewintel_daily_budget_usage where usage_date=d and scope_key='account:' || p_account_key for update;

  if global_row.openai_calls_reserved + (per_scan->>'openAiCalls')::int > (global_daily->>'openAiCalls')::int
    or account_row.openai_calls_reserved + (per_scan->>'openAiCalls')::int > (account_daily->>'openAiCalls')::int
    or global_row.openai_input_tokens_reserved + (per_scan->>'openAiInputTokens')::bigint > (global_daily->>'openAiInputTokens')::bigint
    or account_row.openai_input_tokens_reserved + (per_scan->>'openAiInputTokens')::bigint > (account_daily->>'openAiInputTokens')::bigint
    or global_row.openai_output_tokens_reserved + (per_scan->>'openAiOutputTokens')::bigint > (global_daily->>'openAiOutputTokens')::bigint
    or account_row.openai_output_tokens_reserved + (per_scan->>'openAiOutputTokens')::bigint > (account_daily->>'openAiOutputTokens')::bigint
    or global_row.openai_total_tokens_reserved + (per_scan->>'openAiTotalTokens')::bigint > (global_daily->>'openAiTotalTokens')::bigint
    or account_row.openai_total_tokens_reserved + (per_scan->>'openAiTotalTokens')::bigint > (account_daily->>'openAiTotalTokens')::bigint
    or global_row.firecrawl_calls_reserved + (per_scan->>'firecrawlCalls')::int > (global_daily->>'firecrawlCalls')::int
    or account_row.firecrawl_calls_reserved + (per_scan->>'firecrawlCalls')::int > (account_daily->>'firecrawlCalls')::int
    or global_row.firecrawl_pages_reserved + (per_scan->>'firecrawlPages')::int > (global_daily->>'firecrawlPages')::int
    or account_row.firecrawl_pages_reserved + (per_scan->>'firecrawlPages')::int > (account_daily->>'firecrawlPages')::int
    or global_row.paid_provider_calls_reserved + (per_scan->>'paidProviderCalls')::int > (global_daily->>'paidProviderCalls')::int
    or account_row.paid_provider_calls_reserved + (per_scan->>'paidProviderCalls')::int > (account_daily->>'paidProviderCalls')::int
    or global_row.retrieval_requests_reserved + (per_scan->>'retrievalRequests')::int > (global_daily->>'retrievalRequests')::int
    or account_row.retrieval_requests_reserved + (per_scan->>'retrievalRequests')::int > (account_daily->>'retrievalRequests')::int then
    insert into public.reviewintel_scan_operations(operation_key, account_key, scan_id, status, error_code)
      values (p_operation_key, p_account_key, p_scan_id, 'BLOCKED', 'DAILY_BUDGET_EXHAUSTED');
    return jsonb_build_object('status', 'BLOCKED', 'error_code', 'DAILY_BUDGET_EXHAUSTED');
  end if;

  update public.reviewintel_daily_budget_usage set
    openai_calls_reserved = openai_calls_reserved + (per_scan->>'openAiCalls')::int,
    openai_input_tokens_reserved = openai_input_tokens_reserved + (per_scan->>'openAiInputTokens')::bigint,
    openai_output_tokens_reserved = openai_output_tokens_reserved + (per_scan->>'openAiOutputTokens')::bigint,
    openai_total_tokens_reserved = openai_total_tokens_reserved + (per_scan->>'openAiTotalTokens')::bigint,
    firecrawl_calls_reserved = firecrawl_calls_reserved + (per_scan->>'firecrawlCalls')::int,
    firecrawl_pages_reserved = firecrawl_pages_reserved + (per_scan->>'firecrawlPages')::int,
    paid_provider_calls_reserved = paid_provider_calls_reserved + (per_scan->>'paidProviderCalls')::int,
    retrieval_requests_reserved = retrieval_requests_reserved + (per_scan->>'retrievalRequests')::int
  where usage_date=d and scope_key in ('__global__', 'account:' || p_account_key);

  insert into public.reviewintel_scan_operations(operation_key, account_key, scan_id, status, reservation_json)
    values (p_operation_key, p_account_key, p_scan_id, 'RUNNING', per_scan);
  return jsonb_build_object('status', 'RUNNING', 'created', true, 'scan_id', p_scan_id);
end;
$$;

create or replace function public.reviewintel_finish_scan_operation(
  p_operation_key text, p_status text, p_result_json jsonb, p_error_code text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  operation_row public.reviewintel_scan_operations;
begin
  select * into operation_row from public.reviewintel_scan_operations where operation_key=p_operation_key for update;
  update public.reviewintel_scan_operations
  set status=p_status, result_json=p_result_json, error_code=p_error_code, updated_at=now()
  where operation_key=p_operation_key and status='RUNNING';
  if p_status = 'FAILED' and operation_row.status = 'RUNNING' and operation_row.reservation_json is not null then
    update public.reviewintel_daily_budget_usage set
      openai_calls_reserved = greatest(0, openai_calls_reserved - (operation_row.reservation_json->>'openAiCalls')::int),
      openai_input_tokens_reserved = greatest(0, openai_input_tokens_reserved - (operation_row.reservation_json->>'openAiInputTokens')::bigint),
      openai_output_tokens_reserved = greatest(0, openai_output_tokens_reserved - (operation_row.reservation_json->>'openAiOutputTokens')::bigint),
      openai_total_tokens_reserved = greatest(0, openai_total_tokens_reserved - (operation_row.reservation_json->>'openAiTotalTokens')::bigint),
      firecrawl_calls_reserved = greatest(0, firecrawl_calls_reserved - (operation_row.reservation_json->>'firecrawlCalls')::int),
      firecrawl_pages_reserved = greatest(0, firecrawl_pages_reserved - (operation_row.reservation_json->>'firecrawlPages')::int),
      paid_provider_calls_reserved = greatest(0, paid_provider_calls_reserved - (operation_row.reservation_json->>'paidProviderCalls')::int),
      retrieval_requests_reserved = greatest(0, retrieval_requests_reserved - (operation_row.reservation_json->>'retrievalRequests')::int)
    where usage_date=current_date and scope_key in ('__global__', 'account:' || operation_row.account_key);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.reviewintel_begin_scan_operation(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.reviewintel_finish_scan_operation(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.reviewintel_begin_scan_operation(text, text, text, jsonb) to service_role;
grant execute on function public.reviewintel_finish_scan_operation(text, text, jsonb, text) to service_role;

revoke all on table public.reviewintel_scan_operations, public.reviewintel_daily_budget_usage from public, anon, authenticated;
grant all on table public.reviewintel_scan_operations, public.reviewintel_daily_budget_usage to service_role;
