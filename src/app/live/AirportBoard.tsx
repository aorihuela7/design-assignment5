"use client";

import { useState, type Ref } from "react";
import { ErrorIcon, ErrorMessage } from "@/components/ErrorMessage";
import { FlipText } from "@/components/FlipText";
import { SectionHeading } from "@/components/SectionHeading";
import { TextButton } from "@/components/TextLink";
import type { Airport } from "@/lib/airports";
import { ago, boardOrder, RADIUS_NM, type AircraftStatus, type AirportState, type LiveAircraft } from "@/lib/live";

const STATUS_WORDS: Record<AircraftStatus, string> = {
  arriving: "Arriving",
  departing: "Departing",
  on_ground: "On ground",
  overflying: "Overflying",
};

// A busy airport has 50 aircraft or more; the board shows the first 12 until asked.
const FIRST_ROWS = 12;

type AirportBoardProps = {
  airport: Airport;
  state: AirportState;
  aircraft: LiveAircraft[];
  onUnfollow: () => Promise<boolean>;
  headingRef?: Ref<HTMLHeadingElement>;
};

// One followed airport: its name with Stop following, how fresh its data is, and its
// aircraft as a departures board.
export function AirportBoard({ airport, state, aircraft, onUnfollow, headingRef }: AirportBoardProps) {
  const [showAll, setShowAll] = useState(false);
  const [unfollowFailed, setUnfollowFailed] = useState(false);
  const headingId = `airport-${airport.code}`;
  const rows = boardOrder(aircraft);
  const shown = showAll ? rows : rows.slice(0, FIRST_ROWS);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4">
        {/* tabIndex -1: focus can wait here; no ring, since it isn't a control. */}
        <SectionHeading id={headingId} ref={headingRef} tabIndex={-1} className="mr-auto outline-none">
          {airport.code} · {airport.name}
        </SectionHeading>
        <TextButton
          aria-label={`Stop following ${airport.code}, ${airport.name}`}
          onClick={async () => setUnfollowFailed(!(await onUnfollow()))}
        >
          Stop following
        </TextButton>
      </div>
      {unfollowFailed && <ErrorMessage role="alert">Not saved. Check your connection and try again</ErrorMessage>}
      <Freshness code={airport.code} state={state} />
      {state.kind !== "waiting" && (
        <Board caption={counts(rows)} empty={rows.length === 0}>
          {shown.map((row) => (
            <AircraftRow key={row.hex} row={row} />
          ))}
        </Board>
      )}
      {rows.length > FIRST_ROWS && (
        <div>
          <TextButton onClick={() => setShowAll((all) => !all)}>
            {showAll ? `Show the first ${FIRST_ROWS}` : `Show all ${rows.length} aircraft`}
          </TextButton>
        </div>
      )}
    </section>
  );
}

// "3 arriving · 2 departing · 6 on ground · 29 overflying", in the board's order.
function counts(rows: LiveAircraft[]) {
  const parts = (["arriving", "departing", "on_ground", "overflying"] as const)
    .map((status) => [status, rows.filter((row) => row.status === status).length] as const)
    .filter(([, n]) => n > 0)
    .map(([status, n]) => `${n} ${STATUS_WORDS[status].toLowerCase()}`);
  return parts.length ? parts.join(" · ") : "No aircraft";
}

// How fresh the airport's data is, in words, with an icon when it's late or down.
function Freshness({ code, state }: { code: string; state: AirportState }) {
  if (state.kind === "waiting") return <p className="text-muted">Checking {code} for the first time. This takes about 10 seconds.</p>;
  if (state.kind === "fresh" || state.kind === "empty") {
    return <p className="font-mono text-xs uppercase tracking-wider text-muted">Updated {ago(state.ageMs)}</p>;
  }
  return (
    <p className="flex items-start gap-1.5 text-ink">
      <ErrorIcon className="mt-1" />
      <span>
        {state.kind === "stale"
          ? `Live data is late: last updated ${ago(state.ageMs)}. These aircraft may have moved.`
          : state.reason === "failed"
            ? `Live data for ${code} is unavailable right now: the last check failed. Showing the last aircraft seen.`
            : `Live data has stopped: the last check was ${ago(state.ageMs)}. Showing the aircraft from then.`}
      </span>
    </p>
  );
}

const cell = "h-11 px-1.5 first:pl-0 last:pr-0 @md:px-3";
const number = "text-right whitespace-nowrap";

// Navy and amber, like the band and the weather board. A table: a caption with the
// counts, column headings, and each aircraft as its row's heading.
function Board({ caption, empty, children }: { caption: string; empty: boolean; children: React.ReactNode }) {
  return (
    <div data-surface="board" className="@container rounded bg-board">
      <div className="px-3 pb-1 @md:px-5">
        <table className="w-full font-mono text-xs uppercase tracking-normal text-amber @md:text-sm @md:tracking-wider">
          <caption className="pt-3 pb-1 text-left text-xs text-white">{caption}</caption>
          <thead className="text-xs text-white">
            <tr className="border-b border-white/25">
              <th scope="col" className={`${cell} text-left font-normal`}>
                Flight
              </th>
              <th scope="col" className={`${cell} w-full text-left font-normal`}>
                Status
              </th>
              {/* The units are in the headings, so the numbers fit a phone. */}
              <ColumnHeading short="Alt ft" full="Altitude, feet" />
              <ColumnHeading short="Spd kt" full="Speed, knots" />
              <ColumnHeading short="Dist NM" full="Distance, nautical miles" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/15">
            {empty ? (
              <tr>
                <td colSpan={5} className="py-4 normal-case tracking-normal">
                  No aircraft seen within {RADIUS_NM} NM right now.
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ColumnHeading({ short, full }: { short: string; full: string }) {
  return (
    <th scope="col" className={`${cell} ${number} font-normal`}>
      <span aria-hidden="true">{short}</span>
      <span className="sr-only">{full}</span>
    </th>
  );
}

function AircraftRow({ row }: { row: LiveAircraft }) {
  return (
    <tr>
      <th scope="row" className={`${cell} text-left font-normal whitespace-nowrap`}>
        <span className="flex flex-col leading-tight">
          <span>{row.callsign ?? "No callsign"}</span>
          {row.type && <span className="text-white">{row.type}</span>}
        </span>
      </th>
      <td className={cell}>
        <FlipText text={STATUS_WORDS[row.status]} />
      </td>
      <td className={`${cell} ${number}`}>
        <FlipText text={row.altitude_ft === null ? "Ground" : row.altitude_ft.toLocaleString("en-US")} />
      </td>
      <td className={`${cell} ${number}`}>
        <FlipText text={row.speed_kt === null ? "–" : String(row.speed_kt)} />
      </td>
      <td className={`${cell} ${number}`}>
        <FlipText text={row.distance_nm.toFixed(1)} />
      </td>
    </tr>
  );
}
