import { createClient } from "@supabase/supabase-js";

// The browser's Supabase client, for one signed-in person. Every request carries their
// Clerk session token, so row-level security sees their Clerk user id as
// auth.jwt()->>'sub'; without a token it would run as anon, which can't see any table.
// Realtime gets the same token on connect and on every heartbeat, so its RLS sees the
// person too. Only the publishable key is used: the secret key never reaches the browser.
// onServerTime, if given, hears Supabase's own clock from each response's Date header,
// so ages can be worked out without trusting the device's clock.
export function createSupabaseClient(getToken: () => Promise<string | null>, onServerTime?: (serverMs: number) => void) {
  // A project's URL is only its origin. The REST endpoint the dashboard also shows
  // ("…/rest/v1") would double that path on every request, so any path is dropped.
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  const timedFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    const date = response.headers.get("date");
    // Date is in whole seconds, so on average half a second behind.
    if (date && onServerTime) onServerTime(Date.parse(date) + 500);
    return response;
  };
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    accessToken: getToken,
    ...(onServerTime ? { global: { fetch: timedFetch } } : {}),
  });
}
