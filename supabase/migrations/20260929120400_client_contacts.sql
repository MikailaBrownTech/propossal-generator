-- Contacts at a client firm. Reports/proposals get emailed to one of these.

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  title text,
  email text not null,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one primary contact per client.
create unique index client_contacts_one_primary
  on public.client_contacts (client_id)
  where (is_primary);

create index client_contacts_client_id_idx on public.client_contacts (client_id);

create trigger client_contacts_set_updated_at
  before update on public.client_contacts
  for each row execute function public.set_updated_at();

alter table public.client_contacts enable row level security;

create policy "client_contacts_authenticated_all"
  on public.client_contacts for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
