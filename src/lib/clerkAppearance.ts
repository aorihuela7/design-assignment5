import type { NextClerkProviderProps } from "@clerk/nextjs/types";

// Clerk's sign-in, sign-up and account menu in the Departures theme, from the same
// color tokens as the rest of the app. Text inherits B612 from the page.
export const clerkAppearance: NextClerkProviderProps["appearance"] = {
  // Clerk's styles go in their own CSS layer, so the app's focus ring and
  // utility classes come after them (see globals.css).
  cssLayerName: "clerk",
  variables: {
    // Clerk also uses its primary color for links, so it's ink here; only
    // Continue, the primary action, gets the accent (below).
    colorPrimary: "var(--color-ink)",
    colorPrimaryForeground: "var(--color-surface)",
    colorForeground: "var(--color-ink)",
    colorMutedForeground: "var(--color-muted)",
    colorBackground: "var(--color-surface)",
    colorInput: "var(--color-surface)",
    colorInputForeground: "var(--color-ink)",
    colorNeutral: "var(--color-ink)",
    colorBorder: "var(--color-muted)",
    // Errors stay ink, with Clerk's icon beside them, as in the app's own forms.
    colorDanger: "var(--color-ink)",
    colorRing: "var(--color-ink)",
    fontFamilyButtons: "var(--font-b612-mono), ui-monospace, monospace",
    borderRadius: "var(--radius)",
  },
  elements: {
    // Like the app's primary button: flat accent, no gradient or shadow.
    formButtonPrimary:
      "bg-accent bg-none text-white uppercase tracking-wider shadow-none hover:bg-accent-hover active:bg-accent-pressed",
    // Like the app's cards: a 1px line, no drop shadow.
    cardBox: "rounded border border-line shadow-none",
    footerActionLink: "underline underline-offset-4 hover:decoration-2",
    // The account button on the band: a 32px avatar in a 44px target.
    userButtonTrigger: "rounded-full p-1.5",
    avatarBox: "size-8",
  },
};

// Clerk's own wording, except the title, which otherwise names the Clerk app
// ("Sign in to My Application"), shared with Assignment 4.
export const clerkLocalization: NextClerkProviderProps["localization"] = {
  signIn: { start: { title: "Sign in to Pack Again" } },
};
