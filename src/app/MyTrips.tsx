"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { BoardingPassCard, BoardingPassSkeleton } from "@/components/BoardingPassCard";
import { Button, ButtonLink } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { LoadFailed } from "@/components/LoadFailed";
import { Notice } from "@/components/Notice";
import { Page } from "@/components/Page";
import { SectionHeading } from "@/components/SectionHeading";
import { nearestAirport } from "@/lib/airports";
import { departureCountdown, localDay } from "@/lib/dates";
import { useFlash } from "@/lib/flash";
import { prefersReducedMotion } from "@/lib/motion";
import { isUntouchedStarters } from "@/lib/starters";
import { addStarterTripsBack, useStorage } from "@/lib/storage";
import { isAllPacked, tripTitleTransition, welcomeBackCount, type Trip } from "@/lib/trips";
import { useForecast } from "@/lib/useForecast";
import { useNow } from "@/lib/useNow";
import { placeLabel } from "@/lib/weather";

function newestFirst(a: Trip, b: Trip) {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

// What's leaving next comes first, soonest first; then the rest, last changed first.
function nextDepartureFirst(today: string | null) {
  const next = (trip: Trip) => (today && trip.departsOn && trip.departsOn >= today ? trip.departsOn : null);
  return (a: Trip, b: Trip) => {
    const [first, second] = [next(a), next(b)];
    if (first && second) return first.localeCompare(second) || newestFirst(a, b);
    if (first || second) return first ? -1 : 1;
    return newestFirst(a, b);
  };
}

// "Good evening, Alejandro." By the person's own clock, with their first name when
// their account has one; "Welcome back" after 2 days away.
function greeting(now: number, firstName: string | null, welcomeBack: boolean) {
  const hour = new Date(now).getHours();
  const hello = welcomeBack
    ? "Welcome back"
    : hour >= 5 && hour < 12
      ? "Good morning"
      : hour >= 12 && hour < 18
        ? "Good afternoon"
        : "Good evening";
  return firstName ? `${hello}, ${firstName}.` : `${hello}.`;
}

// One line on where the trips stand, under the greeting.
function summary(trips: Trip[], readyAgain: number) {
  const plural = (n: number) => `${n} ${n === 1 ? "trip" : "trips"}`;
  if (readyAgain > 0) return `${plural(readyAgain)} ready to pack again.`;
  if (isUntouchedStarters(trips)) return `${trips.length} starter trips. Open one, make it yours.`;
  const packed = trips.filter((trip) => isAllPacked(trip.items)).length;
  const toPack = trips.length - packed;
  if (toPack === 0) return packed === 1 ? "1 trip packed." : `All ${packed} trips packed.`;
  return packed > 0 ? `${plural(toPack)} to pack, ${packed} packed.` : `${plural(toPack)} to pack.`;
}

// The greeting and the summary beside New trip, the primary action, on wide screens.
function Intro({ hello, line }: { hello: string | null; line: string }) {
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="min-h-6 font-bold text-ink">{hello}</p>
        <p className="text-muted">{line}</p>
      </div>
      <ButtonLink variant="primary" href="/trips/new">
        New trip
      </ButtonLink>
    </div>
  );
}

// Same on the server and the first client render, so hydration matches. Shaped
// like the page: the status where the greeting goes, beside New trip, then three tickets.
function Loading() {
  return (
    <>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p role="status" className="min-h-6 text-muted">
            Loading your trips…
          </p>
          <span aria-hidden="true" className="flex h-6 items-center">
            <span className="h-3 w-48 rounded bg-line/60" />
          </span>
        </div>
        <span aria-hidden="true" className="h-11 w-30 rounded bg-line/60" />
      </div>
      <ul aria-hidden="true" className="flex flex-col gap-8">
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <BoardingPassSkeleton />
          </li>
        ))}
      </ul>
    </>
  );
}

