-- Confirmed, versioned client profile data. Each confirm action (whether
-- from the first source document or a later one merging in) creates a new
-- version rather than overwriting; only one version is_current at a time.
-- `data` holds the confirmed field values; per-field provenance/history
-- lives in profile_field_provenance.

create table public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  version integer not null,
  is_current boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, version)
);

-- At most one current version per client.
create unique index client_profiles_one_current
  on public.client_profiles (client_id)
  where (is_current);

create index client_profiles_client_id_idx on public.client_profiles (client_id);

alter table public.client_profiles enable row level security;

create policy "client_profiles_authenticated_all"
  on public.client_profiles for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
