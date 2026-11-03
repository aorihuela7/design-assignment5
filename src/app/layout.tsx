import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { B612, B612_Mono, Barlow_Condensed } from "next/font/google";
import { clerkAppearance, clerkLocalization } from "@/lib/clerkAppearance";
import "./globals.css";

// Self-hosted by next/font: downloaded at build time, served from this app.
const b612 = B612({
  variable: "--font-b612",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const b612Mono = B612_Mono({
  variable: "--font-b612-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: "600",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Pack Again", template: "%s · Pack Again" },
  description: "Packing lists for trips you repeat.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${b612.variable} ${b612Mono.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Sign-in and sign-up are pages in the app, so they keep the Departures header. */}
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" appearance={clerkAppearance} localization={clerkLocalization}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
