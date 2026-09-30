-- Append-only audit trail: who did what, to which client/object, when.
-- metadata is structured context only (ids, field names) -- never raw
-- prompt text or document content. No update/delete policy is defined
-- below, so once RLS is enabled those operations are simply denied.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  client_id uuid references public.clients(id) on delete set null,
  action public.audit_action not null,
  object_type text not null,
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_client_id_idx on public.audit_log (client_id);
create index audit_log_created_at_idx on public.audit_log (created_at);

alter table public.audit_log enable row level security;

create policy "audit_log_select_authenticated"
  on public.audit_log for select
  using (auth.uid() is not null);

create policy "audit_log_insert_authenticated"
  on public.audit_log for insert
  with check (auth.uid() is not null);
