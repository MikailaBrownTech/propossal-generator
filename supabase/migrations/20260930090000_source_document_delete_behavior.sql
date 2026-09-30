-- Fix two real bugs found while cleaning up test data, both the same root
-- cause: every foreign key below defaulted to ON DELETE NO ACTION, which
-- Postgres enforces even when the delete you actually asked for is several
-- tables away.
--
-- Bug 1: deleting a client could never succeed once it had source documents
-- with dependent findings/provenance rows. Postgres cascades clients ->
-- source_documents (that FK already has ON DELETE CASCADE), but then hits
-- the source_document_id FKs on findings/profile_field_provenance and
-- aborts the whole delete.
--
-- Bug 2: deleting a staff profile (e.g. an employee offboarding) was
-- blocked entirely the moment that person had ever touched a single
-- record anywhere in the app -- clients.created_by, findings.confirmed_by,
-- audit_log.actor_id, and seven other columns all reference profiles(id)
-- with no delete behavior specified.
--
-- SET NULL (not CASCADE) is correct for all of these: the actual content
-- (a finding's technical_description, an audit_log entry, a client record)
-- does not live only in the referenced row -- losing a source document or
-- a staff account should only drop the "which document" / "which person"
-- attribution pointer, never delete the substantive record itself. This
-- matters most for audit_log specifically: it must survive an account
-- being removed, just with actor_id nulled, not be deleted along with it.

alter table public.profile_field_provenance
  drop constraint profile_field_provenance_source_document_id_fkey,
  add constraint profile_field_provenance_source_document_id_fkey
    foreign key (source_document_id) references public.source_documents(id) on delete set null;

alter table public.findings
  drop constraint findings_source_document_id_fkey,
  add constraint findings_source_document_id_fkey
    foreign key (source_document_id) references public.source_documents(id) on delete set null,
  drop constraint findings_confirmed_by_fkey,
  add constraint findings_confirmed_by_fkey
    foreign key (confirmed_by) references public.profiles(id) on delete set null;

alter table public.clients
  drop constraint clients_created_by_fkey,
  add constraint clients_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.source_documents
  drop constraint source_documents_uploaded_by_fkey,
  add constraint source_documents_uploaded_by_fkey
    foreign key (uploaded_by) references public.profiles(id) on delete set null;

alter table public.client_profiles
  drop constraint client_profiles_confirmed_by_fkey,
  add constraint client_profiles_confirmed_by_fkey
    foreign key (confirmed_by) references public.profiles(id) on delete set null;

alter table public.findings_reports
  drop constraint findings_reports_reviewed_by_fkey,
  add constraint findings_reports_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles(id) on delete set null,
  drop constraint findings_reports_approved_by_fkey,
  add constraint findings_reports_approved_by_fkey
    foreign key (approved_by) references public.profiles(id) on delete set null;

alter table public.proposals
  drop constraint proposals_reviewed_by_fkey,
  add constraint proposals_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles(id) on delete set null,
  drop constraint proposals_approved_by_fkey,
  add constraint proposals_approved_by_fkey
    foreign key (approved_by) references public.profiles(id) on delete set null;

alter table public.scheduled_sends
  drop constraint scheduled_sends_created_by_fkey,
  add constraint scheduled_sends_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.audit_log
  drop constraint audit_log_actor_id_fkey,
  add constraint audit_log_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete set null;
