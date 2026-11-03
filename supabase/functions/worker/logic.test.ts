// The worker's rules, run on two real adsb.fi responses for O'Hare, saved 3 minutes
// apart on 3 Nov 2026 (fixtures/ord-1.json at 07:51:24 UTC, ord-2.json at 07:54:24).
// Node's own test runner, no package: npm run test:worker.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  airportsToCheck,
  planAirport,
  shouldWriteUpdate,
  statusOf,
  type AdsbAircraft,
  type AircraftRow,
  type AirportPlan,
  type AirportUpdate,
} from "./logic.ts";

type Response = { now: number; ac: AdsbAircraft[] };
const fixture = (name: string): Response =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const first = fixture("ord-1.json");
const second = fixture("ord-2.json");

// The rows saved after a check: what was there, plus its upserts, minus its deletes.
function apply(previous: AircraftRow[], plan: AirportPlan): AircraftRow[] {
  const rows = new Map(previous.map((row) => [row.hex, row]));
  for (const row of plan.upserts) rows.set(row.hex, row);
  for (const hex of plan.deletes) rows.delete(hex);
  return [...rows.values()];
}
const hexes = (rows: { hex: string }[]) => rows.map((row) => row.hex).sort();

test("the status rule: on the ground, climbing, descending, level", () => {
  assert.equal(statusOf(null, null), "on_ground");
  assert.equal(statusOf(1_350, 3_456), "climbing");
  assert.equal(statusOf(4_100, -832), "descending");
  assert.equal(statusOf(16_025, 1_984), "climbing"); // at any height
  assert.equal(statusOf(5_975, 64), "level"); // under 300 ft a minute either way
  assert.equal(statusOf(37_000, -300), "level");
  assert.equal(statusOf(37_000, -301), "descending");
  assert.equal(statusOf(2_000, null), "level"); // no rate reported

  const statuses = Object.fromEntries(planAirport("ORD", [], first.ac, first.now).upserts.map((row) => [row.callsign ?? row.hex, row.status]));
  assert.deepEqual(statuses, {
    AFR6733: "climbing", // 1,350 ft, +3,456 ft/min
    GTX508: "climbing", // 2,600 ft, +1,152 ft/min
    YZR7451: "descending", // 4,100 ft, −832 ft/min
    LBQ650: "level", // 5,975 ft, +64 ft/min
    AMX689: "climbing", // 14,200 ft, +2,560 ft/min
    GTI9013: "climbing", // 16,025 ft, +1,984 ft/min
    AAL2409: "on_ground",
    a0b826: "on_ground", // no callsign
    ac4a44: "on_ground",
  });
});

test("the first check writes every aircraft on the board, with units as saved", () => {
  const plan = planAirport("ORD", [], first.ac, first.now);
  assert.equal(plan.upserts.length, 9);
  assert.deepEqual(plan.deletes, []);
  assert.deepEqual(plan.update, {
    airport_code: "ORD",
    checked_at: new Date(first.now).toISOString(),
    ok: true,
    error: null,
    aircraft_count: 9,
    changed: 9,
  });
  const afr = plan.upserts.find((row) => row.callsign === "AFR6733")!;
  assert.equal(afr.altitude_ft, 1_350); // feet
  assert.equal(afr.speed_kt, 182); // knots, rounded
  assert.equal(afr.vertical_rate_fpm, 3_456); // feet per minute
  assert.equal(afr.distance_nm, 0.8); // nautical miles, 1 decimal
  assert.equal(afr.bearing_deg, 125.3); // its direction from the airport, for the radar
  assert.equal(afr.track_deg, 86.9); // the direction it’s moving, as adsb.fi sent it
  const parked = plan.upserts.find((row) => row.callsign === "AAL2409")!;
  assert.equal(parked.altitude_ft, null); // "ground"
  assert.equal(parked.vertical_rate_fpm, null);
});

test("aircraft that haven't changed aren't written again", () => {
  const saved = apply([], planAirport("ORD", [], first.ac, first.now));
  // The same response 10 s later: nothing the board shows is different.
  const again = planAirport("ORD", saved, first.ac, first.now + 10_000);
  assert.deepEqual(again.upserts, []);
  assert.deepEqual(again.deletes, []);
  assert.equal(again.update.changed, 0);

  // 3 minutes later the two parked aircraft show the same, so they aren't written.
  const later = planAirport("ORD", saved, second.ac, second.now);
  const written = hexes(later.upserts);
  assert.ok(!written.includes("a0b826"), "parked A321neo, no callsign");
  assert.ok(!written.includes("ab4ea8"), "parked AAL2409");
  // The moving ones and the new one are.
  for (const hex of ["3951c1", "781273", "a05087", "a91e9a", "8990a6"]) assert.ok(written.includes(hex), hex);
});

