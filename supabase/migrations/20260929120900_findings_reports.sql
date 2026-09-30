-- Generated findings report for a client: plain-English translation of the
-- confirmed findings list, plus an executive summary and top priorities.
-- finding_translations is keyed by finding id; the app validates every id
-- referenced exists in public.findings before this row is trusted.

create table public.findings_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  status public.document_status not null default 'draft',
  executive_summary text,
  top_priorities jsonb not null default '[]'::jsonb,
  finding_translations jsonb not null default '[]'::jsonb,
  generated_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index findings_reports_client_id_idx on public.findings_reports (client_id);

create trigger findings_reports_set_updated_at
  before update on public.findings_reports
  for each row execute function public.set_updated_at();

alter table public.findings_reports enable row level security;

create policy "findings_reports_authenticated_all"
  on public.findings_reports for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
