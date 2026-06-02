-- ReviewIntel production-ready Supabase/PostgreSQL schema.
-- Run in the Supabase SQL editor after creating the project.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('guest', 'buyer', 'seller', 'admin');
exception when duplicate_object then
  alter type public.user_role add value if not exists 'guest';
  alter type public.user_role add value if not exists 'buyer';
  alter type public.user_role add value if not exists 'seller';
  alter type public.user_role add value if not exists 'admin';
end $$;

do $$ begin
  create type public.subscription_plan as enum ('free_buyer', 'buyer_pro', 'seller_starter', 'seller_pro');
exception when duplicate_object then
  alter type public.subscription_plan add value if not exists 'free_buyer';
  alter type public.subscription_plan add value if not exists 'buyer_pro';
  alter type public.subscription_plan add value if not exists 'seller_starter';
  alter type public.subscription_plan add value if not exists 'seller_pro';
end $$;

do $$ begin
  create type public.analysis_audience as enum ('buyer', 'seller', 'both');
exception when duplicate_object then
  alter type public.analysis_audience add value if not exists 'buyer';
  alter type public.analysis_audience add value if not exists 'seller';
  alter type public.analysis_audience add value if not exists 'both';
end $$;

do $$ begin
  create type public.comparison_mode as enum ('buyer', 'seller');
exception when duplicate_object then
  alter type public.comparison_mode add value if not exists 'buyer';
  alter type public.comparison_mode add value if not exists 'seller';
end $$;

do $$ begin
  create type public.review_platform as enum (
    'amazon',
    'walmart',
    'etsy',
    'ebay',
    'shopify',
    'aliexpress',
    'best_buy',
    'tiktok_shop',
    'google_reviews',
    'app_reviews',
    'other'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  full_name text,
  role public.user_role not null default 'buyer',
  company_name text,
  avatar_url text,
  email_verified boolean not null default false,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan public.subscription_plan not null default 'free_buyer',
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused', 'developer')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  manually_granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  anonymous_key text,
  usage_date date not null default current_date,
  analysis_count integer not null default 0,
  comparison_count integer not null default 0,
  screenshot_count integer not null default 0,
  ai_input_tokens integer not null default 0,
  ai_output_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usage_identity_check check (user_id is not null or anonymous_key is not null)
);

create unique index if not exists usage_tracking_user_day_idx
  on public.usage_tracking(user_id, usage_date)
  where user_id is not null;

create unique index if not exists usage_tracking_anon_day_idx
  on public.usage_tracking(anonymous_key, usage_date)
  where anonymous_key is not null;

create table if not exists public.review_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  product_name text,
  product_url text,
  platform public.review_platform not null default 'other',
  audience public.analysis_audience not null default 'both',
  source_type text not null default 'manual_upload' check (source_type in ('manual_paste', 'screenshot_upload', 'manual_upload', 'bulk_text_upload', 'product_url_placeholder', 'connector_import', 'api_import')),
  source_metadata jsonb not null default '{}'::jsonb,
  review_text text,
  review_count_estimate integer not null default 0,
  image_count integer not null default 0,
  model text not null,
  mode text not null check (mode in ('openai', 'local-fallback')),
  overall_summary text not null,
  buyer_recommendation jsonb not null,
  seller_insights jsonb not null,
  positive_points jsonb not null default '[]'::jsonb,
  negative_points jsonb not null default '[]'::jsonb,
  common_complaints jsonb not null default '[]'::jsonb,
  praised_features jsonb not null default '[]'::jsonb,
  quality_concerns jsonb not null default '[]'::jsonb,
  improvement_suggestions jsonb not null default '[]'::jsonb,
  fake_review_indicators jsonb not null default '[]'::jsonb,
  packaging_issues jsonb not null default '[]'::jsonb,
  durability_issues jsonb not null default '[]'::jsonb,
  support_issues jsonb not null default '[]'::jsonb,
  keyword_analysis jsonb not null default '[]'::jsonb,
  sentiment_score numeric(4, 3) not null,
  confidence_score numeric(4, 3) not null,
  product_score numeric(5, 2) not null,
  is_flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now()
);

