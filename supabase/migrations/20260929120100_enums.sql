-- Enumerated types shared across tables.

create type public.user_role as enum ('owner', 'staff');
create type public.source_type as enum ('meeting_notes', 'vulnerability_report', 'risk_assessment');
create type public.profile_field_status as enum ('confirmed', 'unresolved');
create type public.finding_severity as enum ('critical', 'high', 'medium', 'low');
create type public.finding_status as enum ('confirmed', 'unresolved');
create type public.document_status as enum ('draft', 'reviewed', 'approved');
create type public.send_document_type as enum ('findings_report', 'proposal');
create type public.send_status as enum ('pending', 'sent', 'failed', 'canceled');
create type public.audit_action as enum ('generate', 'edit', 'confirm', 'approve', 'export', 'send');
