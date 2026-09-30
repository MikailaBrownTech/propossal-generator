-- Standalone add-ons (WISP Standalone, IT Support, etc). Seeded for
-- reference; not read by proposal generation in v1 -- proposals recommend
-- exactly one plan. Same owner-write-only policy as plans.

create table public.add_ons (
  id text primary key,
  name text not null,
  price_display text not null,
  billing text,
  description text,
  cta_label text,
  cta_url text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger add_ons_set_updated_at
  before update on public.add_ons
  for each row execute function public.set_updated_at();

alter table public.add_ons enable row level security;

create policy "add_ons_select_authenticated"
  on public.add_ons for select
  using (auth.uid() is not null);

create policy "add_ons_insert_owner"
  on public.add_ons for insert
  with check (public.is_owner());

create policy "add_ons_update_owner"
  on public.add_ons for update
  using (public.is_owner())
  with check (public.is_owner());

create policy "add_ons_delete_owner"
  on public.add_ons for delete
  using (public.is_owner());