alter table if exists public.review_analyses
  add column if not exists product_url text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

alter table if exists public.review_analyses
  drop constraint if exists review_analyses_source_type_check;

alter table if exists public.review_analyses
  add constraint review_analyses_source_type_check
  check (source_type in ('manual_paste', 'screenshot_upload', 'manual_upload', 'bulk_text_upload', 'product_url_placeholder', 'connector_import', 'api_import'));

create table if not exists public.uploaded_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  analysis_id uuid references public.review_analyses(id) on delete cascade,
  storage_bucket text not null default 'review-screenshots',
  storage_path text not null,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  file_size integer not null,
  width integer,
  height integer,
  ocr_text text,
  stitch_group_id uuid,
  display_order integer not null default 0,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

alter table if exists public.uploaded_images
  add column if not exists stitch_group_id uuid,
  add column if not exists display_order integer not null default 0;

create table if not exists public.saved_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  analysis_id uuid references public.review_analyses(id) on delete set null,
  product_name text not null,
  platform public.review_platform not null default 'other',
  product_url text,
  favorite boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  mode public.comparison_mode not null default 'buyer',
  title text,
  priorities jsonb not null default '[]'::jsonb,
  winner_product_id uuid,
  result_summary text,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comparison_products (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null references public.product_comparisons(id) on delete cascade,
  analysis_id uuid references public.review_analyses(id) on delete set null,
  product_name text not null,
  price numeric(12, 2),
  category text,
  product_url text,
  review_text text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.comparison_results (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null unique references public.product_comparisons(id) on delete cascade,
  best_overall_product_id uuid references public.comparison_products(id) on delete set null,
  best_budget_product_id uuid references public.comparison_products(id) on delete set null,
  best_quality_product_id uuid references public.comparison_products(id) on delete set null,
  best_durability_product_id uuid references public.comparison_products(id) on delete set null,
  avoid_product_id uuid references public.comparison_products(id) on delete set null,
  explanation text,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  stripe_event_id text unique,
  stripe_invoice_id text,
  amount_paid integer,
  currency text default 'usd',
  status text,
  event_type text,
  raw_event jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  email_reports boolean not null default true,
  marketing_emails boolean not null default false,
  default_role public.user_role not null default 'buyer',
  default_platform public.review_platform not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key default 'global',
  maintenance_mode boolean not null default false,
  allow_new_signups boolean not null default true,
  ai_enabled boolean not null default true,
  payments_enabled boolean not null default true,
  sponsored_section_enabled boolean not null default true,
  announcement_enabled boolean not null default false,
  announcement_text text not null default 'ReviewIntel is temporarily updating. Please check back shortly.',
  stripe_sandbox_mode boolean not null default true,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings(id)
values ('global')
on conflict (id) do nothing;

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  category text not null,
  logo_url text,
  logo_text text,
  destination_url text not null,
  affiliate_url text,
  cta_label text not null default 'Learn more',
  sponsored boolean not null default true,
  active boolean not null default false,
  placements text[] not null default array['landing'],
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_events (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid references public.sponsors(id) on delete set null,
  event_type text not null check (event_type in ('impression', 'click')),
  placement text,
  path text,
  anonymous_key text,
  user_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  source text not null,
  severity text not null default 'error' check (severity in ('info', 'warn', 'error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  analysis_id uuid references public.review_analyses(id) on delete set null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists review_analyses_user_created_idx on public.review_analyses(user_id, created_at desc);
create index if not exists review_analyses_platform_idx on public.review_analyses(platform);
create index if not exists review_analyses_keyword_gin_idx on public.review_analyses using gin(keyword_analysis);
create index if not exists uploaded_images_analysis_idx on public.uploaded_images(analysis_id);
create index if not exists saved_products_user_idx on public.saved_products(user_id, created_at desc);
create index if not exists product_comparisons_user_idx on public.product_comparisons(user_id, created_at desc);
create index if not exists comparison_products_comparison_idx on public.comparison_products(comparison_id, display_order);
create index if not exists billing_history_user_idx on public.billing_history(user_id, created_at desc);
create index if not exists sponsors_active_idx on public.sponsors(active, starts_at, ends_at);
create index if not exists sponsor_events_sponsor_created_idx on public.sponsor_events(sponsor_id, created_at desc);
create index if not exists error_logs_created_idx on public.error_logs(created_at desc);
create index if not exists abuse_reports_status_idx on public.abuse_reports(status, created_at desc);

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_tracking enable row level security;
alter table public.review_analyses enable row level security;
alter table public.uploaded_images enable row level security;
alter table public.saved_products enable row level security;
alter table public.product_comparisons enable row level security;
alter table public.comparison_products enable row level security;
alter table public.comparison_results enable row level security;
alter table public.billing_history enable row level security;
alter table public.settings enable row level security;
alter table public.app_settings enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_events enable row level security;
alter table public.error_logs enable row level security;
alter table public.abuse_reports enable row level security;

-- Policies assume public.users.auth_user_id mirrors auth.uid().
create policy "Users can read themselves" on public.users
  for select using (auth.uid() = auth_user_id);

create policy "Profiles can be read by owner" on public.profiles
  for select using (exists (select 1 from public.users u where u.id = profiles.user_id and u.auth_user_id = auth.uid()));

create policy "Owners can read subscriptions" on public.subscriptions
  for select using (exists (select 1 from public.users u where u.id = subscriptions.user_id and u.auth_user_id = auth.uid()));

create policy "Owners can read usage" on public.usage_tracking
  for select using (exists (select 1 from public.users u where u.id = usage_tracking.user_id and u.auth_user_id = auth.uid()));

create policy "Owners can manage saved products" on public.saved_products
  for all using (exists (select 1 from public.users u where u.id = saved_products.user_id and u.auth_user_id = auth.uid()));

create policy "Owners can read analyses" on public.review_analyses
  for select using (exists (select 1 from public.users u where u.id = review_analyses.user_id and u.auth_user_id = auth.uid()));

create policy "Owners can read uploads" on public.uploaded_images
  for select using (exists (select 1 from public.users u where u.id = uploaded_images.user_id and u.auth_user_id = auth.uid()));

create policy "Owners can read settings" on public.settings
  for select using (exists (select 1 from public.users u where u.id = settings.user_id and u.auth_user_id = auth.uid()));

create policy "Owners can read comparisons" on public.product_comparisons
  for select using (exists (select 1 from public.users u where u.id = product_comparisons.user_id and u.auth_user_id = auth.uid()));

create policy "Owners can read comparison products" on public.comparison_products
  for select using (
    exists (
      select 1
      from public.product_comparisons c
      join public.users u on u.id = c.user_id
      where c.id = comparison_products.comparison_id and u.auth_user_id = auth.uid()
    )
  );

create policy "Owners can read comparison results" on public.comparison_results
  for select using (
    exists (
      select 1
      from public.product_comparisons c
      join public.users u on u.id = c.user_id
      where c.id = comparison_results.comparison_id and u.auth_user_id = auth.uid()
    )
  );

create policy "Active sponsors are public" on public.sponsors
  for select using (active = true);

create policy "Admins can manage sponsors" on public.sponsors
  for all using (
    exists (
      select 1
      from public.users u
      join public.profiles p on p.user_id = u.id
      where u.auth_user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can manage app settings" on public.app_settings
  for all using (
    exists (
      select 1
      from public.users u
      join public.profiles p on p.user_id = u.id
      where u.auth_user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can read error logs" on public.error_logs
  for select using (
    exists (
      select 1
      from public.users u
      join public.profiles p on p.user_id = u.id
      where u.auth_user_id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can read abuse reports" on public.abuse_reports
  for select using (
    exists (
      select 1
      from public.users u
      join public.profiles p on p.user_id = u.id
      where u.auth_user_id = auth.uid() and p.role = 'admin'
    )
  );
