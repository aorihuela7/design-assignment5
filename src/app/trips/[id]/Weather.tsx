import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { Card } from "@/components/Card";
import { ErrorMessage } from "@/components/ErrorMessage";
import { SectionHeading } from "@/components/SectionHeading";
import { TextButton, TextLink } from "@/components/TextLink";
import type { SaveResult } from "@/lib/storage";
import { suggestions } from "@/lib/suggestions";
import type { LoadedForecast } from "@/lib/useForecast";
import type { Destination, Item, Section, Trip } from "@/lib/trips";
import { formatCalendarDay } from "@/lib/dates";
import { boardDays, degrees, placeLabel, type Place } from "@/lib/weather";
import { DestinationSearch } from "./DestinationSearch";
import { Forecast } from "./Forecast";
import { Suggestions } from "./Suggestions";

type WeatherProps = {
  trip: Trip;
  // The destination's forecast, loaded by the page; null without a destination.
  forecast: LoadedForecast | null;
  // Resolves to whether it saved.
  onSetDestination: (destination: Destination | null) => Promise<boolean>;
  // Adds a suggestion the way the Add item form adds an item.
  onAdd: (name: string, section: Section) => Promise<SaveResult>;
  // Opens the departure date form, as Trip options › Departure date does.
  onAddDates: () => void;
  ref?: Ref<WeatherHandle>;
};

// For the page: "Add a destination for weather tips" on My trips arrives here.
export type WeatherHandle = { openSearch: () => void };

export const WEATHER_HEADING_ID = "weather-heading";
const DETAILS_ID = "weather-details";

