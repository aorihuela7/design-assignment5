import type { Metadata } from "next";
import { LiveBoard } from "./LiveBoard";

export const metadata: Metadata = { title: "Live board" };

// Signed-in only, like every page but the landing page and sign-in (proxy.ts).
export default function LiveBoardPage() {
  return <LiveBoard />;
}
