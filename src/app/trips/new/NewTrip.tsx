"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { BoardingPassPreview } from "@/components/BoardingPassCard";
import { Button, ButtonLink } from "@/components/Button";
import { Card } from "@/components/Card";
import { NOT_SAVED } from "@/components/ErrorMessage";
import { TextField } from "@/components/Field";
import { LoadFailed } from "@/components/LoadFailed";
import { Page } from "@/components/Page";
import { tripNameMessage } from "@/components/tripNameMessage";
import { createId, createTrip, useStorage } from "@/lib/storage";
import { cleanName, tripNameProblem, tripTitleTransition } from "@/lib/trips";

export function NewTrip() {
  const router = useRouter();
  const storage = useStorage();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // No errors before the first submit; after it, the error follows what's typed.
  const [attempted, setAttempted] = useState(false);
  // Not saved, for a reason other than the name: said under the field until it changes.
  const [failed, setFailed] = useState(false);
  const saving = useRef(false);
  // Set on Create trip, so the preview's title can morph into the new page's title.
  // (An id can't be made during prerendering.)
  const [createdId, setCreatedId] = useState<string | null>(null);
  // Each visit starts empty: Next keeps New trip in the background (React's Activity),
  // and would show the last trip's name, or last time's error, again.
  useLayoutEffect(
    () => () => {
      setName("");
      setAttempted(false);
      setFailed(false);
      setCreatedId(null);
    },
    [],
  );

  // Once saved, the new trip is among them until the page leaves: left out, so it
  // doesn't clash with itself.
  const trips = (storage.status === "ready" ? storage.trips : []).filter((trip) => trip.id !== createdId);
  const nameProblem = attempted ? tripNameProblem(name, trips) : null;
  const previewName = cleanName(name);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (storage.status !== "ready" || saving.current) return;
    if (tripNameProblem(name, storage.trips)) {
      setAttempted(true); // keeps exactly what was typed
      inputRef.current?.focus();
      return;
    }
    const id = createId();
    setCreatedId(id);
    saving.current = true;
    const result = await createTrip(id, cleanName(name));
    saving.current = false;
    if (result === "saved") {
      // The empty list focuses its Add item field.
      router.push(`/trips/${id}`);
      return;
    }
    // A name taken in another tab or on another device shows like any other duplicate.
    if (result === "duplicate") setAttempted(true);
    else setFailed(true);
    inputRef.current?.focus();
  }

  return (
    <Page title="New trip" back={{ href: "/", label: "Back to My trips" }}>
      {storage.status === "failed" && <LoadFailed />}
      {/* Without the trips, names can't be checked: the form waits for Try again. */}
      {/* One short field: a readable width, not the full page. */}
      {storage.status !== "failed" && (
        <Card className="w-full max-w-xl">
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <TextField
              ref={inputRef}
              label="Trip name"
              error={nameProblem ? tripNameMessage(nameProblem) : failed ? NOT_SAVED : undefined}
              placeholder="e.g. Beach weekend"
              autoComplete="off"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFailed(false);
              }}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" variant="primary">
                Create trip
              </Button>
              <ButtonLink href="/">Cancel</ButtonLink>
            </div>
          </form>
        </Card>
      )}
      {storage.status !== "failed" && (
        <div className="flex w-full max-w-xl flex-col gap-2">
          <p aria-hidden="true" className="font-mono text-xs uppercase tracking-wider text-muted">
            Preview
          </p>
          <BoardingPassPreview
            name={previewName}
            titleTransition={createdId ? tripTitleTransition(createdId) : undefined}
          />
        </div>
      )}
    </Page>
  );
}
