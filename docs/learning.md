# Learning journal

The "Ask Your Agent" prompt from each step of Assignment 4, and the answer, in step order.

## Step 0: Free tiers

> "Walk me through the free tier limits for each service my app uses, and how to set usage limits and spending alerts for each one."

Researched 22 Oct 2026 from each service's official pages. A few Clerk facts come from search excerpts of its pricing and docs pages, which couldn't be fetched in full; they are marked *(excerpt)*. Anything that couldn't be confirmed says so.

**In short:** none of these needs a payment method for what Pack Again uses, and none can charge you on its free plan. The risk is being *stopped*, not billed: Vercel pauses the site, Supabase pauses the project after a week without use, and Clerk and Open-Meteo refuse requests. Only GitHub has real budget alerts; elsewhere you watch a usage page.

### Clerk (free plan, development keys)
- **Users:** 50,000 monthly retained users on the free plan *(excerpt)*. A development instance is capped at 100 users *(excerpt)*, plenty for classmates.
- **Messages:** development instances send at most 100 emails and 20 SMS a month. Messages to Clerk's test addresses don't count, so the Playwright test should use them.
- **Rate limits:** the Backend API allows 100 requests per 10 seconds in development. Sign-in and sign-up allow 5 per 10 seconds per IP. Over a limit you get HTTP 429 with `Retry-After`.
- **Limits and alerts:** no spending cap or usage alert is documented (not confirmed). There's nothing to bill on the free plan, and no card is required *(excerpt)*.

### Supabase (Free plan)
- **Limits:** 500 MB of database, 5 GB of egress (plus 5 GB cached), 1 GB of file storage, and 2 active free projects. API requests are unlimited. Clerk users count against a separate allowance of 50,000 third-party monthly active users.
- **Pausing:** a free project is paused after 7 days of low activity, with a warning email first. Resume it from Dashboard › your organization › the paused project › Resume project. How long a paused project can be restored is unclear: the docs say both 90 days and 1 year. Open the app every few days until grades are back.
- **At the limit:** Free is never charged. You're notified, and sustained overuse gets the service restricted.
- **Limits and alerts:** the Spend Cap (Organization › Billing › Cost Control) exists only on Pro. On Free, watch Organization › Usage. No usage alerts are documented.

### Vercel (Hobby)
- **Per month:** 1M function invocations, 4 hours of active CPU, 100 GB of Fast Data Transfer, 10 GB of Fast Origin Transfer, 1M CDN requests and 5,000 image transformations.
- **Builds:** 45-minute build limit and 100 deployments a day.
- **Terms:** Hobby is for personal, non-commercial use only.
- **At the limit:** you can't buy more. The project is paused and the site returns "503 DEPLOYMENT_PAUSED". One help article says you resume each project yourself, after cutting usage or upgrading.
- **Limits and alerts:** Spend Management isn't available on Hobby. Vercel emails you as you near and pass a limit *(excerpt)*. Watch Dashboard › Usage.
- **Payment method:** whether Hobby signup asks for a card is not confirmed. If it does, don't add one.

