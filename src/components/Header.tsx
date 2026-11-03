import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ViewTransition, type ReactNode } from "react";
import type { Airport } from "@/lib/airports";
import { FlipCode } from "./FlipCode";

export const PAGE_TITLE_ID = "page-title";

type HeaderProps = {
  // Current page name, shown large on the board and used as the page's h1.
  title: string;
  // At home (My trips, or the landing page) the home link is the current page.
  isHome?: boolean;
  // While the page's own name is loading: a blank bar on screen, the title for screen readers.
  titleLoading?: boolean;
  // A trip's nearest airport, its code as on its card, so the page reads as the same ticket.
  airport?: Airport | null;
  // Shared with the trip's card title, which morphs into this one on opening.
  titleTransition?: string;
  // Pages for signed-out visitors offer Sign in and Sign up; the rest, the account menu.
  signedOut?: boolean;
  // A trip's page is wider, for its list and its weather side by side.
  wide?: boolean;
  // Beside the title, like a trip's options menu.
  titleAction?: ReactNode;
  // A line under the title, like a trip's departure.
  detail?: string;
};

// Amber caps on the band; the accent stays for each page's primary action.
const bandLink =
  "-mx-1 inline-flex min-h-11 shrink-0 items-center rounded px-1 underline-offset-4 active:bg-amber active:text-board";

export function Header({
  title,
  isHome = false,
  titleLoading = false,
  airport,
  titleTransition,
  signedOut = false,
  wide = false,
  titleAction,
  detail,
}: HeaderProps) {
  return (
    <header data-surface="board" className="bg-board text-amber">
      <div className={`mx-auto w-full ${wide ? "max-w-288" : "max-w-225"} px-4 pt-3 pb-5 sm:px-6`}>
        <div className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest">
          <Link href="/" aria-current={isHome ? "page" : undefined} className={`${bandLink} hover:underline`}>
            Pack Again
          </Link>
          <div className="ml-auto flex items-center gap-4">
            {airport && (
              <span>
                <FlipCode code={airport.code} />
                <span className="sr-only">
                  Nearest airport: {airport.name} ({airport.code})
                </span>
              </span>
            )}
            {signedOut ? (
              <>
                <Link href="/sign-in" className={`${bandLink} underline hover:decoration-2`}>
                  Sign in
                </Link>
                <Link href="/sign-up" className={`${bandLink} underline hover:decoration-2`}>
                  Sign up
                </Link>
              </>
            ) : (
              // Sized before Clerk loads the button, so the band doesn't shift. Sign out is in its menu.
              <div className="flex size-11 items-center justify-center">
                <UserButton />
              </div>
            )}
          </div>
        </div>
        {/* The title, then anything beside it: under it on a phone, so the band's height
            doesn't depend on how long the title is; beside it on wider screens. */}
        <div className="mt-1 flex flex-col items-start sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-4">
          {/* tabIndex -1: pages can move focus here on arrival; no ring, since it isn't a control.
              As wide as its text, so the morph from a card scales it evenly. */}
          <TitleTransition name={titleTransition}>
            <h1
              id={PAGE_TITLE_ID}
              tabIndex={-1}
              className="w-fit font-display text-4xl font-semibold uppercase tracking-wide wrap-anywhere outline-none sm:text-5xl"
            >
              {titleLoading ? (
                <>
                  <span className="sr-only">{title}</span>
                  <span aria-hidden="true" className="inline-block h-[0.7em] w-[6em] max-w-full rounded bg-white/10" />
                </>
              ) : (
                title
              )}
            </h1>
          </TitleTransition>
          {titleAction}
        </div>
        {detail && <p className="mt-1 font-mono text-xs uppercase tracking-widest">{detail}</p>}
      </div>
    </header>
  );
}

// Only a trip's title takes part in the morph; other titles change with the page.
function TitleTransition({ name, children }: { name?: string; children: ReactNode }) {
  if (!name) return children;
  return (
    <ViewTransition name={name} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
