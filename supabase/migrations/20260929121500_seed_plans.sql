-- Seed: ClearPath's real managed compliance plan tiers.

insert into public.plans
  (id, name, price_display, billing_period, fit_description, is_featured, inclusions, cta_label, cta_url, sort_order, notes)
values
(
  'essentials',
  'Essentials',
  '$449/month',
  'monthly',
  'Solo practitioners and firms under 5 staff',
  false,
  '[
    "WISP documentation (written for you)",
    "MFA setup on all systems",
    "Microsoft 365 security hardening",
    "Encrypted backup configuration",
    "Annual risk assessment",
    "Email & phone support",
    "Quarterly backup verification"
  ]'::jsonb,
  'Get Started',
  'https://www.clearpathsecure.com/contact',
  1,
  null
),
(
  'professional',
  'Professional',
  '$849/month',
  'monthly',
  'Firms with 5-15 staff -- our most popular plan',
  true,
  '[
    "WISP documentation (written for you)",
    "MFA setup on all systems",
    "Microsoft 365 security hardening",
    "Encrypted backup configuration",
    "Annual risk assessment",
    "Email & phone support",
    "Quarterly backup verification",
    "Endpoint monitoring (all devices)",
    "24/7 threat monitoring & alerts",
    "Staff security awareness training",
    "Vendor compliance documentation",
    "FTC breach notification management",
    "Quarterly compliance review calls",
    "Offboarding & access revocation",
    "Priority 4-hour response SLA"
  ]'::jsonb,
  'Get Started',
  'https://www.clearpathsecure.com/contact',
  2,
  null
),
(
  'enterprise',
  'Enterprise',
  '$1,500+/month',
  'monthly',
  'Firms with 15-50 staff or complex compliance needs',
  false,
  '[
    "WISP documentation (written for you)",
    "MFA setup on all systems",
    "Microsoft 365 security hardening",
    "Encrypted backup configuration",
    "Annual risk assessment",
    "Email & phone support",
    "Quarterly backup verification",
    "Endpoint monitoring (all devices)",
    "24/7 threat monitoring & alerts",
    "Staff security awareness training",
    "Vendor compliance documentation",
    "FTC breach notification management",
    "Quarterly compliance review calls",
    "Offboarding & access revocation",
    "Priority 4-hour response SLA",
    "vCISO (virtual security officer)",
    "SOC 2 readiness preparation",
    "Multi-location support",
    "FDCPA/FCRA audit trail systems",
    "Custom incident response planning",
    "Insurance documentation support",
    "Dedicated account manager",
    "2-hour priority SLA"
  ]'::jsonb,
  'Contact for Pricing',
  'https://www.clearpathsecure.com/contact',
  3,
  'No fixed price beyond $1,500 -- treat as requiring a manual quote. Generated proposal narrative should not assert a specific number for this plan.'
);
