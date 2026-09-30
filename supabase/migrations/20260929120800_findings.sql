-- Individual findings extracted from a vulnerability report or risk
-- assessment. Starts 'unresolved'; a human reviewer edits/confirms it,
-- including setting severity. Once confirmed, severity is owned by the
-- human and must never be changed by a model call again.

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  control_area text not null,
  technical_description text not null,
  affected_scope text,
  severity public.finding_severity not null,
  evidence_excerpt text,
  source_document_id uuid references public.source_documents(id),
  status public.finding_status not null default 'unresolved',
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index findings_client_id_idx on public.findings (client_id);

create trigger findings_set_updated_at
  before update on public.findings
  for each row execute function public.set_updated_at();

alter table public.findings enable row level security;

create policy "findings_authenticated_all"
  on public.findings for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
