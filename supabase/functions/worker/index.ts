// The Live board's worker (docs/data-flow.md). Supabase Cron calls it every 10
// seconds with WORKER_SECRET; each run checks the airports people follow on adsb.fi
// and writes only what changed. It writes with the secret key Supabase provides to
// its own Edge Functions (SUPABASE_SECRET_KEYS), which never leaves Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
import { AIRPORTS } from "./airports.ts";
import {
  airportsToCheck,
  planAirport,
  RADIUS_NM,
  shouldWriteUpdate,
  type AdsbAircraft,
  type AircraftRow,
  type AirportUpdate,
} from "./logic.ts";

// adsb.fi allows 1 request per second from an IP, and Supabase's is shared.
const SPACING_MS = 1_100;
const FETCH_TIMEOUT_MS = 3_000;
// No new airport is started after this, so a run ends before the next one starts.
const START_BUDGET_MS = 5_500;
// Two calls closer together than this (a retry, a double schedule) run only once.
const MIN_INTERVAL_MS = 8_000;
const KEEP_RUNS_MS = 24 * 60 * 60 * 1000;

const known = new Map(AIRPORTS.map((airport) => [airport.code, airport]));

// The same length and every character compared, so the time taken says nothing.
function sameSecret(given: string, expected: string) {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < given.length; i++) difference |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One airport from adsb.fi: its aircraft, or a short reason it failed (never a URL,
// header or key).
async function fetchAirport(latitude: number, longitude: number): Promise<{ aircraft: AdsbAircraft[] } | { error: string }> {
  const url = `https://opendata.adsb.fi/api/v3/lat/${latitude}/lon/${longitude}/dist/${RADIUS_NM}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (response.status === 429) return { error: "429" };
    if (!response.ok) return { error: `http ${response.status}` };
    const body = await response.json();
    if (!body || !Array.isArray(body.ac)) return { error: "bad response" };
    return { aircraft: body.ac };
  } catch (error) {
    return { error: error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network" };
  }
}

Deno.serve(async (request) => {
  const expected = Deno.env.get("WORKER_SECRET");
  if (!expected) return Response.json({ error: "WORKER_SECRET isn't set" }, { status: 503 });
  if (!sameSecret(request.headers.get("x-worker-secret") ?? "", expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const secretKey = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, { auth: { persistSession: false } });

  // A run already started under 8 s ago: this call does nothing.
  const { data: recent } = await db
    .from("worker_runs")
    .select("id")
    .gte("started_at", new Date(started - MIN_INTERVAL_MS).toISOString())
    .limit(1);
  if (recent && recent.length > 0) return Response.json({ skipped: "a run started under 8 s ago" });

  // Recorded first, as running, so an overlapping call sees it and skips.
  const { data: run, error: runError } = await db
    .from("worker_runs")
    .insert({ started_at: new Date(started).toISOString(), duration_ms: 0, ok: false, error: "running" })
    .select("id")
    .single();
  if (runError || !run) return Response.json({ error: "couldn't record the run" }, { status: 500 });

  let airportsChecked = 0;
  let airportsFailed = 0;
  let rowsChanged = 0;
  const failures: string[] = [];
  let ok = true;
  let runErrorText: string | null = null;

  try {
    const [{ data: follows, error: followsError }, { data: updates, error: updatesError }] = await Promise.all([
      db.from("follows").select("airport_code"),
      db.from("airport_updates").select("*"),
    ]);
    if (followsError || updatesError) throw new Error("db read");
    const previousUpdates = new Map((updates as AirportUpdate[]).map((update) => [update.airport_code, update]));
    const { codes, rotating, all } = airportsToCheck(
      follows.map((follow: { airport_code: string }) => follow.airport_code),
      new Set(known.keys()),
      new Map([...previousUpdates].map(([code, update]) => [code, update.checked_at])),
    );

    // Airports nobody follows any more: their rows go.
    const followedList = `(${all.join(",")})`;
    const cleanAircraft = all.length ? db.from("aircraft").delete().not("airport_code", "in", followedList) : db.from("aircraft").delete().neq("airport_code", "");
    const cleanUpdates = all.length ? db.from("airport_updates").delete().not("airport_code", "in", followedList) : db.from("airport_updates").delete().neq("airport_code", "");
    await Promise.all([cleanAircraft, cleanUpdates]);

    for (const [index, code] of codes.entries()) {
      if (index > 0) {
        if (Date.now() - started > START_BUDGET_MS) break;
        await sleep(SPACING_MS);
      }
      const airport = known.get(code)!;
      const result = await fetchAirport(airport.latitude, airport.longitude);
      airportsChecked += 1;
      const { data: previous, error: previousError } = await db.from("aircraft").select("*").eq("airport_code", code);
      if (previousError) throw new Error("db read");
      const plan =
        "aircraft" in result
          ? planAirport(code, previous as AircraftRow[], result.aircraft, Date.now())
          : planAirport(code, previous as AircraftRow[], null, Date.now(), result.error);
      if (!plan.update.ok) {
        airportsFailed += 1;
        failures.push(`${code}: ${plan.update.error}`);
      }
      const now = new Date().toISOString();
      if (plan.upserts.length) {
        const { error } = await db.from("aircraft").upsert(plan.upserts.map((row) => ({ ...row, updated_at: now })));
        if (error) throw new Error("db write");
      }
      if (plan.deletes.length) {
        const { error } = await db.from("aircraft").delete().eq("airport_code", code).in("hex", plan.deletes);
        if (error) throw new Error("db write");
      }
      rowsChanged += plan.update.changed;
      if (shouldWriteUpdate(previousUpdates.get(code) ?? null, plan.update, rotating)) {
        const { error } = await db.from("airport_updates").upsert(plan.update);
        if (error) throw new Error("db write");
      }
      // After a 429, the rest wait: more requests now would count toward an IP block.
      if (!plan.update.ok && plan.update.error === "429") break;
    }
  } catch (error) {
    ok = false;
    runErrorText = error instanceof Error ? error.message : "unexpected";
  }

  const errorText = [runErrorText, ...failures].filter(Boolean).join("; ").slice(0, 200) || null;
  await db
    .from("worker_runs")
    .update({
      duration_ms: Date.now() - started,
      airports: airportsChecked,
      airports_failed: airportsFailed,
      rows_changed: rowsChanged,
      ok,
      error: errorText,
    })
    .eq("id", run.id);
  await db.from("worker_runs").delete().lt("started_at", new Date(started - KEEP_RUNS_MS).toISOString());

  return Response.json({ ok, airports: airportsChecked, failed: airportsFailed, changed: rowsChanged, error: errorText });
});
