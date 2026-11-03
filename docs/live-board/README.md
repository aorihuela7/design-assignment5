# Live board: screenshots

Every state of the Live board at 390 px and 1440 px, taken on 3 Nov 2026 with the Playwright MCP, signed in as test user A, against a local dev server and the live worker.

| File | State | How it was reached |
|---|---|---|
| `1-loading` | Loading | Supabase's answers held back 3 s in the browser |
| `1b-first-check` | An airport just followed, before its first check | Following MRU (1440) and SIN (390) |
| `2-no-airports` | No airports yet, with suggestions from the trips' destinations | Test user A following nothing |
| `3-fresh` | Fresh: "Updated 6 s ago", ticking | Following ORD and MRU |
| `4-empty` | Empty: "No aircraft seen within 30 NM right now" | MRU at 1:40 am local time |
| `5-stale` | Stale: "Live data is late" | `?live=stale`, development only |
| `6-down` | Down: "the last check failed" | `?live=down`, development only |
| `7-reconnecting` | Realtime connection lost, reconnecting | The browser taken offline |
| `8-limit` | Following 3, the most you can | Following ORD, MRU and SIN |

The preview addresses do nothing in production: `previewState()` in `src/lib/live.ts` returns null unless `NODE_ENV` is `development`.
