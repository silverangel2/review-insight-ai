-- ReviewIntel seller workspace persistence (products, improvement journal, notes) per account.
-- NOT APPLIED by the app or by this PR. Review, then apply manually to the target database
-- (e.g. `supabase db push` or the SQL editor). Until applied, the app keeps using the
-- browser's localStorage and nothing breaks.

create table if not exists public.seller_workspaces (
  profile_email text primary key,
  products jsonb not null default '[]'::jsonb,
  journal jsonb not null default '[]'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint seller_workspaces_products_is_array check (jsonb_typeof(products) = 'array'),
  constraint seller_workspaces_journal_is_array check (jsonb_typeof(journal) = 'array'),
  constraint seller_workspaces_notes_is_object check (jsonb_typeof(notes) = 'object')
);

-- Only the server (service role) reads or writes this table; no public access.
alter table public.seller_workspaces enable row level security;
revoke all on public.seller_workspaces from anon, authenticated;

comment on table public.seller_workspaces is
  'Seller products, journal scans and notes. Written by /api/seller-workspace using the verified account session.';
