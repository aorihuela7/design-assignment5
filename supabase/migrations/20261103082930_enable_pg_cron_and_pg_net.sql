-- The Live board's worker: Supabase Cron (pg_cron) runs it every minute, and pg_net
-- lets that job call the worker's Edge Function over HTTP. Additive only: nothing on
-- trips, items or profiles, or their policies, changes, so Assignment 4's app is
-- unaffected. "if not exists": applying it again does nothing.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