// Everything about where the trip is going, together, and nowhere else: the
// destination with Change and Remove, today's summary, the next 7 days, what to pack
// for them and the credit to Open-Meteo. Without a destination, an invitation to add
// one. On a phone it's one block at the top that opens and closes; wider, it's always
// open, beside the list.
export function Weather({ trip, forecast, onSetDestination, onAdd, onAddDates, ref }: WeatherProps) {
  const { destination } = trip;
  const [changing, setChanging] = useState(false);
  // Once the person asks for the search (Change, Remove), its field takes focus.
  const [focusSearch, setFocusSearch] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);
  // Phones only: starts closed, so the list comes first.
  const [expanded, setExpanded] = useState(false);
  const removing = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  // Set while the zone opens for the search, so its field takes focus once it shows.
  const focusOnOpen = useRef(false);

  // Opens the zone with focus in the Destination field. Wider screens always show it;
  // on a phone it opens first, and the field takes focus once it's on screen.
  useImperativeHandle(
    ref,
    () => ({
      openSearch() {
        if (searchInput.current?.offsetParent) {
          searchInput.current.focus();
          return;
        }
        focusOnOpen.current = true;
        setExpanded(true);
      },
    }),
    [],
  );
  useLayoutEffect(() => {
    if (!expanded || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    searchInput.current?.focus();
  }, [expanded]);

  // Next keeps a visited page in the background (React's Activity). Coming back, the
  // zone is closed, out of any change and without last time's error, as on a fresh visit.
  useLayoutEffect(
    () => () => {
      setExpanded(false);
      setChanging(false);
      setRemoveFailed(false);
    },
    [],
  );

  // Where focus waits when what had it goes: the phone's button if it's showing, else
  // the heading.
  const focusZone = () => {
    const target = toggle.current?.offsetParent ? toggle.current : heading.current;
    target?.focus();
  };

  const choose = async (place: Place) => {
    const { name, country, latitude, longitude, timezone } = place;
    if (!(await onSetDestination({ name, country, latitude, longitude, timezone }))) return false;
    setChanging(false);
    requestAnimationFrame(focusZone);
    return true;
  };
  const change = () => {
    setFocusSearch(true);
    setChanging(true);
    setRemoveFailed(false);
  };
  const cancel = () => {
    setChanging(false);
    requestAnimationFrame(() => changeButton.current?.focus());
  };
  const remove = async () => {
    if (removing.current) return;
    removing.current = true;
    setFocusSearch(true);
    const removed = await onSetDestination(null);
    removing.current = false;
    setRemoveFailed(!removed);
  };

  const searching = !destination || !forecast || changing;

  return (
    <section aria-labelledby={WEATHER_HEADING_ID} className="flex flex-col gap-3">
      {/* Phones: the heading is the button that opens and closes the zone, and shows
          today's summary while it's closed. */}
      <h2 className="lg:hidden">
        <button
          ref={toggle}
          type="button"
          aria-expanded={expanded}
          aria-controls={DETAILS_ID}
          onClick={() => setExpanded((open) => !open)}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded border border-line bg-surface px-4 py-3 text-left hover:border-ink"
        >
          {destination && forecast ? (
            <TodaySummary destination={destination} forecast={forecast} items={trip.items} departsOn={trip.departsOn} withPlace />
          ) : (
            <span className="flex min-w-0 flex-col">
              <span className="font-mono text-xs leading-4 uppercase tracking-wider text-ink">Weather</span>
              <span className="text-sm text-muted">Add a destination for weather tips</span>
            </span>
          )}
          <Chevron open={expanded} />
        </button>
      </h2>
      <div id={DETAILS_ID} className={`flex-col gap-3 ${expanded ? "flex" : "hidden lg:flex"}`}>
        {/* The destination with Change and Remove on one line, wrapping if the name is
            long. The heading shows on wider screens only, but names the zone on phones
            too. tabIndex -1: focus can wait here; no ring, since it isn't a control. */}
        <div className="flex flex-wrap items-center gap-x-4">
          <SectionHeading id={WEATHER_HEADING_ID} ref={heading} tabIndex={-1} className="mr-auto hidden outline-none lg:block">
            {destination ? `Weather in ${placeLabel(destination)}` : "Weather"}
          </SectionHeading>
          {!searching && (
            <div className="flex gap-x-4">
              <TextButton ref={changeButton} aria-label="Change destination" onClick={change}>
                Change
              </TextButton>
              <TextButton aria-label="Remove destination" onClick={remove}>
                Remove
              </TextButton>
            </div>
          )}
        </div>
        {searching ? (
          <Card className="flex flex-col gap-4">
            {!destination && <p>Add where you’re going to see its weather for the next 7 days.</p>}
            <DestinationSearch
              initialQuery={changing ? destination?.name : undefined}
              autoFocus={focusSearch}
              inputRef={searchInput}
              onChoose={choose}
              onCancel={destination ? cancel : undefined}
            />
          </Card>
        ) : (
          <>
            {removeFailed && <ErrorMessage role="alert">Not removed. Check your connection and try again</ErrorMessage>}
            {/* On a phone the button above already shows it. */}
            <div className="hidden lg:flex">
              <TodaySummary destination={destination} forecast={forecast} items={trip.items} departsOn={trip.departsOn} />
            </div>
            <Forecast
              state={forecast}
              departsOn={trip.departsOn}
              onRetry={() => {
                focusZone();
                forecast.retry();
              }}
            />
            {/* Without dates, say which days the board and the suggestions are for. */}
            {forecast.status === "ready" && !trip.departsOn && (
              <p className="text-sm text-muted">
                Based on the next 7 days.{" "}
                <TextButton inline onClick={onAddDates}>
                  Add your dates
                </TextButton>{" "}
                to forecast your trip.
              </p>
            )}
            {forecast.status === "ready" && trip.departsOn && trip.departsOn > (forecast.days.at(-1)?.date ?? trip.departsOn) && (
              <p className="text-sm text-muted">
                {formatCalendarDay(trip.departsOn)} is beyond the 16-day forecast. Check back nearer the day.
              </p>
            )}
            {forecast.status === "ready" && (
              <Suggestions {...boardDays(forecast.days, trip.departsOn)} items={trip.items} onAdd={onAdd} onNoneLeft={focusZone} />
            )}
            {forecast.status !== "failed" && (
              <p className="text-sm text-muted">
                Weather data by{" "}
                <TextLink href="https://open-meteo.com/" inline>
                  Open-Meteo.com
                </TextLink>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

type TodaySummaryProps = {
  destination: Destination;
  forecast: LoadedForecast;
  items: Item[];
  departsOn: string | null;
  // The phone's button names the place; the panel's heading already does.
  withPlace?: boolean;
};

// Today in two lines: the high and low, then the first tip from the days the board
// shows (the trip's, once it's near). Two lines whatever it says, so nothing moves as
// the forecast arrives.
function TodaySummary({ destination, forecast, items, departsOn, withPlace = false }: TodaySummaryProps) {
  const today = forecast.status === "ready" ? forecast.days[0] : null;
  const board = forecast.status === "ready" ? boardDays(forecast.days, departsOn) : null;
  const hint = board
    ? (suggestions(board.days, items, board.start)[0]?.reason ?? "Nothing extra to pack for the weather")
    : forecast.status === "failed"
        ? "Weather is unavailable right now"
        : null;
  const bar = "inline-block rounded bg-line/60 align-middle";
  const place = withPlace ? `${destination.name} · ` : "";
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="block h-4 truncate font-mono text-xs leading-4 uppercase tracking-wider text-ink">
        <span aria-hidden="true">
          {forecast.status === "failed" ? destination.name : `${place}Today `}
          {today
            ? `${degrees(today.high)} / ${degrees(today.low)}`
            : forecast.status === "loading" && <span className={`${bar} h-2.5 w-24`} />}
        </span>
        <span className="sr-only">
          {today
            ? `Today in ${destination.name}: high ${degrees(today.high)}, low ${degrees(today.low)}.`
            : `${destination.name}.`}
        </span>
      </span>
      <span className="flex h-5 items-center text-sm text-muted">
        {hint ? (
          <span className="min-w-0 truncate">{hint}</span>
        ) : (
          <span aria-hidden="true" className={`${bar} h-3 w-48 max-w-full`} />
        )}
      </span>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`ml-auto size-4 shrink-0 text-ink transition-transform duration-150 ease-out motion-reduce:transition-none ${
        open ? "rotate-180" : ""
      }`}
    >
      <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
