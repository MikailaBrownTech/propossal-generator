-- Seed: ClearPath's standalone add-ons (reference data, not used by
-- proposal generation in v1 -- see public.add_ons comment context).

insert into public.add_ons
  (id, name, price_display, billing, description, cta_label, cta_url, notes)
values
(
  'wisp-standalone',
  'WISP Standalone',
  '$597',
  'one_time',
  'Written Information Security Plan written from scratch -- fully FTC and IRS Pub 4557 compliant. Delivered in 10 business days. Includes one year of updates.',
  'Get Your WISP',
  'https://www.clearpathsecure.com/contact',
  null
),
(
  'it-support-addon',
  'IT Support Add-on',
  'From $99/mo',
  'monthly',
  'Help desk, device troubleshooting, and staff support for teams not on a managed IT plan.',
  'Get Started',
  'https://www.clearpathsecure.com/contact',
  'Variable starting price -- generated content should say "starting at $99/mo", never a fixed number.'
),
(
  'website-build',
  'Website Build',
  'From $1,200',
  'one_time',
  'One-time secure website design and build. Hosting and maintenance available monthly.',
  'Get a Quote',
  'https://www.clearpathsecure.com/contact',
  'Variable starting price -- generated content should say "starting at $1,200", never a fixed number.'
),
(
  'website-maintenance',
  'Website Maintenance',
  '$79/mo',
  'monthly',
  'Monthly updates, security patches, uptime monitoring, and content changes for your website.',
  'Get Started',
  'https://www.clearpathsecure.com/contact',
  null
);
