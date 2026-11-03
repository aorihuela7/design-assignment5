// The worker's decisions, with no network and no database, so a test can run them on
// a saved adsb.fi response (logic.test.ts). index.ts does the fetching and writing.
// The rules are the ones in docs/data-flow.md.

// Aircraft within this many nautical miles of the airport count.
export const RADIUS_NM = 30;
// Fetches in a row an aircraft can be missing before its row is deleted: ground
// coverage drops aircraft for a moment, and they shouldn't flicker off the board.
export const MISSED_TO_DELETE = 2;
// A position older than this (seconds) isn't live any more.
export const MAX_POSITION_AGE_S = 60;
// A quiet airport's row is still rewritten this often, so the page knows it's live.
export const HEARTBEAT_MS = 30_000;
// Airports one run checks at most, and how many always fit in its 10 seconds
// (1.1 s apart, plus each fetch). Beyond that, the rest wait for the next run.
export const MAX_PER_RUN = 10;
export const SURE_PER_RUN = 5;

// The fields we read from one aircraft in adsb.fi's response (readsb's format).
export type AdsbAircraft = {
  hex?: unknown;
  flight?: unknown; // callsign, padded to 8 characters
  t?: unknown; // type, e.g. "B744"
  alt_baro?: unknown; // feet, or "ground"
  alt_geom?: unknown; // feet
  gs?: unknown; // knots
  baro_rate?: unknown; // feet per minute
  geom_rate?: unknown;
  dst?: unknown; // nautical miles from the point asked about
  dir?: unknown; // degrees: its direction from the point asked about
  track?: unknown; // degrees: the direction it's moving
  seen_pos?: unknown; // seconds since the last position
};

export type Status = "on_ground" | "climbing" | "descending" | "level";

// A row of public.aircraft.
export type AircraftRow = {
  airport_code: string;
  hex: string;
  callsign: string | null;
  type: string | null;
  altitude_ft: number | null;
  speed_kt: number | null;
  vertical_rate_fpm: number | null;
  distance_nm: number;
  bearing_deg: number | null;
  track_deg: number | null;
  status: Status;
  seen_at: string;
  missed_runs: number;
};

// A row of public.airport_updates.
export type AirportUpdate = {
  airport_code: string;
  checked_at: string;
  ok: boolean;
  error: string | null;
  aircraft_count: number;
  changed: number;
};

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const text = (value: unknown, max: number) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.slice(0, max) : null;
};

// What the aircraft is doing, as its transponder reports it: on the ground, climbing
// or descending by more than 300 ft a minute, or level (passing over).
export function statusOf(altitudeFt: number | null, rateFpm: number | null): Status {
  if (altitudeFt === null) return "on_ground";
  if (rateFpm !== null && rateFpm > 300) return "climbing";
  if (rateFpm !== null && rateFpm < -300) return "descending";
  return "level";
}

// An angle in degrees, 0 up to (not including) 360, to 1 decimal; null if missing.
const angle = (value: unknown) => {
  const degrees = num(value);
  if (degrees === null) return null;
  const rounded = Math.round((((degrees % 360) + 360) % 360) * 10) / 10;
  return rounded === 360 ? 0 : rounded;
};

// One aircraft from adsb.fi as a row, or null when it shouldn't be on the board: no
// valid address, too far, no recent position, or in the air with no altitude.
export function toRow(airportCode: string, aircraft: AdsbAircraft, nowMs: number): AircraftRow | null {
  const hex = typeof aircraft.hex === "string" ? aircraft.hex.toLowerCase() : "";
  if (!/^~?[0-9a-f]{6}$/.test(hex)) return null;
  const distance = num(aircraft.dst);
  const positionAge = num(aircraft.seen_pos);
  if (distance === null || distance > RADIUS_NM || positionAge === null || positionAge > MAX_POSITION_AGE_S) return null;
  const onGround = aircraft.alt_baro === "ground";
  const altitude = onGround ? null : (num(aircraft.alt_baro) ?? num(aircraft.alt_geom));
  if (!onGround && altitude === null) return null;
  const rate = num(aircraft.baro_rate) ?? num(aircraft.geom_rate);
  const speed = num(aircraft.gs);
  const altitudeFt = altitude === null ? null : Math.round(altitude);
  const rateFpm = onGround || rate === null ? null : Math.round(rate);
  return {
    airport_code: airportCode,
    hex,
    callsign: text(aircraft.flight, 8),
    type: text(aircraft.t, 4),
    altitude_ft: altitudeFt,
    speed_kt: speed === null ? null : Math.round(speed),
    vertical_rate_fpm: rateFpm,
    distance_nm: Math.round(distance * 10) / 10,
    bearing_deg: angle(aircraft.dir),
    track_deg: angle(aircraft.track),
    status: statusOf(altitudeFt, rateFpm),
    seen_at: new Date(nowMs - positionAge * 1000).toISOString(),
    missed_runs: 0,
  };
}

