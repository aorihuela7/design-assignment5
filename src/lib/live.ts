import { useAuth } from "@clerk/nextjs";
import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseClient } from "./supabase";

// The Live board's data (docs/data-flow.md): the person's follows, each followed
// airport's last check (airport_updates) and its aircraft. Realtime sends only
// airport_updates changes, for the followed airports; an airport's aircraft are read
// again only when that check changed something.

export const MAX_FOLLOWS = 3;
export const RADIUS_NM = 30;
// A quiet airport's row is rewritten every 30 s (the worker's heartbeat), so with a
// run every 10 s it reaches about 40 s old; a minute leaves room for a late run.
// Older than this, it's late (docs/data-flow.md).
export const STALE_AFTER_MS = 60_000;
// Two minutes with no check: the worker has stopped, or can't reach adsb.fi.
export const DOWN_AFTER_MS = 120_000;

export type AircraftStatus = "on_ground" | "climbing" | "descending" | "level";

export type LiveAircraft = {
  hex: string;
  callsign: string | null;
  type: string | null;
  altitude_ft: number | null;
  speed_kt: number | null;
  distance_nm: number;
  bearing_deg: number | null;
  track_deg: number | null;
  status: AircraftStatus;
};

export type AirportCheck = {
  airport_code: string;
  checked_at: string;
  ok: boolean;
  error: string | null;
  aircraft_count: number;
  changed: number;
};

// "connecting" until Realtime first answers; "reconnecting" after it drops.
export type Connection = "connecting" | "live" | "reconnecting";

export type FollowResult = "saved" | "limit" | "already" | "failed";

export type LiveBoardState = {
  status: "loading" | "failed" | "ready";
  follows: string[];
  checks: Record<string, AirportCheck>;
  aircraft: Record<string, LiveAircraft[]>;
  connection: Connection;
  // Supabase's clock minus the device's, from response headers.
  clockOffsetMs: number;
};

const AIRCRAFT_COLUMNS = "hex, callsign, type, altitude_ft, speed_kt, distance_nm, bearing_deg, track_deg, status";
const CHECK_COLUMNS = "airport_code, checked_at, ok, error, aircraft_count, changed";

// Development only: add ?live=stale or ?live=down to the page's address to see an
// airport late or down. Production builds replace process.env.NODE_ENV with
// "production", so this is always null there and the code is left out of the build.
export function previewState(): "stale" | "down" | null {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("live");
  return value === "stale" || value === "down" ? value : null;
}

export type AirportState =
  | { kind: "waiting" }
  | { kind: "fresh"; ageMs: number }
  | { kind: "empty"; ageMs: number }
  | { kind: "stale"; ageMs: number }
  | { kind: "down"; ageMs: number; reason: "failed" | "no checks" };

// What an airport's panel shows, from its last check and Supabase's time now.
export function airportState(check: AirportCheck | undefined, serverNowMs: number, preview = previewState()): AirportState {
  if (!check) return { kind: "waiting" };
  const ageMs = Math.max(0, serverNowMs - Date.parse(check.checked_at));
  if (preview === "down" || !check.ok) return { kind: "down", ageMs, reason: "failed" };
  if (ageMs > DOWN_AFTER_MS) return { kind: "down", ageMs, reason: "no checks" };
  if (preview === "stale") return { kind: "stale", ageMs: ageMs + STALE_AFTER_MS };
  if (ageMs > STALE_AFTER_MS) return { kind: "stale", ageMs };
  return check.aircraft_count === 0 ? { kind: "empty", ageMs } : { kind: "fresh", ageMs };
}

// Descending and climbing first (on their way in or out), then on the ground, then
// passing over; nearest first.
export const STATUS_ORDER: AircraftStatus[] = ["descending", "climbing", "on_ground", "level"];
export function boardOrder(aircraft: LiveAircraft[]) {
  return [...aircraft].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.distance_nm - b.distance_nm);
}

// One client per signed-in person, kept while the tab is open, like the trips' own.
// It asks Clerk for the latest token each time, and passes on Supabase's clock.
let client: { userId: string; db: SupabaseClient } | null = null;
let latestGetToken: () => Promise<string | null> = async () => null;
let hearClock: ((offsetMs: number) => void) | null = null;

function clientFor(userId: string, getToken: () => Promise<string | null>) {
  latestGetToken = getToken;
  if (client?.userId !== userId) {
    client = {
      userId,
      db: createSupabaseClient(
        () => latestGetToken(),
        (serverMs) => hearClock?.(serverMs - Date.now()),
      ),
    };
  }
  return client.db;
}

