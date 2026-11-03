-- Run by hand in the SQL Editor on 3 Nov 2026, so it isn't in Supabase's migration
-- history.
--
-- Contract, the second half of expand then contract (after
-- 20261103220000_aircraft_status_expand_and_radar_angles.sql): the worker now writes
-- only the new statuses, so any row left with an old name is renamed, and the check
-- accepts only climbing, descending, on_ground and level. In one transaction, so the
-- check never sees an old name and nothing sees a table without a check.
begin;

update public.aircraft
set status = case status
  when 'departing' then 'climbing'
  when 'arriving' then 'descending'
  when 'overflying' then 'level'
end
where status in ('departing', 'arriving', 'overflying');

alter table public.aircraft drop constraint aircraft_status_check;
alter table public.aircraft add constraint aircraft_status_check
  check (status in ('on_ground', 'climbing', 'descending', 'level'));

commit;
