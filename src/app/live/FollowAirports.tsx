"use client";

import { useState, type Ref } from "react";
import { Button } from "@/components/Button";
import { ErrorMessage } from "@/components/ErrorMessage";
import { TextField } from "@/components/Field";
import { AIRPORTS, type Airport } from "@/lib/airports";
import { MAX_FOLLOWS, type FollowResult } from "@/lib/live";

// An airport near one of the person's trip destinations, with that trip's place.
export type Suggestion = { airport: Airport; place: string };

type FollowAirportsProps = {
  follows: string[];
  suggestions: Suggestion[];
  onFollow: (code: string) => Promise<FollowResult>;
  inputRef?: Ref<HTMLInputElement>;
};

const MAX_RESULTS = 6;

// Without accents or case, so "malaga" finds Málaga.
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Airports on the list whose code starts with the search, or whose name has it.
function search(query: string, follows: string[]) {
  const q = plain(query.trim());
  if (!q) return [];
  return AIRPORTS.filter(
    (airport) => !follows.includes(airport.code) && (plain(airport.code).startsWith(q) || plain(airport.name).includes(q)),
  ).slice(0, MAX_RESULTS);
}

const LIMIT_MESSAGE = `You follow ${MAX_FOLLOWS} airports, the most you can. Stop following one to add another.`;

const MESSAGES: Record<Exclude<FollowResult, "saved">, string> = {
  limit: LIMIT_MESSAGE,
  already: "You already follow that airport.",
  failed: "Not saved. Check your connection and try again",
};

// Find an airport on the curated list by code or city and follow it, or follow one
// near a trip. At the limit, it says so instead of offering more.
export function FollowAirports({ follows, suggestions, onFollow, inputRef }: FollowAirportsProps) {
  const [query, setQuery] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  // The airport being followed, while it saves.
  const [busy, setBusy] = useState<string | null>(null);

  const full = follows.length >= MAX_FOLLOWS;
  const results = search(query, follows);
  const open = suggestions.filter((suggestion) => !follows.includes(suggestion.airport.code));

  async function follow(code: string) {
    if (busy) return;
    setBusy(code);
    const result = await onFollow(code);
    setBusy(null);
    if (result === "saved") {
      setQuery("");
      setProblem(null);
    } else {
      setProblem(MESSAGES[result]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        You follow {follows.length} of {MAX_FOLLOWS} airports.
      </p>
      {full ? (
        <p>{LIMIT_MESSAGE}</p>
      ) : (
        <>
          {open.length > 0 && (
            <ul className="flex flex-col gap-2">
              {open.map(({ airport, place }) => (
                <li key={airport.code} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="mr-auto">
                    Near your trip to {place}: <span className="font-mono">{airport.code}</span> · {airport.name}
                  </span>
                  <Button onClick={() => follow(airport.code)} disabled={busy !== null} aria-label={`Follow ${airport.code}, ${airport.name}`}>
                    Follow
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form role="search" onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-3">
            <TextField
              ref={inputRef}
              label="Find an airport"
              placeholder="Code or city, like ORD or Chicago"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setProblem(null);
              }}
              error={problem ?? undefined}
            />
          </form>
          {/* Always in the page, so each new count is read out. Empty, it takes no room. */}
          <p role="status" className={query.trim() ? "font-mono text-xs uppercase tracking-wider text-muted" : ""}>
            {query.trim() &&
              (results.length
                ? `${results.length} ${results.length === 1 ? "airport" : "airports"} found`
                : `No airport on the list matches “${query.trim()}”. Try a code like MAD, or a city like Madrid`)}
          </p>
          {results.length > 0 && (
            <ul className="flex flex-col gap-2">
              {results.map((airport) => (
                <li key={airport.code}>
                  <Button className="w-full" onClick={() => follow(airport.code)} disabled={busy !== null}>
                    <span className="flex-1 text-left">
                      Follow {airport.code} · {airport.name}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {full && problem && <ErrorMessage role="alert">{problem}</ErrorMessage>}
    </div>
  );
}
