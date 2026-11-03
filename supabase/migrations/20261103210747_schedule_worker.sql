-- Supabase Cron runs the Live board's worker every 10 seconds (docs/data-flow.md).
-- The job reads WORKER_SECRET from Vault each time it runs, so the secret is in no
-- migration, commit or log: it's set by hand, in Vault (worker_secret) and as an
-- Edge Function secret (WORKER_SECRET). The worker skips a call that comes under 8 s
-- after the last run, so a late or doubled call never doubles requests to adsb.fi.
select cron.schedule(
  'live-board-worker',
  '10 seconds',
  $$
  select net.http_post(
    url := 'https://fmitwpdmqajkvxczutwd.supabase.co/functions/v1/worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- Every 10 seconds adds a row to cron's own history: keep one day of it.
select cron.schedule(
  'clean-cron-history',
  '0 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '1 day' $$
);
