-- Pricing source of truth. price_display is a free-form string (not cents)
-- because real ClearPath pricing includes ranges and "starting at" framing
-- ("$1,500+/month", "From $99/mo") that a numeric column can't represent
-- honestly. The model never writes to this table and never invents a
-- price -- generated proposal narrative only ever references a plan_id and
-- the app renders this row's price_display verbatim.

create table public.plans (
  id text primary key,
  name text not null,
  price_display text not null,
  billing_period text,
  fit_description text,
  is_featured boolean not null default false,
  inclusions jsonb not null default '[]'::jsonb,
  cta_label text,
  cta_url text,
  sort_order integer not null default 0,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;

-- Everyone signed in can read plans (needed to build proposals); only an
-- owner can change pricing.
create policy "plans_select_authenticated"
  on public.plans for select
  using (auth.uid() is not null);

create policy "plans_insert_owner"
  on public.plans for insert
  with check (public.is_owner());

create policy "plans_update_owner"
  on public.plans for update
  using (public.is_owner())
  with check (public.is_owner());

create policy "plans_delete_owner"
  on public.plans for delete
  using (public.is_owner());
