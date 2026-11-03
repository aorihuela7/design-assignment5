-- Run by hand in the SQL Editor on 3 Nov 2026, so it isn't in Supabase's migration
-- history. Written down here from the database's own definitions afterwards. The MCP
-- refused to run it, because it drops a constraint.
--
-- Expand, the first half of expand then contract, on aircraft only: the statuses
-- become what the aircraft is doing (climbing, descending, on_ground, level), and
-- for now the check accepts both the old names and the new, so the worker that
-- writes the old ones keeps working until the new worker is deployed. The contract
-- half (20261103221000_aircraft_status_contract.sql) then accepts only the new ones.
-- Two angles also let the Live board draw a radar.
alter table public.aircraft drop constraint aircraft_status_check;
alter table public.aircraft add constraint aircraft_status_check check (
  status in ('on_ground', 'climbing', 'descending', 'level', 'departing', 'arriving', 'overflying')
);

alter table public.aircraft
  -- Degrees: the aircraft's direction from the airport (adsb.fi's dir), and the
  -- direction it's moving (track). Null when adsb.fi doesn't send them.
  add column bearing_deg real check (bearing_deg >= 0 and bearing_deg < 360),
  add column track_deg real check (track_deg >= 0 and track_deg < 360);
