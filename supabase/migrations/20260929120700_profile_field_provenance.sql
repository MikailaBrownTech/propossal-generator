-- Per-field source citations for a client_profiles version: what value was
-- extracted, from which source document, and the exact excerpt it came
-- from. Powers the human-review screen and the "what changed" diff when a
-- later source document updates an earlier confirmed value.

create table public.profile_field_provenance (
  id uuid primary key default gen_random_uuid(),
  client_profile_id uuid not null references public.client_profiles(id) on delete cascade,
  field_name text not null,
  value text,
  source_document_id uuid references public.source_documents(id),
  source_excerpt text,
  status public.profile_field_status not null default 'unresolved',
  created_at timestamptz not null default now()
);

create index profile_field_provenance_client_profile_id_idx
  on public.profile_field_provenance (client_profile_id);

alter table public.profile_field_provenance enable row level security;

create policy "profile_field_provenance_authenticated_all"
  on public.profile_field_provenance for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
