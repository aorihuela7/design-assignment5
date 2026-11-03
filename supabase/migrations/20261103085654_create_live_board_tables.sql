-- The Live board (docs/data-flow.md): who follows which airports, and the live air
-- traffic the worker saves for them. Four new tables; nothing on trips, items or
-- profiles changes, so Assignment 4's app is unaffected. Signed-out visitors (anon)
-- get nothing from any of them.

-- Follows: one row per person and airport they follow, at most 3 each.
create table public.follows (
  user_id text not null default (auth.jwt() ->> 'sub'),
  -- An IATA code from the app's curated list (src/lib/airports.ts); the worker
  -- ignores any code it doesn't know.
  airport_code text not null check (airport_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, airport_code)
);

-- At most 3 follows per person, checked in the database too, not only in the app.
-- The lock makes two follows sent at once by the same person count one after the
-- other, so neither can slip past the limit.
create function public.follows_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('follows:' || new.user_id));
  if (select count(*) from public.follows where user_id = new.user_id) >= 3 then
    raise exception 'You can follow up to 3 airports' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger follows_limit
  before insert on public.follows
  for each row execute function public.follows_limit();

alter table public.follows enable row level security;

-- Select, insert and delete only: a follow has nothing to edit.
revoke all on table public.follows from anon, authenticated;
grant select, insert, delete on table public.follows to authenticated;

create policy "Select own follows" on public.follows
  for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Insert own follows" on public.follows
  for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "Delete own follows" on public.follows
  for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- Aircraft: one row per aircraft within 30 NM of a followed airport, as the worker
-- last wrote it. Nobody's data: any signed-in person can read it; only the worker
-- (the secret key, which bypasses RLS) writes.
create table public.aircraft (
  airport_code text not null check (airport_code ~ '^[A-Z]{3}$'),
  -- The transponder's address, adsb.fi's hex ("~" first for a non-ICAO address).
  hex text not null check (hex ~ '^~?[0-9a-f]{6}$'),
  callsign text check (char_length(callsign) <= 8),
  type text check (char_length(type) <= 4),
  -- Feet; null on the ground.
  altitude_ft integer,
  speed_kt integer,
  vertical_rate_fpm integer,
  distance_nm numeric(4, 1) not null,
  -- A guess from the aircraft's own data, not flight status (docs/data-flow.md).
  status text not null check (status in ('on_ground', 'departing', 'arriving', 'overflying')),
  -- When adsb.fi last saw what this row shows.
  seen_at timestamptz not null,
  -- Fetches in a row this aircraft wasn't in; deleted at 2.
  missed_runs smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (airport_code, hex)
);

-- Airport updates: one row per followed airport, written on every check of it.
-- The page listens to this table through Realtime, and reads its state from it.
create table public.airport_updates (
  airport_code text primary key check (airport_code ~ '^[A-Z]{3}$'),
  -- The last check, whether it worked, and why not ("429", "timeout").
  checked_at timestamptz not null,
  ok boolean not null,
  error text check (char_length(error) <= 100),
  aircraft_count integer not null default 0,
  -- Aircraft rows written or deleted by that check; the page refetches when > 0.
  changed integer not null default 0
);

-- Worker runs: one row per run, kept 24 hours. The error is short and never holds a
-- secret.
create table public.worker_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  duration_ms integer not null,
  airports integer not null default 0,
  airports_failed integer not null default 0,
  rows_changed integer not null default 0,
  ok boolean not null,
  error text check (char_length(error) <= 200)
);

create index worker_runs_started_at on public.worker_runs (started_at);

-- The same rules on all three: signed-in people read, nobody writes but the worker.
alter table public.aircraft enable row level security;
alter table public.airport_updates enable row level security;
alter table public.worker_runs enable row level security;

revoke all on table public.aircraft, public.airport_updates, public.worker_runs from anon, authenticated;
grant select on table public.aircraft, public.airport_updates, public.worker_runs to authenticated;

create policy "Signed-in people read aircraft" on public.aircraft
  for select to authenticated using (true);

create policy "Signed-in people read airport updates" on public.airport_updates
  for select to authenticated using (true);

create policy "Signed-in people read worker runs" on public.worker_runs
  for select to authenticated using (true);

-- Realtime sends airport_updates changes to the page. It checks the select grant
-- and policy above for each subscriber, so signed-out visitors get no messages.
-- aircraft isn't added: one aircraft never sends a message of its own.
alter publication supabase_realtime add table public.airport_updates;
