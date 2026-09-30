-- Client firms (the CPA/bookkeeping/tax-prep firms ClearPath assesses).
-- Shared across all ClearPath staff -- not owned per-user.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_name text not null,
  firm_type text,
  state text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

create policy "clients_authenticated_all"
  on public.clients for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
