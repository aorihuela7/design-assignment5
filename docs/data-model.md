# Data model

Seven tables in Supabase: three for packing lists and four for the Live board ([docs/data-flow.md](data-flow.md)). The SQL is in [`supabase/migrations/`](../supabase/migrations/).

```mermaid
erDiagram
  clerk_user ||--o| profiles : "gets one, on first sign-in"
  clerk_user ||--o{ trips : owns
  clerk_user ||--o{ items : owns
  trips ||--o{ items : "holds (deleted with the trip)"
  clerk_user ||--o{ follows : "follows up to 3 airports"
  follows }o--o| airport_updates : "airport_code"
  airport_updates ||--o{ aircraft : "airport_code"

  clerk_user {
    text sub "Clerk user id, e.g. user_2abc. Lives in Clerk, not Supabase"
  }

  profiles {
    text user_id PK "= sub. Select and insert only"
    timestamptz starters_added_at "when the starter trips were made"
  }

  trips {
    uuid id PK
    text user_id "= sub"
    text name "1-40 chars, unique per person"
    text destination_name "optional, from Open-Meteo"
    text destination_country "optional"
    double latitude "optional, with the name"
    double longitude "optional, with the name"
    text timezone "optional"
    timestamptz last_packed_at "every item ticked"
    timestamptz prompt_dismissed_at "answered Packing for a new trip?"
    timestamptz ticks_cleared_at "ticks cleared for a new trip"
    date departs_on "optional, the day it leaves"
    timestamptz created_at "order the trips were made in"
    timestamptz updated_at "any change to the trip or its items"
  }

  items {
    uuid id PK
    text user_id "= sub"
    uuid trip_id FK "one of the same person's trips"
    text name "1-60 chars, unique per trip"
    text section "clothes, toiletries, tech, documents, other"
    boolean packed
    boolean is_new "added after a full pack"
    timestamptz created_at "order the items were added in"
  }

  follows {
    text user_id PK "= sub. Select, insert and delete only"
    text airport_code PK "3 capital letters, from the curated list"
    timestamptz created_at
  }

  airport_updates {
    text airport_code PK "written by the worker on every check"
    timestamptz checked_at "the last check"
    boolean ok "whether it worked"
    text error "why not: 429, timeout"
    int aircraft_count
    int changed "aircraft rows written or deleted; in Realtime"
  }

  aircraft {
    text airport_code PK
    text hex PK "the transponder's address"
    text callsign "optional"
    text type "e.g. B744"
    int altitude_ft "null on the ground"
    int speed_kt
    int vertical_rate_fpm
    numeric distance_nm "from the airport"
    real bearing_deg "direction from the airport"
    real track_deg "direction it's moving"
    text status "on_ground, climbing, descending, level"
    timestamptz seen_at
    smallint missed_runs "deleted at 2"
    timestamptz updated_at
  }

  worker_runs {
    bigint id PK
    timestamptz started_at "kept 24 hours"
    int duration_ms
    int airports
    int airports_failed
    int rows_changed
    boolean ok
    text error "short, never a secret"
  }
```

## How each row belongs to one person

1. The browser sends Supabase the person's Clerk session token with every request.
2. Supabase checks the token against Clerk, and `auth.jwt()->>'sub'` is that person's Clerk user id.
3. **Writing:** a new row's `user_id` defaults to that id, so the app never sends it.
4. **Reading and changing:** every table has row-level security. Its select, insert, update and delete policies only match rows where `user_id` is that id. An item can also only point at a trip with the same `user_id`.
5. **Signed out:** with no token, the request runs as `anon`, which has no access to any table.

The forecast is never saved: only where a trip is going, and optionally the day it leaves (`departs_on`, a calendar day from 2000 to 2099). The starter trips are made once per person, by `add_starter_trips()`. Because a profile can't be changed or deleted, deleting every trip doesn't bring them back.

## The Live board's tables

- **`follows` is personal,** like trips: `user_id` defaults to the Clerk id, and each person can select, insert and delete only their own. There's no update, because a follow has nothing to edit. A trigger refuses a fourth follow ("You can follow up to 3 airports"), with a lock so two at once can't both get in.
- **`aircraft`, `airport_updates` and `worker_runs` belong to nobody.** They hold live air traffic, not anyone's data, so they have no `user_id`. Any signed-in person can read them; `anon` gets nothing. Nobody can write them but the worker, which uses the secret key Supabase provides on its own servers.
- **Realtime** publishes only `airport_updates`, one row per airport. A signed-in person gets its changes because of its select grant and policy.
