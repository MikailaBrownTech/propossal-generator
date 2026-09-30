-- Generated proposal for a client: narrative only. Plan identity and
-- pricing come from plans via plan_id -- the app validates narrative
-- contains no '$' before trusting a generation (guards against the model
-- inventing or restating a price).

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status public.document_status not null default 'draft',
  narrative jsonb not null default '{}'::jsonb,
  generated_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index proposals_client_id_idx on public.proposals (client_id);
create index proposals_plan_id_idx on public.proposals (plan_id);

create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

alter table public.proposals enable row level security;

create policy "proposals_authenticated_all"
  on public.proposals for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
