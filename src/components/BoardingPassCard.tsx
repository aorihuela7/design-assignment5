"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, ViewTransition, type MouseEvent, type ReactNode } from "react";
import type { Airport } from "@/lib/airports";
import { formatDay } from "@/lib/dates";
import { prefersReducedMotion } from "@/lib/motion";
import type { ForecastState } from "@/lib/useForecast";
import { degrees, describeWeather } from "@/lib/weather";
import { Card, CardLink } from "./Card";
import { FlipCode } from "./FlipCode";
import { NewBadge } from "./NewBadge";
import { RunwayProgress } from "./RunwayProgress";
import { TextLink } from "./TextLink";
import { WeatherIcon } from "./WeatherIcon";

type BoardingPassCardProps = {
  name: string;
  // The destination's nearest major airport; none without a destination, or far from one.
  airport?: Airport | null;
  // Where the trip goes ("Madrid, Spain"), and its weather there today; none without a destination.
  place?: string | null;
  today?: ForecastState | null;
  // "Departs in 3 days", until the day it leaves.
  departure?: string | null;
  packed: number;
  total: number;
  lastPackedAt: string | null;
  newCount?: number;
  // The list name links here; the link's hit area covers the whole card.
  href: string;
  // Second link, shown with new items: opens the list ready to add one.
  forgotHref?: string;
  // Without a destination, a link to add one in its place.
  destinationHref?: string;
  // Shared with the trip page's title, which this name morphs into on opening.
  titleTransition: string;
};

// "N added" counts already shown in this tab, by card link, so a badge stamps in only
// the first time a card shows its count. Memory only: never saved, reset on reload.
const shownNewCounts = new Map<string, number>();

// How long the plane takes to run to the end of the runway before the trip opens;
// the title morph carries the rest of the move.
const TAKEOFF_MS = 200;

// Half-circle notches: a circle in the page color with two border sides colored,
// rotated 45° so the colored half faces into the card. Sides swap at @md, when the
// tear line turns vertical.
// --notch: the color behind the ticket, if it isn't the page (the sign-in panel's navy).
const notch = "absolute size-5 rotate-45 rounded-full border border-transparent bg-[var(--notch,var(--color-canvas))]";
const notchStart =
  "-left-px top-0 -translate-x-1/2 -translate-y-1/2 border-t-current border-r-current @md:left-0 @md:-top-px @md:border-t-transparent @md:border-b-current";
const notchEnd =
  "-right-px top-0 translate-x-1/2 -translate-y-1/2 border-b-current border-l-current @md:right-auto @md:left-0 @md:top-auto @md:-bottom-px @md:-translate-x-1/2 @md:translate-y-1/2 @md:border-b-transparent @md:border-t-current";

