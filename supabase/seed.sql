-- Dev/test sample data -- NOT a migration. Supabase's own tooling
-- (`supabase db reset`) runs this file automatically after applying every
-- migration in supabase/migrations/, specifically so sample data stays out
-- of the versioned schema history. Do NOT run this against a production
-- project -- these are fake clients for exercising the client list,
-- source-document intake, and (once step 5 exists) the extraction
-- review screen.
--
-- created_by / uploaded_by / confirmed_by are left NULL throughout: this
-- file doesn't know which real auth.users row corresponds to "you" in
-- whatever project it's run against, and those columns are nullable for
-- exactly this reason.
--
-- To run: paste into the Supabase SQL Editor (on a dev/staging project),
-- or `supabase db reset` locally if you're using the CLI against a local
-- Supabase instance.

-- ---------------------------------------------------------------------
-- Client 1: Harbor Point Bookkeeping -- fully through intake, has a
-- confirmed client_profiles version with provenance, so it's ready to
-- exercise findings-report/proposal generation once those steps exist.
-- ---------------------------------------------------------------------

insert into public.clients (id, firm_name, firm_type, state, notes)
values (
  '11111111-1111-1111-1111-111111111111',
  'Harbor Point Bookkeeping',
  'Bookkeeping',
  'OH',
  'Reached out after a phishing attempt; owner Dana Whitfield is the main contact.'
)
on conflict (id) do nothing;

insert into public.client_contacts (id, client_id, name, email, title, is_primary)
values (
  '11111111-1111-1111-1111-100000000001',
  '11111111-1111-1111-1111-111111111111',
  'Dana Whitfield',
  'dana@harborpointbooks.example.com',
  'Owner',
  true
)
on conflict (id) do nothing;

insert into public.source_documents (id, client_id, source_type, redacted_text, redaction_log)
values (
  'a1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'meeting_notes',
  'Discovery call with Dana Whitfield, owner of Harbor Point Bookkeeping, on Tuesday afternoon. Firm has 4 staff total including Dana. They handle bookkeeping and payroll processing for about 60 small business clients, mostly in Ohio. Everyone works out of the same office in Columbus; no remote work currently, though Dana mentioned she sometimes logs in from home on her personal laptop to check email. They use QuickBooks Online for client books and Gusto for payroll. Email is Microsoft 365. Dana said they don''t have any formal written security policy -- "we''ve just never gotten around to it." No one uses a password manager; she thinks staff mostly reuse the same password across a few systems. Backups: QuickBooks and Gusto are cloud-hosted so she assumes those are backed up by the vendor, but there''s a shared drive with client PDFs that she doesn''t think is backed up anywhere. Biggest concern: got a suspicious email last month that looked like it was from the bank, asking to confirm account details. Didn''t click, but it worried her enough to start looking into compliance help.',
  '[]'::jsonb
)
on conflict (id) do nothing;

insert into public.source_documents (id, client_id, source_type, redacted_text, redaction_log)
values (
  'a2111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'vulnerability_report',
  E'Automated scan summary -- Harbor Point Bookkeeping, scanned 2026-09-15.\nFindings:\n1. No multi-factor authentication enforced on Microsoft 365 tenant (all 4 user accounts).\n2. Local workstation OS patch level: 2 of 4 machines running Windows versions more than 90 days behind current security updates.\n3. Shared network drive (\\\\HPB-FILES\\clientdocs) has no automated backup job configured; last manual backup found dated over 60 days ago.\n4. SMTP email gateway does not enforce DMARC; spoofing of the firm''s domain is possible.\n5. One workstation found running an end-of-life antivirus definition set (>120 days stale).',
  '[]'::jsonb
)
on conflict (id) do nothing;

insert into public.client_profiles (id, client_id, version, is_current, data, confirmed_at)
values (
  'b1111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  1,
  true,
  jsonb_build_object(
    'firm_type', 'Bookkeeping',
    'staff_count', 4,
    'consumer_count_band', '50-100',
    'states', jsonb_build_array('OH'),
    'systems', jsonb_build_array('QuickBooks Online', 'Gusto', 'Microsoft 365'),
    'remote_work', true,
    'devices', 'Primarily office-based; owner occasionally accesses email from a personal laptop at home',
    'current_security_posture', 'No written security policy; no password manager; MFA not enforced; backup coverage unclear for local file shares',
    'concerns', 'Recent suspicious phishing email impersonating a bank prompted interest in compliance help'
  ),
  now()
)
on conflict (id) do nothing;

