"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorIcon } from "@/components/ErrorMessage";
import { PAGE_TITLE_ID } from "@/components/Header";
import { Notice } from "@/components/Notice";
import { Page } from "@/components/Page";
import { SectionHeading } from "@/components/SectionHeading";
import { TextLink } from "@/components/TextLink";
import { AIRPORTS, nearestAirport } from "@/lib/airports";
import { airportState, useLiveBoard, useServerNow, type AirportState } from "@/lib/live";
import { useStorage } from "@/lib/storage";
import { AirportBoard } from "./AirportBoard";
import { FollowAirports, type Suggestion } from "./FollowAirports";

const byCode = new Map(AIRPORTS.map((airport) => [airport.code, airport]));
const FOLLOW_HEADING_ID = "follow-heading";

// What a state change is called when it's announced.
const SAID: Partial<Record<AirportState["kind"], string>> = {
  fresh: "live again",
  empty: "live again, no aircraft nearby",
  stale: "live data is late",
  down: "live data is unavailable",
};

// The Live board: live air traffic near the airports the person follows, one board
// per airport, kept up to date by Realtime (docs/data-flow.md).
export function LiveBoard() {
  const live = useLiveBoard();
  const storage = useStorage();
  const serverNow = useServerNow(live.clockOffsetMs);
  const [announcement, setAnnouncement] = useState("");
  const followHeading = useRef<HTMLHeadingElement>(null);

  // Airports near the person's trip destinations, once each.
  const suggestions = useMemo<Suggestion[]>(() => {
    if (storage.status !== "ready") return [];
    const seen = new Map<string, Suggestion>();
    for (const trip of storage.trips) {
      const airport = trip.destination && nearestAirport(trip.destination);
      if (airport && trip.destination && !seen.has(airport.code)) seen.set(airport.code, { airport, place: trip.destination.name });
    }
    return [...seen.values()];
  }, [storage]);

  const states = Object.fromEntries(
    live.follows.map((code) => [code, serverNow === null ? null : airportState(live.checks[code], serverNow)]),
  );

  // Only changes are announced (late, unavailable, live again, the connection), never
  // each update or the ticking age.
  const kinds = live.follows.map((code) => `${code}:${states[code]?.kind ?? ""}`).join(",");
  const lastKinds = useRef<Map<string, string>>(new Map());
  const lastConnection = useRef(live.connection);
  useEffect(() => {
    const said: string[] = [];
    const next = new Map(kinds.split(",").filter(Boolean).map((entry) => entry.split(":") as [string, string]));
    for (const [code, kind] of next) {
      const before = lastKinds.current.get(code);
      const words = SAID[kind as AirportState["kind"]];
      // Not on arrival or a first check: only a change from one live state to another.
      if (before && before !== "waiting" && kind !== before && words && !(before === "fresh" && kind === "empty") && !(before === "empty" && kind === "fresh")) {
        said.push(`${code}: ${words}.`);
      }
    }
    lastKinds.current = next;
    if (live.connection !== lastConnection.current) {
      if (live.connection === "reconnecting") said.push("Live updates lost their connection. Reconnecting.");
      if (live.connection === "live" && lastConnection.current === "reconnecting") said.push("Live updates are back.");
      lastConnection.current = live.connection;
    }
    // The live region's text is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (said.length) setAnnouncement(said.join(" "));
  }, [kinds, live.connection]);

  async function follow(code: string) {
    const result = await live.follow(code);
    if (result === "saved") setAnnouncement(`Following ${code}. Its board appears after the first check, in about 10 seconds.`);
    return result;
  }

  async function unfollow(code: string) {
    const removed = await live.unfollow(code);
    if (removed) {
      setAnnouncement(`Stopped following ${code}.`);
      // Its board is gone: focus waits on the follow section, or the page title.
      requestAnimationFrame(() => (followHeading.current ?? document.getElementById(PAGE_TITLE_ID))?.focus());
    }
    return removed;
  }

  const ready = live.status === "ready" && serverNow !== null;

  return (
    <Page title="Live board" section="live">
      <p className="max-w-prose">Live positions from aircraft transponders. Not flight schedules.</p>

      {live.connection === "reconnecting" && (
        <p className="flex items-start gap-1.5 rounded border border-ink bg-surface p-3 text-ink">
          <ErrorIcon className="mt-1" />
          <span>Live updates lost their connection. Reconnecting… The boards show the last data until then.</span>
        </p>
      )}

      {live.status === "failed" && (
        <Notice action={<Button onClick={() => void live.reload()}>Try again</Button>}>
          We couldn’t load the airports you follow. Check your connection and try again.
        </Notice>
      )}

      {!ready && live.status !== "failed" && <LoadingBoard />}

      {ready && live.follows.length === 0 && (
        <EmptyState plane>
          <p>Follow an airport to see the aircraft around it, live. You can follow up to 3.</p>
          <FollowAirports follows={live.follows} suggestions={suggestions} onFollow={follow} />
        </EmptyState>
      )}

      {ready && live.follows.length > 0 && (
        <>
          {live.follows.map((code) => {
            const airport = byCode.get(code);
            const state = states[code];
            return airport && state ? (
              <AirportBoard
                key={code}
                airport={airport}
                state={state}
                aircraft={live.aircraft[code] ?? []}
                onUnfollow={() => unfollow(code)}
              />
            ) : null;
          })}
          <Card className="flex flex-col gap-4">
            <SectionHeading id={FOLLOW_HEADING_ID} ref={followHeading} tabIndex={-1} className="outline-none">
              Follow an airport
            </SectionHeading>
            <FollowAirports follows={live.follows} suggestions={suggestions} onFollow={follow} />
          </Card>
        </>
      )}

      <p className="text-sm text-muted">
        Aircraft data from{" "}
        <TextLink href="https://adsb.fi" inline>
          adsb.fi
        </TextLink>
        , a community network of ADS-B receivers.
      </p>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </Page>
  );
}

// While the follows load: a board's shape, with bars where the rows go.
function LoadingBoard() {
  const bar = "inline-block h-3 rounded bg-white/10 align-middle";
  return (
    <>
      <p role="status" className="sr-only">
        Loading the live board…
      </p>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <span className="h-7 w-64 max-w-full rounded bg-line/60" />
        <div className="flex flex-col gap-4 rounded bg-board p-4">
          <span className={`${bar} w-40`} />
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="flex gap-3">
              <span className={`${bar} w-16`} />
              <span className={`${bar} flex-1`} />
              <span className={`${bar} w-14`} />
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
