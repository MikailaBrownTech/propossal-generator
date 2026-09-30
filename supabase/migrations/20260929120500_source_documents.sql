-- Raw (redacted) source material a consultant pastes in: meeting notes,
-- vulnerability scan output, or risk assessment narrative. redacted_text is
-- always post-redaction -- the app must never write pre-redaction text here.

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  source_type public.source_type not null,
  redacted_text text not null,
  redaction_log jsonb not null default '[]'::jsonb,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index source_documents_client_id_idx on public.source_documents (client_id);

alter table public.source_documents enable row level security;

create policy "source_documents_authenticated_all"
  on public.source_documents for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