export function useLiveBoard() {
  const { userId, getToken } = useAuth();
  useEffect(() => {
    latestGetToken = getToken;
  }, [getToken]);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  useEffect(() => {
    // Only a real change re-renders: the header has whole seconds.
    hearClock = (offset) => setClockOffsetMs((current) => (Math.abs(current - offset) > 1_000 ? offset : current));
    return () => {
      hearClock = null;
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one client per person; getToken is kept up to date above
  const db = useMemo(() => (userId ? clientFor(userId, getToken) : null), [userId]);

  const [status, setStatus] = useState<LiveBoardState["status"]>("loading");
  const [follows, setFollows] = useState<string[]>([]);
  const [checks, setChecks] = useState<Record<string, AirportCheck>>({});
  const [aircraft, setAircraft] = useState<Record<string, LiveAircraft[]>>({});
  const [connection, setConnection] = useState<Connection>("connecting");
  const [attempt, setAttempt] = useState(0);

  const fetchAircraft = useCallback(
    async (codes: string[]) => {
      if (!db || codes.length === 0) return;
      const { data, error } = await db.from("aircraft").select(`airport_code, ${AIRCRAFT_COLUMNS}`).in("airport_code", codes);
      if (error) return; // the last aircraft stay; the next change tries again
      const byAirport: Record<string, LiveAircraft[]> = Object.fromEntries(codes.map((code) => [code, []]));
      for (const { airport_code, ...row } of data as (LiveAircraft & { airport_code: string })[]) byAirport[airport_code]?.push(row);
      setAircraft((current) => ({ ...current, ...byAirport }));
    },
    [db],
  );

  const fetchChecks = useCallback(
    async (codes: string[]) => {
      if (!db || codes.length === 0) return;
      const { data, error } = await db.from("airport_updates").select(CHECK_COLUMNS).in("airport_code", codes);
      if (error) return;
      setChecks((current) => ({ ...current, ...Object.fromEntries((data as AirportCheck[]).map((check) => [check.airport_code, check])) }));
    },
    [db],
  );

  const load = useCallback(async () => {
    if (!db) return;
    setStatus("loading");
    const { data, error } = await db.from("follows").select("airport_code").order("created_at");
    if (error) {
      setStatus("failed");
      return;
    }
    const codes = data.map((row: { airport_code: string }) => row.airport_code);
    await Promise.all([fetchChecks(codes), fetchAircraft(codes)]);
    setFollows(codes);
    setStatus("ready");
  }, [db, fetchAircraft, fetchChecks]);

  useEffect(() => {
    // Loading is what this effect is for: it reads the person's follows from Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // A dropped connection shows straight away: the browser says when it goes offline,
  // and Realtime's heartbeat (every 25 s) when the socket stops answering. Back
  // online, a new channel is made (attempt), which catches up when it's subscribed.
  useEffect(() => {
    if (!db) return;
    const lost = () => setConnection("reconnecting");
    const found = () => setAttempt((n) => n + 1);
    window.addEventListener("offline", lost);
    window.addEventListener("online", found);
    db.realtime.onHeartbeat((status) => {
      if (status === "timeout" || status === "error") lost();
    });
    return () => {
      window.removeEventListener("offline", lost);
      window.removeEventListener("online", found);
      db.realtime.onHeartbeat(() => {});
    };
  }, [db]);

  // Realtime: only airport_updates, only the followed airports. A new subscription
  // whenever the follows change, or after a drop (attempt).
  const followKey = follows.join(",");
  useEffect(() => {
    if (!db || status !== "ready" || followKey === "") return;
    const codes = followKey.split(",");
    let closing = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const channel = db
      .channel(`live-board-${followKey}-${attempt}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "airport_updates", filter: `airport_code=in.(${followKey})` },
        (payload: RealtimePostgresChangesPayload<AirportCheck>) => {
          if (payload.eventType === "DELETE") return;
          const check = payload.new;
          setChecks((current) => {
            const before = current[check.airport_code];
            // Read the aircraft again only when the check changed them, or came back.
            if (check.changed > 0 || !before || (!before.ok && check.ok)) void fetchAircraft([check.airport_code]);
            return { ...current, [check.airport_code]: check };
          });
        },
      )
      .subscribe((state) => {
        if (closing) return;
        if (state === "SUBSCRIBED") {
          setConnection((before) => {
            // Back after a drop: catch up on what happened meanwhile.
            if (before === "reconnecting") void Promise.all([fetchChecks(codes), fetchAircraft(codes)]);
            return "live";
          });
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setConnection("reconnecting");
          // Try again with a new channel, waiting longer each time, up to 30 s.
          retry = setTimeout(() => setAttempt((n) => n + 1), Math.min(30_000, 2_000 * 2 ** Math.min(attempt, 4)));
        }
      });
    return () => {
      closing = true;
      clearTimeout(retry);
      void db.removeChannel(channel);
    };
  }, [db, status, followKey, attempt, fetchAircraft, fetchChecks]);

  const follow = useCallback(
    async (code: string): Promise<FollowResult> => {
      if (!db) return "failed";
      if (follows.includes(code)) return "already";
      if (follows.length >= MAX_FOLLOWS) return "limit";
      const { error } = await db.from("follows").insert({ airport_code: code });
      // The database's own checks: the 3-airport trigger, and one follow per airport.
      if (error?.code === "23514") return "limit";
      if (error?.code === "23505") return "already";
      if (error) return "failed";
      setFollows((current) => [...current, code]);
      void Promise.all([fetchChecks([code]), fetchAircraft([code])]);
      return "saved";
    },
    [db, follows, fetchAircraft, fetchChecks],
  );

  const unfollow = useCallback(
    async (code: string) => {
      if (!db) return false;
      const { error } = await db.from("follows").delete().eq("airport_code", code);
      if (error) return false;
      setFollows((current) => current.filter((followed) => followed !== code));
      return true;
    },
    [db],
  );

  const state: LiveBoardState = { status, follows, checks, aircraft, connection, clockOffsetMs };
  return { ...state, follow, unfollow, reload: load };
}

// Supabase's time now, ticking every second, for "Updated 12 s ago". Null until the
// page is in the browser, so the server and the first render agree.
export function useServerNow(clockOffsetMs: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now() + clockOffsetMs);
    tick();
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [clockOffsetMs]);
  return now;
}

// "12 s ago", "3 min ago".
export function ago(ms: number) {
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) return `${seconds} s ago`;
  return `${Math.floor(seconds / 60)} min ago`;
}