test("a change smaller than the board shows isn't written; a bigger one is", () => {
  const saved = apply([], planAirport("ORD", [], first.ac, first.now));
  const nudged = (feet: number) =>
    first.ac.map((aircraft) => (aircraft.hex === "a4c02d" ? { ...aircraft, alt_baro: 16_025 + feet } : aircraft));
  assert.deepEqual(planAirport("ORD", saved, nudged(20), first.now + 10_000).upserts, []); // 16,045 ft: still "16,000"
  assert.deepEqual(hexes(planAirport("ORD", saved, nudged(100), first.now + 10_000).upserts), ["a4c02d"]); // 16,125 ft
});

test("aircraft no longer seen are kept for one check, then deleted", () => {
  const saved = apply([], planAirport("ORD", [], first.ac, first.now));
  // AMX689 and GTI9013 flew past 30 NM; ground coverage lost the taxiing ac4a44.
  const gone = ["a01820", "a4c02d", "ac4a44"];

  const once = planAirport("ORD", saved, second.ac, second.now);
  assert.deepEqual(once.deletes, []);
  for (const hex of gone) assert.equal(once.upserts.find((row) => row.hex === hex)?.missed_runs, 1, hex);
  assert.equal(once.update.aircraft_count, 10); // the 7 seen, and the 3 missed once

  const afterOnce = apply(saved, once);
  const twice = planAirport("ORD", afterOnce, second.ac, second.now + 10_000);
  assert.deepEqual(twice.deletes.sort(), gone);
  assert.deepEqual(twice.upserts, []);
  assert.equal(twice.update.aircraft_count, 7);
  assert.equal(twice.update.changed, 3);
  assert.deepEqual(hexes(apply(afterOnce, twice)), hexes(second.ac));
});

test("a failed fetch is recorded for that airport and changes nothing else", () => {
  const saved = apply([], planAirport("ORD", [], first.ac, first.now));
  const failed = planAirport("ORD", saved, null, second.now, "429");
  assert.deepEqual(failed.upserts, []);
  assert.deepEqual(failed.deletes, []); // the board keeps the last aircraft it had
  assert.deepEqual(failed.update, {
    airport_code: "ORD",
    checked_at: new Date(second.now).toISOString(),
    ok: false,
    error: "429",
    aircraft_count: 9,
    changed: 0,
  });
  assert.equal(planAirport("ORD", saved, null, second.now, "timeout").update.error, "timeout");
});

test("a quiet airport's row is written only every 30 s, unless airports rotate", () => {
  const at = (ms: number, changes: Partial<AirportUpdate> = {}): AirportUpdate => ({
    airport_code: "ORD",
    checked_at: new Date(first.now + ms).toISOString(),
    ok: true,
    error: null,
    aircraft_count: 9,
    changed: 0,
    ...changes,
  });
  assert.equal(shouldWriteUpdate(null, at(0), false), true); // first time
  assert.equal(shouldWriteUpdate(at(0), at(10_000), false), false); // quiet, 10 s later
  assert.equal(shouldWriteUpdate(at(0), at(30_000), false), true); // the heartbeat
  assert.equal(shouldWriteUpdate(at(0), at(10_000, { changed: 2 }), false), true);
  assert.equal(shouldWriteUpdate(at(0), at(10_000, { ok: false, error: "timeout" }), false), true);
  assert.equal(shouldWriteUpdate(at(0), at(10_000), true), true); // rotating: checked_at orders them
});

test("airports are checked longest-ago first, known ones only, at most 10 a run", () => {
  const known = new Set(["ORD", "JFK", "LHR", "MAD", "CDG", "AMS", "FRA", "SIN", "HND", "SYD", "DXB", "LAX"]);
  const checked = new Map([
    ["ORD", "2026-11-03T08:00:20Z"],
    ["JFK", "2026-11-03T08:00:10Z"],
  ]);
  const few = airportsToCheck(["ORD", "JFK", "ORD", "XXX", "MAD"], known, checked);
  assert.deepEqual(few.codes, ["MAD", "JFK", "ORD"]); // never checked, then oldest; ORD once; XXX unknown
  assert.equal(few.rotating, false);

  const many = airportsToCheck([...known], known, checked);
  assert.equal(many.codes.length, 10);
  assert.equal(many.rotating, true);
  // The 10 never checked go first; JFK and ORD, checked most recently, wait for the next run.
  assert.ok(!many.codes.includes("JFK") && !many.codes.includes("ORD"));
});
