"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorIcon } from "@/components/ErrorMessage";
import { PAGE_TITLE_ID } from "@/components/Header";
import { LoadFailed } from "@/components/LoadFailed";
import { Page } from "@/components/Page";
import { SectionHeading } from "@/components/SectionHeading";
import { TextButton } from "@/components/TextLink";
import { nearestAirport } from "@/lib/airports";
import { departureLine, formatCalendarDay, formatDay, localDay } from "@/lib/dates";
import { setFlash } from "@/lib/flash";
import { prefersReducedMotion } from "@/lib/motion";
import {
  addItem,
  answerNewTrip,
  clearTicks,
  createId,
  deleteTrip,
  duplicateTrip,
  editItem,
  removeItem,
  renameTrip,
  restoreItem,
  setDeparture,
  setDestination,
  setPacked,
  useStorage,
  type SaveResult,
} from "@/lib/storage";
import {
  copyName,
  groupBySection,
  isAllPacked,
  SECTIONS,
  shouldAskNewTrip,
  tripTitleTransition,
  type Destination,
  type Item,
  type Section,
} from "@/lib/trips";
import { useForecast } from "@/lib/useForecast";
import { useNow } from "@/lib/useNow";
import { placeLabel } from "@/lib/weather";
import { AddItemForm } from "./AddItemForm";
import { BACK_TO_MY_TRIPS, ListLoading } from "./ListLoading";
import { EditItem } from "./EditItem";
import { editButtonId, ItemRow, RemovedRow, UNDO_ROW_ID, undoHoldProps, type UndoHold } from "./ItemRow";
import { ProgressBar } from "./ProgressBar";
import { DeleteConfirm, DepartureForm, RenameForm, TripOptions } from "./TripActions";
import { Weather, type WeatherHandle } from "./Weather";

const COUNT_ID = "packed-count";
const UNDO_BAR_ID = "undo-bar";
// How long Undo stays after you move away from it.
const UNDO_MS = 3000;
// How long the bar's plane takes to leave the runway once the last item is ticked.
const TAKEOFF_MS = 200;
// A change on screen that didn't save, said in the bar. Short, so it fits on one line.
const NOT_SAVED_CHANGE = "Not saved. Check your connection";

// When Undo times out while focused, focus moves to the next item on screen
// (or the previous one, or the Add item field), so it's never lost.
function moveFocusOffUndo() {
  const row = document.getElementById(UNDO_ROW_ID)?.closest("li");
  const active = document.activeElement;
  if (!row || !(row.contains(active) || active?.id === UNDO_BAR_ID)) return null;
  const boxes = [...document.querySelectorAll<HTMLElement>("main input[type=checkbox]")];
  return (
    boxes.find((box) => row.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING) ??
    boxes.at(-1) ??
    document.querySelector<HTMLElement>("main form input")
  );
}