### Open-Meteo (free, non-commercial)
- **Limits:** under 600 calls a minute, 5,000 an hour, 10,000 a day and 300,000 a month (the monthly one isn't enforced yet). No uptime guarantee.
- **At the limit:** rate-limited. Misuse can be blocked without notice.
- **Shared IPs:** limits are counted per IP address and per application, and Vercel's server IPs are shared with many apps. This matters for step 6.
- **Limits and alerts:** none. No key, no account and nothing to bill.

### GitHub (free personal account)
- **Actions:** not used by Pack Again. If they ever are: free on public repos, 2,000 minutes a month on private ones, and with no payment method, usage is blocked at the quota.
- **Limits and alerts:** github.com/settings/billing › Budgets and alerts › New budget, with "Stop usage when budget limit is reached" and alerts at 75%, 90% and 100%. Whether a $0 budget is set by default couldn't be confirmed.

### What to do as each account is created
1. **Clerk (step 4):** don't add a card, and use test emails in tests.
2. **Supabase (step 5):** stay on Free, no card, and bookmark Organization › Usage.
3. **Vercel (step 8):** stay on Hobby, no card, and check Dashboard › Usage after the classmate test.
4. **GitHub:** nothing needed while Actions are unused.

Sources:
- **Clerk:** [pricing](https://clerk.com/pricing), [environments](https://clerk.com/docs/guides/development/managing-environments), [test emails](https://clerk.com/docs/guides/development/testing/test-emails-and-phones), [system limits](https://clerk.com/docs/guides/how-clerk-works/system-limits)
- **Supabase:** [pricing](https://supabase.com/pricing), [pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [cost control](https://supabase.com/docs/guides/platform/cost-control), [third-party MAU](https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users-third-party)
- **Vercel:** [Hobby](https://vercel.com/docs/plans/hobby), [limits](https://vercel.com/docs/limits), [paused deployments](https://vercel.com/kb/guide/why-is-my-account-deployment-blocked)
- **Open-Meteo:** [terms](https://open-meteo.com/en/terms)
- **GitHub:** [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [budgets](https://docs.github.com/en/billing/concepts/budgets-and-alerts)

## Step 1: The Open-Meteo response

> "Explain this response: what each field means, and which ones my tool needs."

Pack Again uses two Open-Meteo APIs, both without a key: the place search (geocoding) to find a trip's destination, and the forecast for that place. Calls made on 22 Oct 2026.

### Place search

`GET https://geocoding-api.open-meteo.com/v1/search?name=Valparaíso&count=5&language=es&format=json`

```json
{
  "results": [
    {
      "id": 3868626, "name": "Valparaíso",
      "latitude": -33.036, "longitude": -71.62963, "elevation": 15.0,
      "feature_code": "PPLA", "country_code": "CL", "country": "Chile",
      "admin1": "Región de Valparaíso", "admin2": "Valparaíso", "admin3": "Valparaíso",
      "timezone": "America/Santiago", "population": 282448
    }
  ],
  "generationtime_ms": 0.6
}
```

Four more Valparaísos come back: Indiana (US), Zacatecas (Mexico), and Caquetá and Antioquia (Colombia). Results are sorted by population.

| Field | Meaning | Needed? |
|---|---|---|
| `results` | The matching places. **Missing entirely** when nothing matches. | Yes: missing means "no places found" |
| `id` | GeoNames' permanent id for the place | Yes: a stable key for the place picked |
| `name` | Place name, in the language asked for | Yes |
| `admin1` | Region or state | Yes: tells same-name places apart |
| `country`, `country_code` | Country name and two-letter code | Yes: also tells them apart |
| `latitude`, `longitude` | The place's coordinates | Yes: the forecast needs them |
| `timezone` | The place's time zone | Maybe: the forecast gets it with `timezone=auto` |
| `admin2`, `admin3`, `*_id`, `feature_code`, `population`, `elevation`, `postcodes` | Smaller divisions, ids, place type, size, height, postal codes (some often missing) | No |
| `generationtime_ms` | Server time | No |

**Nothing found** (`zzqxv`, an empty name or a single letter) returns HTTP 200 and only `{"generationtime_ms": 0.05}`, with no `results` key at all, not even an empty list.

### Forecast

`GET https://api.open-meteo.com/v1/forecast?latitude=-33.036&longitude=-71.62963&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=auto&forecast_days=7`

```json
{
  "latitude": -33.075573, "longitude": -71.64618,
  "timezone": "America/Santiago", "timezone_abbreviation": "GMT-3", "utc_offset_seconds": -10800,
  "elevation": 11.0,
  "daily_units": { "temperature_2m_max": "°C", "precipitation_probability_max": "%", "uv_index_max": "", "wind_speed_10m_max": "km/h", "…": "…" },
  "daily": {
    "time": ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"],
    "weather_code": [53, 51, 1, 3, 51, 3, 3],
    "temperature_2m_max": [19.1, 18.0, 17.7, 22.3, 19.0, 20.2, 21.0],
    "temperature_2m_min": [14.0, 12.4, 11.1, 13.5, 15.4, 15.0, 13.9],
    "precipitation_probability_max": [100, 100, 2, 0, 12, 14, 0],
    "uv_index_max": [8.2, 8.1, 8.35, 7.95, 5.35, 8.5, 8.4],
    "wind_speed_10m_max": [17.3, 21.0, 22.4, 22.7, 16.7, 20.1, 12.0],
    "wind_gusts_10m_max": [47.2, 49.7, 51.8, 50.8, 40.3, 47.9, 32.4],
    "wind_direction_10m_dominant": [357, 203, 194, 188, 205, 200, 244]
  }
}
```

The daily values are parallel arrays: day `i` is position `i` in every array.

| Field | Meaning | Needed? |
|---|---|---|
| `daily.time` | Each day's local date, today first | Yes: day labels |
| `daily.temperature_2m_max`, `_min` | Highest and lowest air temperature that day, 2 m above ground, °C | Yes: warm layers or light clothes |
| `daily.precipitation_probability_max` | Highest chance of rain in any hour that day, 0–100% | Yes: umbrella, rain jacket |
| `daily.weather_code` | WMO code for the day's main weather (1 mainly clear, 3 overcast, 51/53 drizzle) | Yes: a word or icon per day, from our own code table |
| `daily.uv_index_max` | Strongest sun that day (no unit; 8+ is very high) | Yes: sunscreen, hat |
| `daily.wind_speed_10m_max` | Strongest sustained wind, km/h | Yes: windbreaker |
| `daily.wind_gusts_10m_max` | Strongest gust, km/h | Optional |
| `daily.wind_direction_10m_dominant` | Where the wind mostly comes from, degrees | No |
| `daily_units` | The unit of each field | No: fixed by what we ask for |
| `timezone`, `timezone_abbreviation`, `utc_offset_seconds` | The time zone of the dates | No: `timezone=auto` gives local dates already |
| `latitude`, `longitude`, `elevation` | The model's grid point, slightly off from the place | No |
| `generationtime_ms` | Server time | No |

### Errors

Any invalid request returns HTTP 400 with `{"error": true, "reason": "…"}`. For example: "Latitude must be in range of -90 to 90°. Given: 200.0.", "Invalid timezone", "Forecast days is invalid. Allowed range 0 to 16." The reasons can be technical, so the app checks `error` and shows its own message. Responses have no rate-limit headers.

### So the tool needs

- **From the search:** `id`, `name`, `admin1`, `country`, `latitude` and `longitude`. A result reads "Valparaíso · Región de Valparaíso, Chile".
- **From the forecast:** `time`, `weather_code`, `temperature_2m_max` and `_min`, `precipitation_probability_max`, `uv_index_max` and `wind_speed_10m_max`.
- **What's saved:** probably only the place. The forecast can be fetched fresh each time.

### Terms (free, non-commercial)

- **Use:** non-commercial only. Educational projects qualify.
- **Limits:** under 600 calls a minute, 5,000 an hour, 10,000 a day and 300,000 a month. A request with more than 10 variables, or more than 2 weeks of data, counts as more than one call.
- **Credit:** under CC BY 4.0, a "Weather data by Open-Meteo.com" link to https://open-meteo.com/ must sit next to the weather.
- **Shared IPs:** limits are counted per IP address and per application. Apps on Vercel can hit them sooner, because Vercel's IPs are shared.
- **Privacy:** server logs, which can include the coordinates requested, are kept for 90 days.

Sources: [terms](https://open-meteo.com/en/terms), [licence](https://open-meteo.com/en/licence), [pricing](https://open-meteo.com/en/pricing).

## Step 5: Row-level security, in plain words

> "Explain each row-level security policy in plain words, then show me a query that one of them would block."

Every request from the app carries the signed-in person's Clerk session token. Supabase checks it, and `auth.jwt()->>'sub'` is then their Clerk user id, like `user_2abc…`. Every policy compares that id with the row's `user_id`. The `(select …)` around it makes Postgres read the token once per query, not once per row.

Two layers decide what a query may do:

- **Grants** say which kinds of query a role may run at all. Signed-out visitors (`anon`) have none, so their queries fail before any policy is read. Signed-in people (`authenticated`) may select, insert, update and delete trips and items, but only select and insert profiles.
- **Policies** then say which rows. With row-level security on, anything no policy allows is refused.

A policy has up to two parts:

- **USING** picks the existing rows a query can see or touch. The others are skipped silently: the query gets 0 rows, not an error.
- **WITH CHECK** tests a row as it will be after an insert or update. If the row fails, the query is an error and nothing is written.

### trips

| Policy | In plain words |
|---|---|
| Select own trips | You see only the trips whose `user_id` is yours. |
| Insert own trips | A new trip must be yours. The app never sends `user_id` (it defaults to your id), so this stops anyone sending someone else's. |
| Update own trips | You can change only your own trips, and the result must still be yours, so a trip can't be given away. |
| Delete own trips | You can delete only your own trips. Their items go with them. |

### items

| Policy | In plain words |
|---|---|
| Select own items | You see only your own items. |
| Insert own items into own trips | A new item must be yours, and so must the trip it goes on. Knowing someone's trip id isn't enough to add to their list. |
| Update own items in own trips | You can change only your own items, and only within your own trips, so an item can't be moved onto someone else's list. |
| Delete own items | You can delete only your own items. |

### profiles

| Policy | In plain words |
|---|---|
| Select own profile | You see only your own profile, which records that your starter trips were made. |
| Insert own profile | You can make only your own profile. |

There's no update or delete policy, and no grant for them. A profile can't be changed or deleted, so the starter trips are never made twice. `add_starter_trips` runs as the caller (`security invoker`), so its inserts go through the same policies, and signed-out visitors can't call it.

### A query a policy blocks

Account B is signed in and knows the id of one of A's trips, from a shared link for example. In the browser's console, B tries to add an item to A's list:

```js
await supabase.from("items").insert({ trip_id: "<A's trip id>", name: "Sneaky", section: "other" });
```

Supabase refuses it with error `42501`: `new row violates row-level security policy for table "items"`. The WITH CHECK of "Insert own items into own trips" found that the trip isn't B's, so nothing was written.

To see it yourself, run this in Supabase › SQL Editor. The editor runs as the database owner, so it pretends to be A and then B, and `rollback` keeps nothing:

```sql
begin;
set local role authenticated;

-- Signed in as A: a trip of A's.
select set_config('request.jwt.claims', '{"sub":"user_a","role":"authenticated"}', true);
insert into public.trips (name) values ('Only A');
select set_config('demo.trip', (select id::text from public.trips where name = 'Only A'), true);

-- Signed in as B: the same trip id, someone else's list.
select set_config('request.jwt.claims', '{"sub":"user_b","role":"authenticated"}', true);
insert into public.items (trip_id, name, section)
values (current_setting('demo.trip')::uuid, 'Sneaky', 'other');
-- ERROR: 42501: new row violates row-level security policy for table "items"

rollback;
```

What the other policies did, run the same way on 23 Oct with two pretend users (all rolled back):

| Signed in as | Query | Result | Because of |
|---|---|---|---|
| B | `select count(*) from trips` | 1, only B's trip | Select own trips |
| B | `select … from trips where id = '<A's trip>'` | 0 rows | Select own trips |
| B | `update trips set name = 'Hacked' where id = '<A's trip>'` | 0 rows changed, no error | Update own trips (USING) |
| B | `delete from items where id = '<A's item>'` | 0 rows deleted, no error | Delete own items |
| B | `insert into trips (name, user_id) values ('Fake', '<A's id>')` | Error 42501 | Insert own trips (WITH CHECK) |
| B | `delete from profiles` | Error 42501: permission denied | No grant to delete profiles |
| Signed out | `select … from trips` | Error 42501: permission denied | `anon` has no grants |

## Step 6: One request, from the click to the screen

> "Draw a diagram of one request, from the click to the screen: the browser, my server, Clerk, Supabase, and the API."

The diagram is in [request-flow.md](request-flow.md). It follows one click: choosing "Lisbon, Lisbon District, Portugal" in a list's destination search.

- **Our Next.js server** served the page earlier and checked the session in `proxy.ts`. It plays no part in the click.
- **The browser** gets a session token from Clerk and saves the destination in Supabase with it. Supabase checks the token, then row-level security checks that the trip is the person's.
- **The forecast** comes straight from Open-Meteo to the browser, with no key, token or cookie. That's the step 6 decision: no key to hide, each person's own rate limit instead of Vercel's shared IPs, and no function calls on Hobby. The cost is that Open-Meteo sees each person's IP address.

## Step 7: One end-to-end test, seen failing before it passed

> "Explain why the test failed when I broke row-level security, in one sentence I could say in class."

The test failed because my temporary policy let Supabase send every trip to anyone signed in, so person A's My trips showed person B's list, which proves that row-level security, not the app's code, is what keeps each person's lists private.

### The test

[`e2e/isolation.spec.ts`](../e2e/isolation.spec.ts), run with `npm run test:e2e`:

1. Two Clerk test users, A and B, sign in at the same time, each in a browser context of their own. Clerk's `clerk.signIn` signs them in with a one-time sign-in token, and `clerkSetup()` gets a Testing Token past Clerk's bot protection.
2. Each saves a list with a unique name and an item.
3. Each sees their own list on My trips, and not the other's.
4. Opening the other's list by its address shows "Trip not found".
5. Each deletes their own list at the end, even when a check fails.

It needs `E2E_USER_A_EMAIL` and `E2E_USER_B_EMAIL` in `.env.local`, the emails of two users in the Clerk development instance. It starts its own `next dev` on port 3100, so stop yours first, or point it at yours with `E2E_BASE_URL`.

The first run also found a real problem. `NEXT_PUBLIC_SUPABASE_URL` held the REST endpoint (`…/rest/v1`), so every query went to `/rest/v1/rest/v1/trips` and no one's trips could load. The app now uses only the URL's origin.

### Broken on purpose: it fails

Migration [`20261023074853_step7_break_trips_select.sql`](../supabase/migrations/20261023074853_step7_break_trips_select.sql) added a second select policy on `trips`, `using (true)`. Policies of the same kind are combined with OR, so every signed-in person could read every trip. The test failed at the check that matters (23 Oct; the dev server's log lines are left out and paths shortened):

```
Running 2 tests using 1 worker

  ✓  1 [setup] › e2e/global.setup.ts:8:6 › Clerk testing token (263ms)
  ✘  2 [isolation] › e2e/isolation.spec.ts:43:5 › two people never see each other's lists (30.4s)

  1) [isolation] › e2e/isolation.spec.ts:43:5 › two people never see each other's lists › A sees their own list on My trips, and not the other's

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  getByRole('link', { name: 'E2E B mvko55kj', exact: true })
    Expected: 0
    Received: 1
    Timeout:  15000ms

    Call log:
      - Expect "toHaveCount" getByRole('link', { name: 'E2E B mvko55kj', exact: true }) with timeout 15000ms
      - waiting for getByRole('link', { name: 'E2E B mvko55kj', exact: true })
        34 × locator resolved to 1 element
           - unexpected value "1"

      61 |         await person.page.goto("/");
      62 |         await expect(person.page.getByRole("link", { name: person.list, exact: true })).toBeVisible();
    > 63 |         await expect(person.page.getByRole("link", { name: other.list, exact: true })).toHaveCount(0);
         |                                                                                        ^
      64 |       });
      65 |     }
      66 |
        at e2e/isolation.spec.ts:63:88
        at e2e/isolation.spec.ts:59:7

  1 failed
    [isolation] › e2e/isolation.spec.ts:43:5 › two people never see each other's lists
  1 passed (33.9s)
```

### Fixed: it passes

[`20261023212046_step7_restore_trips_select.sql`](../supabase/migrations/20261023212046_step7_restore_trips_select.sql) drops that policy. It was run by hand in Supabase › SQL Editor: the Supabase MCP server asks for confirmation before a drop, and that question couldn't reach us from the agent's session, so it declined twice. Because of that it isn't in Supabase's migration history.

The policies are back to the originals (4 on trips, 4 on items, 2 on profiles), the security advisor reports nothing, and the test passes again:

```
Running 2 tests using 1 worker

  ✓  1 [setup] › e2e/global.setup.ts:8:6 › Clerk testing token (349ms)
  ✓  2 [isolation] › e2e/isolation.spec.ts:43:5 › two people never see each other's lists (18.8s)

  2 passed (21.2s)
```

## Step 8: Security review

`/security-review` ran on `assignment-4` (compared with `main`) on 23 Oct. It found **no vulnerabilities** above its bar (high or medium, confidence 8 of 10 or more).

What it checked and ruled out:

- **Row-level security:** every table has separate select, insert, update and delete policies for signed-in users, keyed on `auth.jwt()->>'sub'`. Signed-out visitors (`anon`) have no grants. No one can create rows for someone else or give a trip away, and an item can't move onto another person's trip.
- **Functions and triggers:** `add_starter_trips` and `touch_trip` run as the caller, with `search_path = ''`, so their writes also go through row-level security.
- **Secrets:** the browser uses only the publishable key and the Clerk session token, and there are no secrets in the diff.
- **Injection:** queries go through the parameterised query builder, and Open-Meteo URLs are built with `URLSearchParams` against fixed hosts.
- **XSS:** there's no `dangerouslySetInnerHTML`, and links are made from database UUIDs or fixed paths.
- **Development-only code:** the `?weather=` simulation is left out of production builds.

It also raised four lower-risk points, plus one you added. Here's what we did with each:

| Point | Real risk here? | Decision |
|---|---|---|
| The step 7 restore migration wasn't idempotent, and it was run by hand, so it isn't in the migration history | Small. In filename order the restore runs after the break, so a fresh project ends up secure. But a `db push` on this project would stop on `drop policy`, and a restore that failed after the break would leave a database open. | **Fixed** (`760da64`): `drop policy if exists`, so it never fails and does nothing where it already ran. Its version sorts after the break. The README's Database section explains the pair and how to check for 4, 4 and 2 policies. |
| The Supabase MCP server could write to the database | Not for the app, which never uses it. It is a risk for development: an agent, or instructions hidden in data it reads, could change the real database. | **Fixed** (`0e02276`): `read_only=true` in `.mcp.json`. New migrations go through the SQL Editor, or by switching it back on purpose. |
| Playwright keeps a trace of a failed test, including the test users' cookies and tokens | Low. They belong to development-instance test accounts, stay on this computer, and `test-results/` is git-ignored. | **Not fixed:** the trace is the best way to see why a test failed, and these tokens open nothing real. |
| Clerk's `createRouteMatcher` is deprecated, and a path-based check can leave protected server resources reachable | Not here: the pages hold no data on the server. Everything comes from Supabase under row-level security, so even a skipped page check would show nothing. | **Not fixed:** moving `auth.protect()` into every page is a bigger change for no gain today. Revisit before Clerk removes the function. |

## Polish pass 2

A second pass on design and features, on the `polish` branch, in batches. Screenshots of every screen before and after are in [`docs/polish-2/`](polish-2/).

### Batch 1: the trip page in two zones

**What changed.** The trip page now has two zones:

- **The list:** the runway and count with Clear all ticks, a compact Add item form, then the sections.
- **The weather:** the destination with Change and Remove, today's summary, the next 7 days, Pack for this weather and the credit to Open-Meteo. On wider screens it's a panel beside the list; on a phone, one block at the top that opens and closes.

Rename and Delete moved into a Trip options menu beside the title.

**Why.** The weather was split in two, a summary at the top and the forecast after the list, so it pushed the list down and was easy to miss. Rename and Delete sat under the list, though they're rare and Delete can't be undone.

**What I learned.**

- **Next.js keeps pages alive.** Next 16 keeps up to three visited pages in React's `<Activity>`, so going back shows a page as you left it, state and all (`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`). Anything passing has to be reset when the page is hidden, in a `useLayoutEffect` cleanup: an open menu, the phone's open weather block, a Rename card. The same behavior causes two older bugs found while taking the screenshots. My trips doesn't say "Deleted …", and a card you've opened can't be opened again. Batch 2 fixes both.
- **A sticky panel in a grid needs `align-items: start`.** Otherwise the panel stretches to the row's height and has nowhere to stick. It also needs a maximum height and its own scroll for windows shorter than it, with a little padding so focus rings aren't cut off at its edges.
- **The forecast board sizes itself by its own width.** A container query, not the window's width: it's a 24rem panel on a laptop and full width on a phone.
- **Page order is a trade-off.** The weather comes first in the page, so on a phone the closed block at the top is the first stop. On wider screens, Tab visits the panel before the list.
- **A minifier surprise:** Tailwind's `[border-image:none]` came out as an empty `border-image:` in the built CSS, which the browser ignores. `border-image-source: none` works.
- **The loading state is shaped like the page,** and measured: nothing moves when the trip arrives, at 390px or 1440px.

### Batch 2: destination codes, and pages kept in the background

**What changed.**

- **Destination codes:** a trip with a destination is coded by its city's first 3 letters, without accents (Madrid MAD, Málaga MAL, São Paulo SAO). Without one, it keeps its name's code.
- **Four bugs fixed,** all from one cause, and all in production too:
  - A card you'd opened kept its plane at the end of the runway and wouldn't open again.
  - My trips didn't say "Deleted …".
  - New trip came back with the last trip's name, and Create trip then did nothing.
  - A trip opened again kept its last message and didn't put focus on its name.

**What I learned.**

- **Seen failing first.** A script opened and closed every trip, by the Back link and by the browser's back, and compared each card's plane with its count. On the old code it found planes stuck at 100%, cards that wouldn't open again and the missing "Deleted …". Extended, it found the other two bugs. All 23 of its checks pass now.
- **`useParams()` follows the page on screen, even in a kept page.** While My trips showed, each kept trip page looked for a trip with no id and rendered "Trip not found" out of sight. It tore its list down and built it again on the next visit. That's why its message stayed (it belongs to the page, which stayed) while its form came back empty. The fix is Next's own pattern: the route passes its `params` promise into Suspense, and the list reads it with `use()`.
- **A message to say once needs a store.** "Deleted …" was read into My trips' state when the page was first made, and a kept page isn't made again. It's now read from a small store each time the page shows (`useSyncExternalStore`), and cleared once the page is hidden. In development React mounts everything twice, so the clear waits a moment, and the second mount cancels it.
- **Resetting on hide is the general fix.** Next's guide resets passing state in a `useLayoutEffect` cleanup, which runs when the page is hidden. The card's takeoff, the trip page's message and Undo, its forms and its arrival focus all reset that way. Each page starts fresh, as it did before. Kept pages still make going back instant.
- **Codes that don't move.** Name codes are worked out among all the trips, with or without destinations. Setting or removing one trip's destination never changes another trip's code.

### Batch 3: a more delightful My trips

**What changed.**

- **A greeting:** the time of day and the first name from the person's account, then one line on where the trips stand. "Welcome back" and the starter trips' invitation fold into that line.
- **Where each trip goes and its weather today,** on its card, or an invitation to add a destination.
- **A status stamp:** NOT STARTED, BOARDING n% or PACKED.
- **Motion:** the tickets' entrance, a lift on hover and focus, the stamp pressing on, and the code flipping when the destination changes.

**What I learned.**

- **One forecast, counted.** The cards use the trip page's forecast, kept in the tab for 30 minutes. A request already on its way is shared too, so two cards for one city make one call between them. Counted on the network: My trips asked twice, once for each destination, and opening both trips asked nothing more. With Open-Meteo blocked, both cards said "Weather unavailable" and still opened.
- **Animations that don't replay.** A kept page is hidden with `display: none`, and showing it again restarts any CSS animation still on an element. So each new one-off animation runs from script (the Web Animations API) in a layout effect, which plays it once before the first paint. It's only played when something changed since the person last saw it: the tickets' first appearance in the tab, a status or a code that differs from the one shown before.
- **Checking motion by recording it.** A 200ms animation is easily over before a test looks. The check replaced `Element.animate` in the page to record every call. The tickets animate once, nothing replays coming back from a trip, a code flips exactly when it changes, and with reduced motion nothing does at all.
- **The greeting needs the browser.** The time of day and the name are only known there. My trips first shows "Loading your trips…" in the same two-line shape, so nothing moves when they arrive (measured: the first ticket stays put at both widths).

### Batch 4: features

**What changed.**

- **Progress per section:** "2 of 3 packed" beside each heading.
- **Hide packed,** in the packing bar.
- **Edit an item in place:** rename it or move it to another section.
- **Duplicate a trip,** from Trip options.
- **A fix from batch 1:** on a phone, "All packed." keeps the bar to one line.
- **A departure date,** optional: a countdown on the card, My trips sorted by what's leaving next, and the trip's weather from that day once the 16-day forecast reaches it. Its migration adds one nullable column; row-level security is unchanged.

**What I learned.**

- **Check a fixed height at every width and in every state.** Batch 1 measured the packing bar at 65px, but at 1440px. At 390px, "All packed. Have a good trip." wrapped beside Clear all ticks, and the bar grew 28px just as the last item was ticked. Measured now at 390, 640, 1024 and 1440 in every state: 65px.
- **Hiding is a snapshot.** Hiding each item as it's ticked would pull the next row under the finger, the same trap as the first round's removals. So Hide packed hides what was packed when it was pressed.
- **"Next frame" isn't "after React's render".** When an edited item moves to another section, its row is a new element, and focusing it in the next animation frame sometimes ran before React had drawn it (focus fell to the page). The list now notes which Edit button should get focus, and a layout effect focuses it after the render that shows it.
- **Two writes and no transaction.** Supabase's client can't group writes without a function in the database, which would have been a database change. So Duplicate inserts the trip, then its items, and deletes the copy again if the items fail.
- **Adding buttons costs words their room.** With Edit beside Remove, 6 of a trip's 15 names wrapped on a phone. Narrower row buttons (still 44px targets) brought it to 2.
- **Checking the database without its keys.** The test browser replayed one of the app's own Supabase requests, asking for the new column, and read only the status. Postgres answered 42703 (undefined column), so the migration hadn't run yet. The departure date's commits waited on a branch of their own, unpushed, so the preview never asked for a column that wasn't there. Once the column existed, they moved back onto `polish` with a clean rebase.
- **A migration run by hand must be safe to run again.** Like the step 7 restore, it isn't in Supabase's migration history, so a later `db push` would try it again. `add column if not exists` makes that do nothing.
- **The dev server can serve old CSS after a rebase.** The rebase briefly checked out the older `globals.css`, and Turbopack kept serving it after the switch back. The dark screenshots came out light. Restarting my dev server fixed it, and a script now checks that every screenshot is in its theme.

### Batch 5: Night flight, a dark theme

**What changed.** With the device set to dark, the page and its cards go a deep navy and ink turns light. The band, its amber and the accent stay as they are, so it's still the Departures board.

**What I learned.**

- **Tokens make a theme one block of CSS.** Tailwind's colors are CSS variables, so the dark theme only overrides five of them (canvas, surface, ink, muted, line) under `prefers-color-scheme: dark`. Clerk's forms follow too, since their appearance already used the same variables.
- **Names that assume a light page break.** The focus ring was the band's navy, which would vanish on a dark page; it's ink now, a near-identical navy in the light theme and light at night. Delete trip's solid ink button had white text, which at night would be white on light; it takes the card's color instead. Clerk's Continue keeps white explicitly, since it sits on the accent.
- **A check that reads one theme can't check two.** The contrast script collected every `--color-` value into one list, so dark overrides with the same names would have silently replaced the light ones. It now reads the light tokens and the dark overrides separately and runs every pair for each. All 24 required pairs pass in both; the lowest is white on the accent, 5.76:1 in both.
- **Screens in dark, the same way as in light.** The screenshot script's browser takes `colorScheme: "dark"`, so `after-dark/` repeats every screen from the same starting point.

## Assignment 4 feedback

My professor's feedback on Assignment 4, fixed on the `assignment-5` branch before the live board. Screenshots of each fix, at 390 px and 1440 px, are in `docs/feedback/`.

### Fix 1: the sign-in and sign-up pages

**What my professor said.** The form takes less than a third of the screen and is neither centered nor left-aligned, so its placement feels random.

**What changed.** Both pages now use one shared layout, `AuthLayout`, on the same grid as every page (the same width and side padding as the band above). On a wide screen it's two columns: a navy panel with the app's name, one line on what it does and a sample boarding pass, and Clerk's form centered in the other column. On a phone it's one column: the panel on top, without the sample pass, so the form stays near the top. Clerk's title said "Sign in to My Application", the name of the Clerk app this repo shares with Assignment 4; it's set to "Sign in to Pack Again" in our code instead, so Assignment 4 is untouched.

**What I learned.**

- **Placement has to come from a grid, not from the component.** Clerk's card has its own fixed width, so dropped into a page it sat wherever it landed. Giving it a column of its own and centering it there makes the position a decision.
- **A ticket's notches assume the page behind it.** The pass's half-circle notches were drawn in the page color, so on the navy panel they showed as light dots. They now take `--notch`, which the panel sets to navy.

### Fix 2: real airport codes

**What my professor said.** The 3-letter codes look like airport codes, but they were made up from trip names (and city names), so they didn't mean anything.

**What changed.** A trip's code is now the real code of its destination's nearest major airport, named beside it so it reads as an airport: "MAD · Madrid–Barajas", then the place on the line under it. Screen readers hear "Nearest airport: Madrid–Barajas (MAD)". The airports are a curated list of 136 in `src/lib/airports.ts` (the busiest, and each region's main hub, one per city), which the Live board will use too. The nearest is found by great-circle distance; with no destination, or nothing on the list within 150 km (Alice Springs, say), there's no code. The codes made from trip names are gone, and so is New trip's code preview, since a new trip has no destination yet.

**What I learned.**

- **A code that looks real has to be real.** Airport-style letters set up an expectation; letters from a trip's name broke it. A real code plus the airport's name keeps the Departures look and removes the guessing.
- **Removing a feature removes its edge cases.** Name codes needed a uniqueness pass across all of a person's trips, in storage order, so they didn't change when the list was re-sorted. Airport codes depend only on the trip's own destination, so `tripCodes()` and its clash rules went away.
- **Thresholds need a test case on both sides.** Toledo and Granada find MAD and AGP within 150 km; Alice Springs finds nothing, and its card shows only the place.

### Fix 3: say which days the weather is for

**What my professor said.** The weather suggestions don't say which days they're based on.

**What changed.** A trip with no dates now says so plainly under the forecast board: "Based on the next 7 days. Add your dates to forecast your trip." "Add your dates" opens the departure date form (the same one as Trip options › Departure date), with focus in its field, so the line leads somewhere. Trips with a departure date are unchanged until fix 4, which makes the board and the suggestions follow the trip's own days.

**What I learned.**

- **The board's caption wasn't enough.** "Next 7 days" was there all along, but as the board's caption, and nothing joined it to the suggestions below. A sentence where the suggestions start says what they're based on, and what to do to change it.
- **A hint should be a way forward.** Telling someone to add dates is more useful when the words themselves open the form.

## Assignment 5, step 1: the live source

> Call the live source twice for the area around Chicago O'Hare, about 3 minutes apart, show what changed, check its rate limits and terms, and recommend how often the worker should run and when an aircraft has "changed enough" to write it.

### OpenSky first, then adsb.fi

The plan was OpenSky. Two anonymous calls from my Mac (over a VPN; my own network couldn't reach it) worked, at 1 credit each for a 1°×1° box. The worker has to run on Supabase, though, and from a temporary Edge Function OpenSky timed out on every call. Its docs say it "may block AWS and other hyperscalers". From the same function, adsb.lol answered 429 on 2 of 3 calls, because Supabase's IP is shared with other projects. adsb.fi answered all 3, in about 140 ms. So the source is adsb.fi.

### Two calls to adsb.fi

`GET https://opendata.adsb.fi/api/v3/lat/41.974/lon/-87.907/dist/30`: aircraft within 30 NM of O'Hare, on 3 Nov 2026 at 07:51:25 and 07:54:25 UTC.

| Call | HTTP | Size | Time | Aircraft |
|---|---|---|---|---|
| 1 | 200 | 4,894 B | 0.21 s | 9 |
| 2 | 200 | 3,671 B | 0.24 s | 7 |

**The fields we'd use, with their units** (from readsb's JSON format, which adsb.fi follows):

| Field | Example | Meaning |
|---|---|---|
| `hex` | `781273` | the transponder's ICAO address: the aircraft's key |
| `flight` | `"YZR7451 "` | callsign, padded to 8 characters; missing for some aircraft on the ground |
| `r`, `t`, `desc` | `B-1340`, `B744`, "BOEING 747-400" | registration and type, from adsb.fi's database |
| `alt_baro` | `4100`, or `"ground"` | barometric altitude in **feet**, or the string `"ground"` on the ground |
| `alt_geom` | `4050` | GPS altitude in feet |
| `gs` | `247.5` | ground speed in **knots** |
| `track` | `148.04` | direction of travel, degrees from true north |
| `baro_rate` / `geom_rate` | `-832` | climb (+) or descent (−) in **feet per minute** |
| `lat`, `lon` | `42.0218`, `-88.3581` | position |
| `seen` / `seen_pos` | `0.0` / `0.266` | **seconds** since the last message / the last position |
| `dst` / `dir` | `20.288` / `278.3` | distance from the point asked about, in **nautical miles**, and its bearing in degrees |

**What changed in 180 s:**

- **Appeared (1):** CAL5235, a Boeing 777F on the ground 1.2 NM out, at 1.6 kt.
- **Left (3):** AMX689 at 14,200 ft and GTI9013 at 16,025 ft, both climbing out past 30 NM. And N891NN, a 737 taxiing at 0.9 NM: it can't have left the airport in 3 minutes, so ground coverage dropped it.
- **Stayed (6):**

| Aircraft | Altitude (ft) | Speed (kt) | Distance (NM) | |
|---|---|---|---|---|
| AFR6733 (777F) | 1,350 → 9,075 | 182 → 312 | 0.8 → 10.7 | took off, climbing |
| YZR7451 (747) | 4,100 → 3,275 | 248 → 216 | 20.3 → 9.1 | arriving, descending |
| GTX508 (Bonanza) | 2,600 → 4,900 | 78 → 95 | 3.4 → 7.4 | climbing |
| LBQ650 (PC-12) | 5,975 → 4,950 | 241 → 272 | 12.9 → 8.8 | descending |
| AAL2409 (A319) | ground → ground | 0 → 0 | 0.46 → 0.46 | parked, unchanged |
| N14539 (A321neo) | ground → ground | 0 → 0 | 0.09 → 0.09 | parked, unchanged (no callsign; position 38–45 s old) |

### Rate limits and terms

From adsb.fi's open data README (github.com/adsbfi/opendata):

- **Rate limit:** public endpoints allow 1 request per second. The point query reaches up to 250 NM.
- **No key, and no rate-limit headers:** the response says nothing about the limit. A 429 is the only signal.
- **Temporary IP block:** "Requests returning a 400, 401, 403, 404, or 429 status code count toward the limit." Supabase's IP is shared, so the worker must never retry in a loop.
- **Terms:** "adsb.fi open data is for personal, non-commercial use only", provided as-is. "You must cite adsb.fi and include a link to our home page."

### Recommendations

- **Run every minute.** There are no daily credits; what limits us is adsb.fi's 1 request per second and Supabase's 500,000 Edge Function calls a month. Once a minute is 44,640 calls a month, about 9% of that. In one minute an arriving airliner moves about 4 NM, so the board changes every run without falling behind. One call per airport that anyone follows, at least 1.1 s apart. Skip the call when nobody follows anything, and stop the run at the first 429.
- **Save:**
  - `hex` (the key) and the airport code
  - `flight` (trimmed), `r`, `t`
  - `alt_baro` as whole feet, plus `on_ground` (true when it's `"ground"`)
  - `gs`, `baro_rate` (or `geom_rate`), `track`, `dst`, `dir`, `lat`, `lon`
  - when it was seen (`now − seen_pos`)
  - a phase worked out from those: parked, taxiing, climbing, descending or cruising
- **Don't save** the signal-quality fields (`nic`, `nac_*`, `sil`, `rssi`, `messages`, and so on), `nav_*`, `squawk`, `desc`, `ownOp` or `year`.
- **"Changed enough" means what the board shows changed.** Write an aircraft only when one of these is different:
  - its phase or `on_ground`
  - its altitude rounded to 100 ft
  - its speed rounded to 10 kt
  - its distance rounded to 0.5 NM
  - its callsign

  Insert new aircraft. Delete one only after it has been missing for 2 runs in a row, so a ground coverage gap like N891NN's doesn't delete and re-add it. In this sample, the two parked aircraft would not be written at all. At a busy airport, much of the traffic on the ground would be skipped like that.
- **Realtime:** send one message per airport per run, and only when something changed there, not one per aircraft.

### What I learned

- **Test where the code will run.** OpenSky worked from my Mac over a VPN and never from Supabase. A source is only usable if the worker's own servers can reach it.
- **A shared IP shares its limits.** adsb.lol's 429s weren't caused by our traffic, and adsb.fi counts errors toward blocking the IP. Retrying in a loop could get Supabase's address blocked for everyone using it.
- **"Changed" should mean "looks different".** Comparing the values the board actually shows, rounded, avoids rewriting rows when a number only moved in its decimals.

## Assignment 5, step 2: the tools

> Confirm each tool works: the Supabase MCP in write mode, pg_cron and pg_net, the Clerk CLI, the Vercel preview for this branch, the Playwright MCP, and origin/HEAD.

Checked 3 Nov 2026, after pushing `assignment-5` at `07668e5`.

| Tool | What it's for | Works? |
|---|---|---|
| Supabase MCP, write mode | Apply migrations, deploy Edge Functions, set secrets, run SQL from the agent | **Yes,** once I turned off `read_only` and reconnected it. Its write tools are loaded: `apply_migration`, `execute_sql`, `deploy_edge_function`, `create_edge_function_secret`. It has no tool to delete a function or a secret, so those stay dashboard tasks. |
| pg_cron | Supabase Cron: runs the worker every minute | **Yes,** 1.6.4, in `pg_catalog`. It was available but not enabled; I approved the migration `20261103082930_enable_pg_cron_and_pg_net`, applied with the MCP. |
| pg_net | Lets the cron job call the worker's Edge Function over HTTP | **Yes,** 0.20.4, in `extensions`, from the same migration. |
| Clerk CLI (`clerk`, from npm) | Manage the Clerk app and test users from the terminal | **Yes,** v4.1.0 through `npx clerk`, once I allowed it in `.claude/settings.local.json`. It's logged in with my account, but not yet linked to this project's Clerk app (`clerk link`). |
| Vercel preview | A deploy of this branch to test before merging | **Yes.** Vercel built `07668e5` ("Deployment has completed") at `design-assignment5-git-assignment-5-alejandro-6aea.vercel.app`. Deployment Protection keeps it behind a Vercel login. |
| Playwright MCP | Drive a real browser: check pages and take screenshots | **Yes.** It opened adsb.fi, read its open data README and opened the preview. |
| Playwright (test runner) | The end-to-end isolation test | **Yes.** It passed after each of fixes 1 to 3. |
| `origin/HEAD` | The default branch git compares against | **Yes.** It points to `origin/main`. |
| GitHub CLI (`gh`) | Commit statuses and deployments | **Yes.** It's how the Vercel status above was read. |
| Supabase Edge Functions (dashboard) | Where the worker will run | **Yes.** The temporary `opensky-probe` was deployed from the dashboard, reached adsb.fi, and is deleted now. A leftover from the first attempt, `dynamic-service`, is still deployed. |

### What I learned

- **A config file isn't a working tool.** The Supabase MCP was configured from the start, but it was read-only and not connected to the agent, so it couldn't do anything until I reconnected it. Checking a tool means using it, not reading its settings.
- **Write access should be a choice.** Turning off `read_only` gives the agent the shared production database, which Assignment 4 still uses. That's for me to do, not for the agent to switch on itself.
