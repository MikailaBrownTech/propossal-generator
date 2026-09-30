-- Queue for emailing an approved findings report or proposal to a client
-- contact, either immediately ("send now": scheduled_at left null and the
-- server action dispatches inline) or at a future time (a Vercel Cron job
-- polls for due pending rows). document_id is polymorphic (points into
-- findings_reports or proposals depending on document_type), so it can't
-- carry a normal foreign key -- the trigger below validates it manually and
-- rejects anything that isn't already approved.

create table public.scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  document_type public.send_document_type not null,
  document_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  client_contact_id uuid not null references public.client_contacts(id),
  scheduled_at timestamptz,
  status public.send_status not null default 'pending',
  sent_at timestamptz,
  error text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index scheduled_sends_pending_due_idx
  on public.scheduled_sends (scheduled_at)
  where (status = 'pending');

create or replace function public.validate_scheduled_send()
returns trigger
language plpgsql
as $$
declare
  doc_status public.document_status;
begin
  if new.document_type = 'findings_report' then
    select status into doc_status
    from public.findings_reports
    where id = new.document_id and client_id = new.client_id;
  else
    select status into doc_status
    from public.proposals
    where id = new.document_id and client_id = new.client_id;
  end if;

  if doc_status is null then
    raise exception 'Referenced % not found for this client', new.document_type;
  end if;

  if doc_status <> 'approved' then
    raise exception '% must be approved before it can be sent', new.document_type;
  end if;

  return new;
end;
$$;

create trigger scheduled_sends_validate
  before insert or update on public.scheduled_sends
  for each row execute function public.validate_scheduled_send();

alter table public.scheduled_sends enable row level security;

create policy "scheduled_sends_authenticated_all"
  on public.scheduled_sends for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