export function PackingList({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const storage = useStorage();
  const now = useNow();
  // Set while deleting a trip and leaving it, so the page doesn't flash "not found".
  const [deletedName, setDeletedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // The latest change, shown in the progress bar and read out politely. After a
  // removal it carries what's needed to undo it, until the next change.
  const [feedback, setFeedback] = useState<{
    text: string | null;
    undo?: { item: Item; index: number };
    failed?: boolean;
  } | null>(null);
  const setAnnouncement = (text: string) => setFeedback({ text });

  // Undo disappears UNDO_MS after a removal, counting again from when the pointer
  // or keyboard focus leaves it.
  const pendingId = feedback?.undo?.item.id ?? null;
  const [hold, setHold] = useState({ id: null as string | null, pointer: false, focus: false });
  const holdUndo: UndoHold = (reason, held) =>
    setHold((current) => ({
      ...(current.id === pendingId ? current : { pointer: false, focus: false }),
      id: pendingId,
      [reason]: held,
    }));
  const undoHeld = pendingId !== null && hold.id === pendingId && (hold.pointer || hold.focus);
  useEffect(() => {
    if (pendingId === null || undoHeld) return;
    const timer = setTimeout(() => {
      const next = moveFocusOffUndo();
      setFeedback((current) => (current?.undo?.item.id === pendingId ? null : current));
      if (next) requestAnimationFrame(() => next.focus());
    }, UNDO_MS);
    return () => clearTimeout(timer);
  }, [pendingId, undoHeld]);
  // The row just added or restored, so it can be highlighted where it lands.
  // Added rows grow in; restored ones fade back in where they were.
  const [landed, setLanded] = useState<{ id: string; how: "added" | "restored" } | null>(null);
  // The item the person just ticked, so only it plays the tick animation.
  const [justPackedId, setJustPackedId] = useState<string | null>(null);
  // Ticking the last item: the bar's plane takes off, then All packed fades in.
  const [takeoff, setTakeoff] = useState<"flying" | "landed" | null>(null);
  // What "Hide packed" hides: the items packed when it was pressed. Ones ticked after
  // stay in view, struck through, so nothing moves under the next tap.
  const [hiddenIds, setHiddenIds] = useState<Set<string> | null>(null);
  // The item being renamed or moved, in its row; one at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Once an edit closes, its item's Edit button takes focus, after the render that shows
  // it there (a moved item's row is a new one, in its new section).
  const refocusEdit = useRef<string | null>(null);
  useLayoutEffect(() => {
    const itemId = refocusEdit.current;
    if (!itemId || editingId !== null) return;
    refocusEdit.current = null;
    document.getElementById(editButtonId(itemId))?.focus();
  });
  // What Trip options opened: Rename and Delete show in place, above the list.
  const [options, setOptions] = useState<"idle" | "rename" | "departure" | "delete">("idle");
  const optionsButton = useRef<HTMLButtonElement>(null);
  // Set while Duplicate trip saves, so a second press doesn't make a second copy.
  const duplicating = useRef(false);

  const trip = storage.status === "ready" ? storage.trips.find((t) => t.id === id) : undefined;
  const forecast = useForecast(trip?.destination ?? null);

  // The tab title names the list too, so the person knows where they are.
  const tabTitle = trip?.name ?? deletedName ?? (storage.status === "ready" ? "Trip not found" : null);
  useEffect(() => {
    if (tabTitle) document.title = `${tabTitle} · Pack Again`;
  }, [tabTitle]);

  // Opens ready to type when the list is empty, or when asked with ?add=1 ("Forgot
  // something? Add it" on My trips); in the destination search when asked with
  // ?destination=1 ("Add a destination for weather tips") and there's none yet.
  const searchParams = useSearchParams();
  const wantsAdd = searchParams.get("add") === "1";
  const wantsDestination = searchParams.get("destination") === "1";
  const isEmpty = trip?.items.length === 0;
  const hasTrip = Boolean(trip);
  const hasDestination = Boolean(trip?.destination);
  const weather = useRef<WeatherHandle>(null);
  // Otherwise focus starts on the list name, so the next Tab reaches "Back to My trips".
  // Only on arrival: later changes (like removing the last item) manage focus themselves.
  const arrived = useRef(false);
  useEffect(() => {
    if (!hasTrip || arrived.current) return;
    arrived.current = true;
    if (wantsDestination && !hasDestination) weather.current?.openSearch();
    else if (isEmpty || wantsAdd) inputRef.current?.focus();
    else document.getElementById(PAGE_TITLE_ID)?.focus({ preventScroll: true });
  }, [hasTrip, isEmpty, wantsAdd, wantsDestination, hasDestination]);

  // Next keeps a visited trip in the background (React's Activity) and shows it again
  // as it was. Each visit starts fresh instead: no message or Undo from last time, no
  // animation playing again, Trip options closed, and focus placed on arrival.
  useLayoutEffect(
    () => () => {
      setFeedback(null);
      setLanded(null);
      setJustPackedId(null);
      setTakeoff(null);
      setOptions("idle");
      setHiddenIds(null);
      setEditingId(null);
      arrived.current = false;
    },
    [],
  );

  if (storage.status === "loading") return <ListLoading />;

  if (deletedName && !trip) {
    return <Page title={deletedName} back={BACK_TO_MY_TRIPS} wide>{null}</Page>;
  }

  if (storage.status === "failed") {
    return (
      <Page title="Packing list" back={BACK_TO_MY_TRIPS} wide>
        <LoadFailed />
      </Page>
    );
  }

  // Unknown id: an old bookmark, a deleted list, or someone else's (row-level
  // security never returns it).
  if (!trip) {
    return (
      <Page title="Trip not found" back={BACK_TO_MY_TRIPS} wide>
        <Card>
          <p>This trip doesn’t exist anymore.</p>
        </Card>
      </Page>
    );
  }

  const tripId = trip.id;
  // Ticks, removals and the like show straight away and save in the background. One
  // that doesn't save comes off the screen again and the bar says so; if focus was on
  // something that went with it (an Undo, a restored row), it moves to the count.
  const checkSaved = (ok: boolean) => {
    if (ok) return;
    setFeedback({ text: NOT_SAVED_CHANGE, failed: true });
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) document.getElementById(COUNT_ID)?.focus();
    });
  };
  const toggle = (id: string) => {
    const wasPacked = trip.items.find((item) => item.id === id)?.packed;
    const packsLast = !wasPacked && trip.items.every((item) => item.id === id || item.packed);
    setPacked(tripId, id, !wasPacked).then(checkSaved);
    setJustPackedId(wasPacked ? null : id);
    setFeedback(null);
    setLanded(null);
    // Only the person's own last tick takes off; reduced motion goes straight to All packed.
    if (packsLast && !prefersReducedMotion()) {
      setTakeoff("flying");
      setTimeout(() => setTakeoff((current) => (current === "flying" ? "landed" : current)), TAKEOFF_MS);
    } else {
      setTakeoff(null);
    }
  };
  const allPacked = isAllPacked(trip.items);
  // Saved before it shows, so the form keeps what was typed if it fails.
  const add = async (itemName: string, section: Section): Promise<SaveResult> => {
    // Added after a full pack ("Forgot something?"): saved as packed and New, so the
    // list stays All packed and the item stands out next trip.
    const forgot = isAllPacked(trip.items);
    const id = createId();
    // Set first, so the row grows in from the moment it appears.
    setLanded({ id, how: "added" });
    setJustPackedId(null);
    const result = await addItem(tripId, { id, name: itemName, section, packed: forgot, isNew: forgot });
    // Visible too: the new row may be far down the page.
    if (result === "saved") {
      setAnnouncement(`Added ${itemName} to ${SECTIONS.find((s) => s.value === section)?.label ?? "Other"}`);
    }
    return result;
  };
  // A placeholder row with Undo takes the item's place (and focus) for a few seconds.
  const remove = (removed: Item) => {
    const index = trip.items.findIndex((item) => item.id === removed.id);
    removeItem(tripId, removed.id).then(checkSaved);
    setFeedback({ text: `Removed ${removed.name}`, undo: { item: removed, index } });
    setLanded(null);
    setJustPackedId(null);
    requestAnimationFrame(() => document.getElementById(UNDO_ROW_ID)?.focus());
  };
  // Puts the item back where it was and moves focus to it.
  const undoRemove = ({ item, index }: { item: Item; index: number }) => {
    restoreItem(tripId, item, index).then(checkSaved);
    setAnnouncement(`Restored ${item.name}`);
    setLanded({ id: item.id, how: "restored" });
    requestAnimationFrame(() => document.getElementById(`item-${item.id}`)?.focus());
  };
  // An edit closes back to its item's Edit button, in whichever section it's now in.
  const closeEdit = (itemId: string) => {
    refocusEdit.current = itemId;
    setEditingId(null);
  };
  const saveEdit = async (item: Item, name: string, section: Section): Promise<SaveResult> => {
    if (name === item.name && section === item.section) {
      closeEdit(item.id);
      return "saved";
    }
    const result = await editItem(tripId, item.id, { name, section });
    if (result !== "saved") return result;
    const label = SECTIONS.find((s) => s.value === section)?.label ?? "Other";
    setAnnouncement(
      section === item.section
        ? `Renamed to ${name}`
        : name === item.name
          ? `Moved ${name} to ${label}`
          : `Renamed to ${name}, in ${label}`,
    );
    closeEdit(item.id);
    return result;
  };
  const focusCount = () => requestAnimationFrame(() => document.getElementById(COUNT_ID)?.focus());
  const clear = () => {
    clearTicks(tripId).then(checkSaved);
    setHiddenIds(null);
    setAnnouncement("Ticks cleared");
    focusCount();
  };
  const togglePacked = () => {
    if (hiddenIds) {
      setHiddenIds(null);
      setAnnouncement("Packed items shown");
      return;
    }
    const packedIds = trip.items.filter((item) => item.packed).map((item) => item.id);
    setHiddenIds(new Set(packedIds));
    setAnnouncement(`${packedIds.length} packed ${packedIds.length === 1 ? "item" : "items"} hidden`);
  };
  // Both answers to "Packing for a new trip?" record the answer, so it isn't asked again
  // until the next full pack.
  const answer = (clearAll: boolean) => {
    answerNewTrip(tripId, clearAll).then(checkSaved);
    if (clearAll) setHiddenIds(null);
    if (clearAll) setAnnouncement("Ticks cleared");
    focusCount();
  };
  const saveDestination = async (destination: Destination | null) => {
    const saved = await setDestination(tripId, destination);
    if (saved) setAnnouncement(destination ? `Destination set to ${placeLabel(destination)}` : "Destination removed");
    return saved;
  };
  // Rename and Delete close back to the button that opened them.
  const closeOptions = () => {
    setOptions("idle");
    requestAnimationFrame(() => optionsButton.current?.focus());
  };
  const saveDeparture = async (departsOn: string | null) => {
    if (departsOn === trip.departsOn) {
      closeOptions();
      return true;
    }
    const saved = await setDeparture(tripId, departsOn);
    if (!saved) return false;
    setAnnouncement(departsOn ? `Departs ${formatCalendarDay(departsOn)}` : "Departure date removed");
    closeOptions();
    return true;
  };
  const rename = async (name: string) => {
    const result = await renameTrip(tripId, name);
    if (result === "saved") setAnnouncement(`Renamed to ${name}`);
    return result;
  };
  // A copy to pack from again, opened once it's saved; its name says what it is.
  const duplicate = async () => {
    if (duplicating.current) return;
    duplicating.current = true;
    const { name } = trip;
    const id = createId();
    setAnnouncement(`Copying ${name}…`);
    const result = await duplicateTrip(tripId, id, copyName(name, storage.trips));
    duplicating.current = false;
    if (result === "saved") {
      router.push(`/trips/${id}`);
      return;
    }
    setFeedback({ text: "Not copied. Check your connection", failed: true });
    focusCount();
  };
  // Once deleted: back to My trips, which says what was deleted and puts focus on that message.
  const deleteAndLeave = async () => {
    const { name } = trip;
    setDeletedName(name);
    if (!(await deleteTrip(tripId))) {
      setDeletedName(null);
      return false;
    }
    setFlash(`Deleted ${name}`);
    router.replace("/");
    return true;
  };
  const packed = trip.items.filter((item) => item.packed).length;
  // The removed item stays on screen as a placeholder, in its old position (unless
  // the removal didn't save and it's back).
  const pending = feedback?.undo;
  const allRows =
    pending && !trip.items.some((item) => item.id === pending.item.id)
      ? [...trip.items.slice(0, pending.index), pending.item, ...trip.items.slice(pending.index)]
      : trip.items;
  const rows = hiddenIds ? allRows.filter((item) => !hiddenIds.has(item.id)) : allRows;

  return (
    <Page
      title={trip.name}
      back={BACK_TO_MY_TRIPS}
      wide
      airport={nearestAirport(trip.destination)}
      titleTransition={tripTitleTransition(trip.id)}
      // Only after mount: "in 7 days" depends on today, on the person's calendar.
      detail={trip.departsOn && now !== null ? departureLine(trip.departsOn, now) : undefined}
      titleAction={
        <TripOptions
          buttonRef={optionsButton}
          onRename={() => setOptions("rename")}
          onDeparture={() => setOptions("departure")}
          onDuplicate={duplicate}
          onDelete={() => setOptions("delete")}
        />
      }
    >
      {options === "rename" && (
        <RenameForm
          current={trip.name}
          otherTrips={storage.trips.filter((t) => t.id !== tripId)}
          onSave={async (name) => {
            const result = name === trip.name ? "saved" : await rename(name);
            if (result === "saved") closeOptions();
            return result;
          }}
          onCancel={closeOptions}
        />
      )}
      {options === "departure" && now !== null && (
        <DepartureForm current={trip.departsOn} today={localDay(now)} onSave={saveDeparture} onCancel={closeOptions} />
      )}
      {options === "delete" && <DeleteConfirm trip={trip} onDelete={deleteAndLeave} onCancel={closeOptions} />}

      {/* Phones: the weather first, then the list. Wider: the list on the left and the
          weather beside it, staying in view while the list scrolls. The weather comes
          first in the page either way, so the reading order matches a phone's screen. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-x-10">
        {/* Scrolls inside itself if it's taller than the window; the padding keeps focus
            rings clear of its edges. */}
        <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:-m-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-1">
          <Weather
            ref={weather}
            trip={trip}
            forecast={forecast}
            onSetDestination={saveDestination}
            onAdd={add}
            onAddDates={() => setOptions("departure")}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
          <ProgressBar
            packed={packed}
            total={trip.items.length}
            countId={COUNT_ID}
            allPacked={allPacked}
            takeoff={takeoff}
            onForgot={() => {
              // Centered, so the sticky bar doesn't cover the field.
              inputRef.current?.scrollIntoView({ block: "center" });
              inputRef.current?.focus({ preventScroll: true });
            }}
            onClearTicks={clear}
            hidingPacked={hiddenIds !== null}
            onTogglePacked={togglePacked}
            message={
              feedback?.text && (
                <>
                  {/* One line, so the bar keeps its height; the full text is still read out. */}
                  <p className="flex min-w-0 items-center gap-1.5">
                    {feedback.failed && <ErrorIcon className="" />}
                    <span className="truncate">{feedback.text}</span>
                  </p>
                  {feedback.undo && (
                    <TextButton
                      inline
                      id={UNDO_BAR_ID}
                      {...undoHoldProps(holdUndo)}
                      aria-label={`Undo removing ${feedback.undo.item.name}`}
                      onClick={() => feedback.undo && undoRemove(feedback.undo)}
                      className="shrink-0"
                    >
                      Undo
                    </TextButton>
                  )}
                </>
              )
            }
          />

          {/* In the page, not a modal, and it never takes focus on load. */}
          {now !== null && trip.lastPackedAt && shouldAskNewTrip(trip, now) && (
            <section role="region" aria-labelledby="new-trip-heading">
              <Card className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <SectionHeading id="new-trip-heading">Packing for a new trip?</SectionHeading>
                  {/* Why it's asking. Only after mount, so the date can use the person's time zone. */}
                  <p className="text-muted">Last packed {formatDay(trip.lastPackedAt)}.</p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={() => answer(true)}>Clear all ticks</Button>
                  <Button onClick={() => answer(false)}>Keep them</Button>
                </div>
              </Card>
            </section>
          )}

          <AddItemForm
            items={trip.items}
            onAdd={add}
            // Clears the bar's message; a pending Undo row stays, since nothing in the list changed.
            onError={() => setFeedback((current) => (current?.undo ? { ...current, text: null } : null))}
            inputRef={inputRef}
            forgotMode={allPacked}
          />

          {trip.items.length === 0 && !pending && (
            <EmptyState>
              <p>Nothing here yet. Add your first item.</p>
            </EmptyState>
          )}
          {trip.items.length > 0 && rows.length === 0 && (
            <EmptyState>
              <p>Everything here is packed and hidden. Show packed to see it.</p>
            </EmptyState>
          )}

          {groupBySection(rows).map((group) => (
            <section key={group.section} aria-labelledby={`section-${group.section}`} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <SectionHeading id={`section-${group.section}`}>{group.label}</SectionHeading>
                <SectionCount items={trip.items.filter((item) => item.section === group.section)} />
              </div>
              <Card padded={false}>
                <ul className="divide-y divide-line">
                  {group.items.map((item) =>
                    item.id === pending?.item.id ? (
                      <RemovedRow
                        key={`removed-${item.id}`}
                        name={item.name}
                        onUndo={() => undoRemove(pending)}
                        onHold={holdUndo}
                      />
                    ) : item.id === editingId ? (
                      <EditItem
                        key={`edit-${item.id}`}
                        item={item}
                        otherItems={trip.items.filter((other) => other.id !== item.id)}
                        onSave={(name, section) => saveEdit(item, name, section)}
                        onCancel={() => closeEdit(item.id)}
                      />
                    ) : (
                      <ItemRow
                        key={item.id}
                        item={item}
                        arrived={landed?.id === item.id ? landed.how : null}
                        justPacked={item.id === justPackedId}
                        onToggle={() => toggle(item.id)}
                        onEdit={() => setEditingId(item.id)}
                        onRemove={() => remove(item)}
                      />
                    ),
                  )}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      </div>
    </Page>
  );
}

// How much of a section is packed, beside its heading. Only items on the list count,
// not one just removed and waiting for Undo.
function SectionCount({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  const packed = items.filter((item) => item.packed).length;
  return (
    <p className="shrink-0 font-mono text-xs uppercase tracking-wider text-muted">
      {packed} of {items.length} packed
    </p>
  );
}