insert into public.profile_field_provenance (id, client_profile_id, field_name, value, source_document_id, source_excerpt, status)
values
  ('c1111111-1111-1111-1111-000000000001', 'b1111111-1111-1111-1111-111111111111', 'firm_type', 'Bookkeeping', 'a1111111-1111-1111-1111-111111111111', 'handle bookkeeping and payroll processing for about 60 small business clients', 'confirmed'),
  ('c1111111-1111-1111-1111-000000000002', 'b1111111-1111-1111-1111-111111111111', 'staff_count', '4', 'a1111111-1111-1111-1111-111111111111', 'Firm has 4 staff total including Dana.', 'confirmed'),
  ('c1111111-1111-1111-1111-000000000003', 'b1111111-1111-1111-1111-111111111111', 'states', 'OH', 'a1111111-1111-1111-1111-111111111111', 'about 60 small business clients, mostly in Ohio', 'confirmed'),
  ('c1111111-1111-1111-1111-000000000004', 'b1111111-1111-1111-1111-111111111111', 'systems', 'QuickBooks Online, Gusto, Microsoft 365', 'a1111111-1111-1111-1111-111111111111', 'They use QuickBooks Online for client books and Gusto for payroll. Email is Microsoft 365.', 'confirmed'),
  ('c1111111-1111-1111-1111-000000000005', 'b1111111-1111-1111-1111-111111111111', 'remote_work', 'true', 'a1111111-1111-1111-1111-111111111111', 'she sometimes logs in from home on her personal laptop to check email', 'confirmed'),
  ('c1111111-1111-1111-1111-000000000006', 'b1111111-1111-1111-1111-111111111111', 'concerns', 'Suspicious phishing email impersonating a bank', 'a1111111-1111-1111-1111-111111111111', 'got a suspicious email last month that looked like it was from the bank', 'confirmed')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Client 2: Sunridge Tax Advisors -- mid-intake. One source document,
-- no client_profiles row yet (simulates "just started discovery").
-- ---------------------------------------------------------------------

insert into public.clients (id, firm_name, firm_type, state, notes)
values (
  '22222222-2222-2222-2222-222222222222',
  'Sunridge Tax Advisors',
  'Tax preparation',
  'TX',
  'Proactively reaching out about new IRS guidance; managing partner is Marcus Chen.'
)
on conflict (id) do nothing;

insert into public.client_contacts (id, client_id, name, email, title, is_primary)
values (
  '22222222-2222-2222-2222-200000000001',
  '22222222-2222-2222-2222-222222222222',
  'Marcus Chen',
  'marcus@sunridgetax.example.com',
  'Managing Partner',
  true
)
on conflict (id) do nothing;

insert into public.source_documents (id, client_id, source_type, redacted_text, redaction_log)
values (
  'a1222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'meeting_notes',
  'Intro call with Marcus Chen, managing partner at Sunridge Tax Advisors. Small tax prep shop, 3 preparers plus Marcus, seasonal help during tax season (up to 6 total Jan-April). About 400 individual and small-business tax clients. Office in Austin, TX. They use Drake Tax software and a separate client portal (SmartVault) for document exchange. Staff use a mix of firm laptops and personal desktops when working from home during the season. Marcus wasn''t sure whether MFA is turned on anywhere -- "IT stuff isn''t really my thing, that''s why we''re calling you." No known incidents so far, just proactively trying to get ahead of the new IRS guidance he''d heard about.',
  '[]'::jsonb
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Client 3: Meridian CPA Group -- mid-intake. One risk-assessment
-- source document, no client_profiles row yet.
-- ---------------------------------------------------------------------

insert into public.clients (id, firm_name, firm_type, state, notes)
values (
  '33333333-3333-3333-3333-333333333333',
  'Meridian CPA Group',
  'CPA firm',
  'NY',
  'Two-office firm (Albany + Syracuse); came in with an existing third-party risk assessment.'
)
on conflict (id) do nothing;

insert into public.client_contacts (id, client_id, name, email, title, is_primary)
values (
  '33333333-3333-3333-3333-300000000001',
  '33333333-3333-3333-3333-333333333333',
  'Renee Ackerman',
  'renee@meridiancpa.example.com',
  'Managing Partner',
  true
)
on conflict (id) do nothing;

insert into public.source_documents (id, client_id, source_type, redacted_text, redaction_log)
values (
  'a1333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  'risk_assessment',
  E'Third-party risk assessment summary for Meridian CPA Group, prepared 2026-08-01.\nMeridian is a mid-sized CPA firm with approximately 22 staff across two New York offices (Albany and Syracuse), serving roughly 900 business and individual clients including audit, tax, and advisory work.\nKey observations:\n- Endpoint protection is inconsistent between the two offices; Syracuse office uses a different (unmanaged) antivirus product than Albany.\n- No centralized identity provider; each office manages its own local user accounts for file share access.\n- Firm-wide risk acceptance: leadership has not formally reviewed or signed off on any written risk assessment in the past 24 months.\n- Client data retention policy exists in draft form but has not been finalized or distributed to staff.\n- Prior consultant flagged remote access via a consumer-grade VPN product as a moderate risk; not yet remediated.',
  '[]'::jsonb
)
on conflict (id) do nothing;