// What the board and its radar show of a row, rounded as they show it: when this is
// the same, the aircraft hasn't "changed enough" to write.
function shown(row: AircraftRow) {
  const round = (value: number | null, step: number) => (value === null ? null : Math.round(value / step));
  return JSON.stringify([
    row.status,
    row.callsign,
    row.type,
    round(row.altitude_ft, 100),
    round(row.speed_kt, 10),
    round(row.distance_nm, 0.5),
    round(row.bearing_deg, 5),
    round(row.track_deg, 15),
  ]);
}

export type AirportPlan = { upserts: AircraftRow[]; deletes: string[]; update: AirportUpdate };

// One airport's check: what to write and delete, given the rows saved last time and
// the aircraft adsb.fi returned. fetched is null when the check failed: nothing is
// written or deleted, and the airport's row says why.
export function planAirport(
  airportCode: string,
  previous: AircraftRow[],
  fetched: AdsbAircraft[] | null,
  nowMs: number,
  error: string | null = null,
): AirportPlan {
  const checkedAt = new Date(nowMs).toISOString();
  if (fetched === null) {
    return {
      upserts: [],
      deletes: [],
      update: { airport_code: airportCode, checked_at: checkedAt, ok: false, error: error ?? "failed", aircraft_count: previous.length, changed: 0 },
    };
  }
  const current = new Map<string, AircraftRow>();
  for (const aircraft of fetched) {
    const row = toRow(airportCode, aircraft, nowMs);
    if (row) current.set(row.hex, row);
  }
  const before = new Map(previous.map((row) => [row.hex, row]));
  const upserts: AircraftRow[] = [];
  const deletes: string[] = [];
  for (const row of current.values()) {
    const old = before.get(row.hex);
    // New, back after being missed, or showing something different.
    if (!old || old.missed_runs > 0 || shown(old) !== shown(row)) upserts.push(row);
  }
  let kept = current.size;
  for (const old of previous) {
    if (current.has(old.hex)) continue;
    const missed = old.missed_runs + 1;
    if (missed >= MISSED_TO_DELETE) {
      deletes.push(old.hex);
    } else {
      upserts.push({ ...old, missed_runs: missed });
      kept += 1;
    }
  }
  return {
    upserts,
    deletes,
    update: { airport_code: airportCode, checked_at: checkedAt, ok: true, error: null, aircraft_count: kept, changed: upserts.length + deletes.length },
  };
}

// Whether to write the airport's row this time. Always when something changed or the
// check's result did; a quiet airport only every 30 s (the heartbeat), to keep
// Realtime messages down. When some airports may not fit in a run (rotating), always,
// because checked_at decides which go first next time.
export function shouldWriteUpdate(previous: AirportUpdate | null, next: AirportUpdate, rotating: boolean) {
  if (!previous || rotating || next.changed > 0) return true;
  if (previous.ok !== next.ok || previous.error !== next.error || previous.aircraft_count !== next.aircraft_count) return true;
  return Date.parse(next.checked_at) - Date.parse(previous.checked_at) >= HEARTBEAT_MS;
}

// Which airports to check this run: the ones checked longest ago first (never
// checked, first of all), up to MAX_PER_RUN. Unknown codes are left out. all is every
// followed airport this run knows, to clean up the rest.
export function airportsToCheck(followed: string[], known: Set<string>, lastChecked: Map<string, string>) {
  const all = [...new Set(followed)].filter((code) => known.has(code));
  const order = [...all].sort((a, b) => (lastChecked.get(a) ?? "").localeCompare(lastChecked.get(b) ?? "") || a.localeCompare(b));
  return { codes: order.slice(0, MAX_PER_RUN), rotating: all.length > SURE_PER_RUN, all };
}
