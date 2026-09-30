-- Retry tracking and safe concurrent-claim support for scheduled_sends.
-- Per Vercel's cron docs, delivery is "best effort" and can invoke the same
-- scheduled run more than once, or occasionally skip one -- the new
-- 'processing' status lets the dispatch route atomically claim a row
-- (UPDATE ... SET status = 'processing' WHERE status = 'pending' ...
-- RETURNING) before sending, so two overlapping invocations can't both
-- email the same document.

alter type public.send_status add value if not exists 'processing';

alter table public.scheduled_sends
  add column attempts integer not null default 0,
  add column last_attempted_at timestamptz;

comment on column public.scheduled_sends.attempts is
  'Failed send attempts. After hitting the cap enforced by the cron dispatch route (not the DB), status is set to failed and the row is left for manual review rather than retried again.';
