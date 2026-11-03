import type { ReactNode } from "react";
import { BoardingPassPreview } from "./BoardingPassCard";
import { Page } from "./Page";

type AuthLayoutProps = { title: string; children: ReactNode };

// Sign in and sign up, on the same grid as every page: on a wide screen, a navy panel
// saying what Pack Again is beside Clerk's form, centered in its column; on a phone, the
// panel on top (without the sample pass, so the form stays near the top), then the form.
export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <Page title={title} back={{ href: "/", label: "Back to Pack Again" }} signedOut>
      <div className="grid gap-6 lg:grid-cols-2">
        <section
          data-surface="board"
          aria-label="About Pack Again"
          className="flex flex-col gap-3 rounded bg-board p-5 text-amber [--notch:var(--color-board)] lg:justify-center lg:gap-4 lg:p-8"
        >
          <p className="font-display text-3xl font-semibold uppercase tracking-wide lg:text-4xl">Pack Again</p>
          <p>Packing lists for trips you repeat: make one once, tick it off, and it’s ready next time.</p>
          <div className="mt-2 hidden lg:block">
            <BoardingPassPreview name="Beach weekend" code="AGP" packed={6} total={9} />
          </div>
        </section>
        <div className="flex items-center justify-center">{children}</div>
      </div>
    </Page>
  );
}