export function MyTrips() {
  const storage = useStorage();
  const now = useNow();
  const { user } = useUser();

  // A message from the page before, like "Deleted Beach weekend". It takes focus
  // once, so it's read out and keyboard focus isn't lost.
  const flash = useFlash();
  const flashRef = useRef<HTMLDivElement>(null);
  const ready = storage.status === "ready";
  useEffect(() => {
    if (ready && flash) flashRef.current?.focus();
  }, [ready, flash]);

  if (storage.status === "failed") {
    return (
      <Page title="My trips">
        <LoadFailed />
      </Page>
    );
  }

  // Also covers making the starter trips, on a first sign-in.
  if (storage.status === "loading") {
    return (
      <Page title="My trips">
        <Loading />
      </Page>
    );
  }

  const { trips } = storage;
  // Welcome back wins over the starter line. The time of day is only known in the
  // browser; until then the greeting's line keeps its place, empty.
  const readyAgain = now === null ? 0 : welcomeBackCount(trips, now);
  const hello = now === null ? null : greeting(now, user?.firstName?.trim() || null, readyAgain > 0);

  return (
    <Page title="My trips">
      {flash && (
        <div ref={flashRef} tabIndex={-1} className="outline-none">
          <Notice>{flash}</Notice>
        </div>
      )}

      {trips.length === 0 ? (
        <NoTrips />
      ) : (
        <>
          <Intro hello={hello} line={summary(trips, readyAgain)} />

          <TripList>
            {[...trips].sort(nextDepartureFirst(now === null ? null : localDay(now))).map((trip) => (
              <li key={trip.id}>
                <TripCard
                  trip={trip}
                  departure={trip.departsOn && now !== null ? departureCountdown(trip.departsOn, now) : null}
                />
              </li>
            ))}
          </TripList>
        </>
      )}
    </Page>
  );
}

// Whether the tickets have come in yet in this tab. Memory only, reset on reload.
let ticketsEntered = false;

// The tickets, 32px apart: notches stick out 10px on each side, so they never meet. The
// first time they show in a tab they come in one after another, a little up and into
// view, 200ms each; never again in that tab (not coming back from a trip, say), and not
// with reduced motion. Only opacity and position move, so they can be clicked at once.
function TripList({ children }: { children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    if (ticketsEntered || !list.current) return;
    ticketsEntered = true;
    if (prefersReducedMotion()) return;
    [...list.current.children].slice(0, 5).forEach((ticket, i) =>
      ticket.animate([{ opacity: 0, translate: "0 8px" }, {}], {
        duration: 200,
        delay: i * 40,
        easing: "ease-out",
        fill: "backwards",
      }),
    );
  }, []);
  return (
    <ul ref={list} className="flex flex-col gap-8">
      {children}
    </ul>
  );
}

// A trip's ticket, with today's weather where it's going: the same forecast its page
// shows, so opening the trip asks Open-Meteo nothing more.
function TripCard({ trip, departure }: { trip: Trip; departure: string | null }) {
  const today = useForecast(trip.destination);
  return (
    <BoardingPassCard
      name={trip.name}
      airport={nearestAirport(trip.destination)}
      place={trip.destination ? placeLabel(trip.destination) : null}
      today={today}
      departure={departure}
      packed={trip.items.filter((item) => item.packed).length}
      total={trip.items.length}
      lastPackedAt={trip.lastPackedAt}
      newCount={trip.items.filter((item) => item.isNew).length}
      href={`/trips/${trip.id}`}
      forgotHref={`/trips/${trip.id}?add=1`}
      destinationHref={`/trips/${trip.id}?destination=1`}
      titleTransition={tripTitleTransition(trip.id)}
    />
  );
}

// Only after the person deleted every list; starters never come back on their own.
function NoTrips() {
  const [failed, setFailed] = useState(false);
  const adding = useRef(false);

  async function addBack() {
    if (adding.current) return;
    adding.current = true;
    const ok = await addStarterTripsBack();
    adding.current = false;
    setFailed(!ok);
    // The button is gone now; move focus to the first list instead of losing it.
    if (ok) requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-card-link]")?.focus());
  }

  return (
    <EmptyState plane>
      <div className="flex flex-col gap-1">
        <SectionHeading>No trips yet</SectionHeading>
        <p className="text-muted">Make a list once and it’s ready for every trip after.</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <ButtonLink variant="primary" href="/trips/new">
          New trip
        </ButtonLink>
        <Button onClick={addBack}>Add the starter trips back</Button>
      </div>
      {failed && <ErrorMessage role="alert">Not added. Check your connection and try again</ErrorMessage>}
    </EmptyState>
  );
}