export function BoardingPassCard({
  name,
  airport = null,
  place = null,
  today = null,
  departure = null,
  packed,
  total,
  lastPackedAt,
  newCount = 0,
  href,
  forgotHref,
  destinationHref,
  titleTransition,
}: BoardingPassCardProps) {
  const router = useRouter();
  const [departing, setDeparting] = useState(false);
  // Next keeps My trips in the background while a trip is open (React's Activity).
  // Hidden, the plane is back on the ground, so coming back it shows the progress
  // and the card opens again.
  useLayoutEffect(() => () => setDeparting(false), []);
  const stampBadge = newCount > 0 && shownNewCounts.get(href) !== newCount;
  useEffect(() => {
    shownNewCounts.set(href, newCount);
  }, [href, newCount]);

  // "Despegue": a plain click runs the plane down the runway, then opens the trip.
  // Clicks for a new tab or window, and reduced motion, open straight away.
  const takeOff = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (prefersReducedMotion()) return;
    event.preventDefault();
    if (departing) return;
    setDeparting(true);
    setTimeout(() => router.push(href), TAKEOFF_MS);
  };

  return (
    <Ticket
      interactive
      main={
        <>
          {airport && <AirportLine airport={airport} />}
          {place && <p className={`${eyebrowClass} uppercase`}>{place}</p>}
          <ViewTransition name={titleTransition} share="morph" default="none">
            <h2 className={nameClass}>
              <CardLink href={href} onClick={takeOff}>
                {name}
              </CardLink>
            </h2>
          </ViewTransition>
          {place && today && <TodayWeather place={place} today={today} />}
          {!place && destinationHref && (
            // Where the weather would be. Above the card-wide link, like Forgot something.
            <p className="flex h-5 items-center">
              <TextLink href={destinationHref} inline className="z-20 font-mono text-xs uppercase tracking-wider">
                Add a destination<span className="sr-only"> to {name}</span> for weather tips
              </TextLink>
            </p>
          )}
          {newCount > 0 && (
            <div className="mt-1 flex flex-col items-start">
              <NewBadge stamp={stampBadge}>{`${newCount} added for next trip`}</NewBadge>
              {forgotHref && (
                // A sibling of the main link, never inside it; z-20 lifts it above the card-wide
                // hit area. Its 44px target reaches into the card's padding, so the spacing stays even.
                <TextLink href={forgotHref} className="relative z-20 mt-1 -mb-3">
                  Forgot something? Add it<span className="sr-only"> to {name}</span>
                </TextLink>
              )}
            </div>
          )}
        </>
      }
      stub={
        <>
          {departure && <p className="font-mono text-xs uppercase tracking-wider text-ink">{departure}</p>}
          <RunwayProgress packed={packed} total={total} departing={departing} />
          {lastPackedAt && (
            <p className="font-mono text-xs uppercase tracking-wider text-muted">
              Last packed {formatDay(lastPackedAt)}
            </p>
          )}
          <div className="flex items-end justify-between gap-3">
            <StatusStamp id={href} status={statusOf(packed, total)} />
            {/* Visual cue only; the list name is the link's accessible name. */}
            <span aria-hidden="true" className="font-mono text-xs uppercase tracking-wider text-ink">
              Open →
            </span>
          </div>
        </>
      }
    />
  );
}

// Where packing has got to, in words: never 100% until every item is ticked.
function statusOf(packed: number, total: number) {
  if (total > 0 && packed >= total) return "Packed";
  if (packed === 0) return "Not started";
  return `Boarding ${Math.max(1, Math.floor((packed / total) * 100))}%`;
}

// Statuses already shown in this tab, by card link. Memory only, reset on reload.
const shownStatuses = new Map<string, string>();

// Inked on the stub like a passport stamp. It presses on again only when the trip's
// status has changed since the card was last seen (packing got under way, or finished),
// never on the first sight or with reduced motion. The count beside the runway says the
// same for screen readers.
function StatusStamp({ id, status }: { id: string; status: string }) {
  const stamp = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const before = shownStatuses.get(id);
    shownStatuses.set(id, status);
    if (before === undefined || before === status || prefersReducedMotion()) return;
    stamp.current?.animate([{ opacity: 0, scale: "1.15", rotate: "-9deg" }], { duration: 200, easing: "ease-out" });
  }, [id, status]);
  return (
    <span
      ref={stamp}
      aria-hidden="true"
      className="-rotate-3 border-[3px] border-double border-ink px-1.5 py-1 font-mono text-xs leading-none uppercase tracking-wider text-ink"
    >
      {status}
    </span>
  );
}

// The airport, then where the trip goes, each on its own line above the name.
const eyebrowClass = "font-mono text-xs leading-4 tracking-widest text-muted";

// "MAD · MADRID–BARAJAS": a real airport code, named, so it reads as an airport.
function AirportLine({ airport }: { airport: Airport }) {
  return (
    <p className={`${eyebrowClass} uppercase`}>
      <span aria-hidden="true">
        <FlipCode code={airport.code} /> · {airport.name}
      </span>
      <span className="sr-only">
        Nearest airport: {airport.name} ({airport.code})
      </span>
    </p>
  );
}

// Today's weather at the destination, in one line that keeps its height while the
// forecast loads, so the card doesn't grow when it arrives. If it can't load, the card
// says so and works as ever.
function TodayWeather({ place, today }: { place: string; today: ForecastState }) {
  const day = today.status === "ready" ? today.days[0] : null;
  const weather = day ? describeWeather(day.code) : null;
  return (
    <p className="flex h-5 items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-ink">
      {today.status === "loading" && <span aria-hidden="true" className="h-3 w-48 max-w-full rounded bg-canvas" />}
      {today.status === "failed" && <span className="text-muted">Weather unavailable</span>}
      {day && (
        <>
          <span aria-hidden="true" className="flex min-w-0 items-center gap-1.5">
            Today
            {weather && <WeatherIcon sky={weather.sky} background="var(--color-surface)" className="size-4" />}
            <span className="truncate">
              {weather?.label} {degrees(day.high)} / {degrees(day.low)}
            </span>
          </span>
          <span className="sr-only">
            Today in {place}: {weather ? `${weather.label.toLowerCase()}, ` : ""}high {degrees(day.high)}, low{" "}
            {degrees(day.low)}.
          </span>
        </>
      )}
    </p>
  );
}

// As wide as its text, so the morph into the page title scales it evenly.
const nameClass =
  "w-fit font-display text-3xl leading-tight font-semibold uppercase tracking-wide break-words text-ink @md:text-4xl";

// The ticket shape: the main part, the tear line with its notches, and the stub.
function Ticket({ interactive = false, main, stub }: { interactive?: boolean; main: ReactNode; stub: ReactNode }) {
  return (
    <Card interactive={interactive} padded={false} className="@container">
      <div className="relative flex flex-col @md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-4 @md:p-5">{main}</div>

        <div
          aria-hidden="true"
          className="pointer-events-none relative h-0 text-line group-hover:text-ink @md:h-auto @md:w-0"
        >
          <div className="absolute inset-x-5 top-0 border-t border-dashed border-line @md:inset-x-auto @md:inset-y-5 @md:left-0 @md:border-t-0 @md:border-l" />
          <span className={`${notch} ${notchStart}`} />
          <span className={`${notch} ${notchEnd}`} />
        </div>

        <div className="flex flex-col justify-center gap-2 rounded-b-[3px] bg-canvas/60 p-4 @md:w-64 @md:rounded-r-[3px] @md:rounded-bl-none @md:p-5">
          {stub}
        </div>
      </div>
    </Card>
  );
}

// Shown while trips load: the same ticket, with blank bars where the text goes.
// Each bar sits in a box with the real text's line height, so nothing moves when
// the trips arrive.
export function BoardingPassSkeleton() {
  return (
    <Ticket
      main={
        <>
          <span className="flex h-4 items-center">
            <span className="h-3 w-8 rounded bg-canvas" />
          </span>
          <span className={`${nameClass} flex h-[1.25em] items-center`}>
            <span className="h-[0.6em] w-[7em] max-w-full rounded bg-canvas" />
          </span>
          <span className="flex h-5 items-center">
            <span className="h-3 w-48 max-w-full rounded bg-canvas" />
          </span>
        </>
      }
      stub={
        <>
          <div className="flex h-6 items-center gap-3">
            <span className="flex-1 border-t-2 border-dashed border-line" />
            <span className="h-3 w-28 rounded bg-line/60" />
          </div>
          {/* As tall as the stamp's row. */}
          <div className="flex h-[26px] items-end justify-between">
            <span className="h-5 w-24 rounded bg-line/60" />
            <span className="flex h-4 items-center">
              <span className="h-3 w-14 rounded bg-line/60" />
            </span>
          </div>
        </>
      }
    />
  );
}

// New trip's live preview: the ticket the trip will get, updating as the name is
// typed. Decorative (the field holds the name), so hidden from screen readers. Once
// named on Create trip, its title morphs into the new page's title. The sign-in
// panel's sample pass has an airport and a list partly packed.
type BoardingPassPreviewProps = {
  name: string;
  airport?: Airport | null;
  titleTransition?: string;
  packed?: number;
  total?: number;
};

export function BoardingPassPreview({ name, airport = null, titleTransition, packed = 0, total = 0 }: BoardingPassPreviewProps) {
  const title = name ? (
    <p className={nameClass}>{name}</p>
  ) : (
    <span className={`${nameClass} flex h-[1.25em] items-center`}>
      <span className="h-[0.6em] w-[7em] max-w-full rounded bg-canvas" />
    </span>
  );
  return (
    <div aria-hidden="true">
      <Ticket
        main={
          <>
            {airport && <AirportLine airport={airport} />}
            {titleTransition ? (
              <ViewTransition name={titleTransition} share="morph" default="none">
                {title}
              </ViewTransition>
            ) : (
              title
            )}
          </>
        }
        stub={<RunwayProgress packed={packed} total={total} />}
      />
    </div>
  );
}
