# Béatitudes Ados — "Live It" Town Rally App — Build Instructions for Claude Code

You are building a complete event system for a one-day youth town rally in Gharzouz, Lebanon:
8 teams of 5–6 kids move on foot between 11 challenge stations, following a **fixed pre-defined route**.
Each team carries one Android phone running the app. Organizers roam with phones; HQ watches a laptop dashboard.

Read this whole document first. Then build **milestone by milestone, in order**. Do not skip ahead.
After each milestone, run its **Acceptance check** and commit. If something here is ambiguous, prefer the
simplest robust option and leave a clearly-marked `// DECISION:` comment rather than inventing new scope.

---

## 0. Ground rules (read carefully)

1. **Offline-first is the prime directive.** The game loop must work with **no network**. The next clue comes
   from data already on the phone. The server is an *oversight + scoreboard* layer, never a gate on gameplay.
2. **The route is fixed and pre-computed.** Do not write any routing/assignment logic. Each team's ordered list
   of stations is given in `seed_data.json`. The app just walks that list.
3. **No media upload, ever.** Photos/videos are captured **in-app** and stored **locally on the phone only**,
   tagged by station. They are collected after the event over USB. Never send media to the server.
4. **Two different "hint" concepts — do not confuse them.** See Glossary. In code, call them `clue` and
   `helpHint`. Never reuse one name for the other.
5. **All event content lives in `seed_data.json`**, not hardcoded. Coordinates, routes, clues, codes, phone
   numbers, and timings may change before the event. Load them from config/seed.
6. **Keep it simple.** SQLite on both ends, one Node server, one React dashboard, one React Native app with a
   role flag. No Firebase, no cloud media, no microservices.
7. Write a short test for each milestone's core logic. Commit per milestone with a clear message.
8. Target **Android only**. Ignore iOS entirely.

### Glossary
- **Station** — a physical challenge location (11 total), each with coordinates and two QR codes.
- **Category** — stations are split into two geographic clusters: `cat1` (6 stations, NE) and `cat2`
  (5 stations, SW), separated by a long road. Half the teams start in cat1, half in cat2; each team does its
  whole starting category, crosses the road once, then does the other category.
- **Route** — a team's fixed ordered list of 11 station IDs (its 6+5 or 5+6 sequence). In `seed_data.json`.
- **clue** — the riddle that tells a team how to find a station. Stored per-station as `clue`. It is revealed to
  a team **when that station becomes their next target** (i.e. right after they finish the previous station).
  This is always shown for free; it is the normal way teams navigate.
- **helpHint** — a limited pool of "I'm stuck, give me help" credits per team (default 3). Spent only when a
  team radios HQ and an organizer chooses to grant help. Deducted **server-side** by an organizer. Unrelated to
  `clue`. When a team has 0 left, no more help is given.
- **scan start / scan end** — each station has a START QR and an END QR. Scanning START begins the per-station
  timer and unlocks the challenge; scanning END completes it and reveals the next clue.
- **roles** — `team` (the kid-facing phone), `organizer` (roaming staff, full visibility, same app), `admin`
  (HQ laptop dashboard).

---

## 1. Architecture overview

```
┌──────────────────────┐         HTTPS /sync (durable events, offline-queued)
│  TEAM APP (Android)   │ ───────────────────────────────────────────────┐
│  React Native + Expo  │         WebSocket (live location + live pushes) │
│  local SQLite         │ ─────────────────────────────────┐             │
└──────────────────────┘                                   │             │
┌──────────────────────┐                                   ▼             ▼
│ ORGANIZER APP (same   │ ─────────────────────────►  ┌───────────────────────────┐
│ build, role=organizer)│        WebSocket            │   NODE BACKEND            │
└──────────────────────┘                             │   Express + Socket.IO     │
┌──────────────────────┐        HTTPS + WebSocket     │   better-sqlite3 (1 file) │
│ DASHBOARD (laptop web)│ ◄──────────────────────────►│   source of truth: score, │
│ React + Vite + Leaflet│                             │   hints, alerts, logs     │
└──────────────────────┘                             └───────────────────────────┘
```

- **Durable game events** (scan_start, scan_end, station_result, exit, help_request, sos) are written to the
  phone's SQLite first, then POSTed in batches to `/sync`. They are **idempotent** (deduped by UUID), so retries
  are safe. This is how we replace Firebase's automatic offline sync.
- **Ephemeral live data** (GPS location, "team just finished X" notifications, broadcasts, hint/score updates)
  flows over **Socket.IO** when connected. If the socket is down, `/sync` still carries the durable log and
  returns authoritative state on the next successful call.

### Repo layout (monorepo, npm workspaces)
```
rally/
  package.json            # workspaces: ["server","dashboard","app","shared"]
  seed_data.json          # provided — the single source of event content
  shared/                 # TS types + constants shared by all three
    src/types.ts
    src/events.ts         # event type enums, socket event names
    src/qr.ts             # QR payload parse/build: "RALLY:<stationId>:<START|END>"
  server/                 # Node backend
  dashboard/              # React + Vite web app for HQ laptop
  app/                    # React Native (Expo) Android app (team + organizer roles)
  tools/                  # scripts: generate QR PNGs, pre-download map tiles, seed db
```

### Tech + key libraries (use current stable versions)
- **Server:** `express`, `socket.io`, `better-sqlite3`, `zod` (validate payloads), `uuid`, `cors`,
  `jsonwebtoken` (simple bearer tokens), `csv-stringify` (export).
- **Dashboard:** `react`, `vite`, `typescript`, `leaflet` + `react-leaflet`, `socket.io-client`.
- **App:** `expo` (with **dev client / prebuild** — NOT Expo Go, because of native modules),
  `react-native-vision-camera` (QR scan + photo/video capture), `op-sqlite` (fast local DB),
  `react-native-webview` (host the Leaflet map), `socket.io-client`, `expo-location` +
  `expo-task-manager` (background GPS), `expo-keep-awake`, `expo-file-system` (local media paths),
  `@react-native-async-storage/async-storage` (tiny settings only if needed), `react-navigation`.
- **Shared:** plain TS compiled or referenced directly via workspaces.

> Note on the app build: `react-native-vision-camera` and `op-sqlite` require a custom native runtime.
> Use `npx expo prebuild` then run on a **physical Android device** (`npx expo run:android`) for development,
> and produce a distributable **APK** via `eas build -p android --profile preview` (or local Gradle) for the
> event. The phones are participants' own devices — sideload the APK (enable "install unknown apps"); no Play
> Store, no factory reset, no kiosk/Device Owner.

---

## 2. The data model

### 2.1 `seed_data.json` (provided — do not regenerate, load as-is)
Top-level keys: `event`, `stations[]`, `teams[]`.
- `event`: `name, town, eventStartIso, durationMinutes, hqPhone, emergencyPhone, helpHintsPerTeam,
  serverUrl, qrPayloadFormat`.
- `stations[]`: `{ id, name, category("cat1"|"cat2"), lat, lng, clue, startCode, endCode, basePoints }`.
- `teams[]`: `{ id, name, color(hex), code(login code), startCategory, phone, route:[stationId × 11] }`.

The `route` is already the full ordered journey (its starting category in order, then the other category in
order). The crossing happens between index `len(startCategory stations)-1` and the next index.

### 2.2 Server DB (`better-sqlite3`, file `server/data/rally.db`)
```sql
teams        (id TEXT PK, name, color, phone, code, route_json TEXT,
              hints_remaining INT, score INT DEFAULT 0, status TEXT DEFAULT 'idle', last_seen INT)
stations     (id TEXT PK, name, category, lat REAL, lng REAL, clue TEXT,
              start_code TEXT, end_code TEXT, base_points INT)
events       (uuid TEXT PK, team_id, type TEXT, station_id TEXT, payload_json TEXT,
              client_ts INT, server_ts INT)         -- idempotent durable log (dedupe by uuid)
progress     (team_id, station_id, started_at INT, ended_at INT, duration_sec INT,
              result TEXT, points INT, PRIMARY KEY(team_id, station_id))
locations    (device_id TEXT, role TEXT, team_id TEXT, lat REAL, lng REAL, battery INT, at INT)
hints_log    (id INTEGER PK AUTOINCREMENT, team_id, at INT, by_organizer TEXT, note TEXT)
alerts       (id INTEGER PK AUTOINCREMENT, team_id, type TEXT, lat REAL, lng REAL,
              at INT, resolved INT DEFAULT 0)
broadcasts   (id INTEGER PK AUTOINCREMENT, target TEXT, message TEXT, at INT)  -- target = teamId or 'all'
clue_override(team_id TEXT PK, text TEXT, at INT)
```
Server is authoritative for `score` and `hints_remaining`. Everything else is a log it accepts from devices.

### 2.3 Phone DB (`op-sqlite`, one file per app install)
```sql
settings   (key TEXT PK, value TEXT)   -- team_id, team_name, color, token, server_url,
                                       -- event_start_iso, duration_min, hq_phone, emergency_phone,
                                       -- hints_remaining (cached), role
route      (idx INT PK, station_id, station_name, category, lat REAL, lng REAL,
            clue TEXT, start_code TEXT, end_code TEXT)   -- THIS team's ordered route
stations   (id TEXT PK, name, category, lat REAL, lng REAL)   -- all stations, for the map
scans      (uuid TEXT PK, station_id, kind TEXT, client_ts INT, synced INT DEFAULT 0)
progress   (station_id TEXT PK, started_at INT, ended_at INT, duration_sec INT, result TEXT, synced INT DEFAULT 0)
exits      (uuid TEXT PK, left_at INT, returned_at INT, away_sec INT, synced INT DEFAULT 0)
help_reqs  (uuid TEXT PK, at INT, synced INT DEFAULT 0)
alerts     (uuid TEXT PK, type TEXT, lat REAL, lng REAL, at INT, synced INT DEFAULT 0)
captures   (id TEXT PK, station_id, type TEXT, local_path TEXT, created_at INT)  -- NEVER synced
outbox     (uuid TEXT PK, type TEXT, payload_json TEXT, client_ts INT, tries INT DEFAULT 0)
```
`outbox` is the single queue the sync worker drains. Every durable action inserts into its own table AND the
outbox in one transaction; the worker POSTs `/sync` and on success marks rows `synced=1` / removes from outbox.

---

## 3. Shared contracts (`shared/`) — build these first, both ends import them

### 3.1 QR payload (`shared/src/qr.ts`)
- Format: `RALLY:<stationId>:<START|END>` (e.g. `RALLY:puzzle:START`).
- `buildCode(stationId, kind)` and `parseCode(text) -> { stationId, kind } | null`. Reject anything malformed.

### 3.2 Durable event types (`shared/src/events.ts`)
`scan_start | scan_end | station_result | exit | help_request | sos | location`
(`location` is sent live over socket, but also accepted by `/sync` as a fallback heartbeat.)

### 3.3 Socket event names
- client→server: `hello` (auth handshake), `location` (`{lat,lng,battery}`).
- server→team: `state_update` (`{score, hintsRemaining}`), `broadcast` (`{message}`),
  `clue_override` (`{text}`), `help_granted` (`{hintsRemaining}`), `sos_ack`.
- server→organizers/admin: `team_progress` (`{teamId, stationId, result, at}`),
  `team_location` (`{teamId, lat, lng, battery, at}`), `alert` (`{...}`), `exit_logged` (`{teamId, awaySec, at}`).

### 3.4 REST API
```
POST /auth/team        { code }      -> { token, team, route[], stations[], event }
POST /auth/organizer   { code }      -> { token, role }            // role: 'organizer' | 'admin'
GET  /state            (auth team)   -> { score, hintsRemaining, clueOverride?, broadcasts[] }
POST /sync             (auth) { events:[{uuid,type,stationId?,payload,clientTs}] }
                                     -> { accepted:[uuid], state:{score,hintsRemaining,clueOverride?,broadcasts[]}, serverTime }
-- admin/organizer --
GET  /admin/teams                    -> [{ team, progress[], score, hintsRemaining, exits, lastSeen, lastStation }]
POST /admin/score      { teamId, stationId, points }
POST /admin/hint       { teamId, delta }          // delta usually -1; enforce >=0; writes hints_log
POST /admin/broadcast  { target, message }        // target = teamId | 'all'
POST /admin/clue       { teamId, text }            // manual next-clue override (unstick a team)
GET  /admin/alerts                   -> [ open alerts ]
POST /admin/alerts/:id/resolve
GET  /admin/export                   -> CSV (teams, scores, per-station times, exits)
```
Auth = `Authorization: Bearer <token>`. Validate every body with `zod`. Enforce role on `/admin/*`.

---

## 4. MILESTONES

### M0 — Repo & tooling
- Init monorepo with npm workspaces; TypeScript everywhere; shared eslint/prettier.
- Create `shared/` with the three files above + types from §2.1. Add a `tools/seed.ts` that reads
  `seed_data.json` and inserts into the server DB (idempotent: upsert).
- **Acceptance:** `npm install` at root works; `shared` builds; `parseCode("RALLY:puzzle:START")` returns
  `{stationId:'puzzle',kind:'START'}` in a unit test.

### M1 — Backend skeleton + DB + seed + auth
- Express app, `better-sqlite3`, create tables (§2.2), run `tools/seed.ts` to load stations + teams (set each
  team's `hints_remaining = event.helpHintsPerTeam`, `route_json` from seed).
- Implement `/auth/team` (match `code` → issue JWT, return team + its route expanded with station details +
  all stations + event config) and `/auth/organizer` (codes for organizer/admin from an env var or seed).
- Implement `/sync` (validate, dedupe by uuid into `events`, apply side-effects per type — see §5 — and return
  authoritative state) and `/state`.
- **Acceptance:** seeding loads 11 stations + 8 teams; `POST /auth/team {code:"REDA-2026"}` returns red A's
  ordered route of 11 stations with coordinates and clues; replaying the same `/sync` batch twice changes the DB
  only once (idempotency test).

### M2 — Team app: the offline core loop (most important milestone)
Build the app shell (Expo prebuild, react-navigation) with a **role** setting. Implement local SQLite (op-sqlite,
§2.3). On first login, call `/auth/team`, then **persist route + stations + settings locally** so the app can
cold-start with no network thereafter.

Implement the loop entirely from local data:
1. **Login screen** — enter team code (or scan a provisioning QR). Stores token + route locally.
2. **Current clue screen** — shows the clue for the current target station (`route[currentIndex].clue`),
   the **overall countdown** (from `event_start_iso + duration`), and the team's score + helpHints remaining
   (from cache). At game start, `currentIndex = 0` and it shows the first station's clue.
3. **Scan screen** (vision-camera): scan a QR.
   - If START code: it MUST equal `route[currentIndex].start_code`. If not, show "This isn't your next
     station" and refuse. If yes: write `scan_start` (scans + progress.started_at + outbox), start the
     **per-station timer**, go to Challenge screen.
   - If END code: it MUST equal the station you started (the current target's `end_code`). If yes: write
     `scan_end` + `station_result` (progress.ended_at, duration), set `currentIndex++`, then show the **next
     clue** (`route[currentIndex].clue`). If `currentIndex` passed the last station, show the "return to HQ /
     final treasure" screen.
4. **Challenge screen** — static instructions for that station type (text from a local map of station_id →
   instructions; reuse the wording from the printed station cards) + the running per-station timer + a
   **Capture** button (M7) + "Scan to finish" button.
- Crossing note: when the next station's `category` differs from the one just finished, show a one-time
  "Long walk to the other area — stay together" note above the clue.
- **Acceptance (airplane mode!):** with the device in airplane mode after first login, a tester can complete the
  full 11-station loop: each correct START unlocks, wrong START is refused, each END reveals the correct next
  clue per red A's route, timers record sane durations, and the end screen appears after station 11. Nothing
  crashes offline; all rows are in local SQLite with `synced=0`.

### M3 — Sync worker + server apply + pull state
- Background worker in the app: every ~15s **and** on reconnect, if outbox non-empty, POST `/sync` with all
  queued events; on success mark them synced and merge returned `state` (update cached score/hints, store any
  `clueOverride`/`broadcasts`). Use exponential backoff on failure. Never block UI.
- Server `/sync` applies side-effects (§5) and updates `last_seen`.
- **Acceptance:** play several stations offline, then re-enable network: within ~15s all events appear in the
  server `events`/`progress` tables exactly once, and `/admin/teams` shows that team's progress and last station.

### M4 — Socket.IO live layer + dashboard scoreboard
- Server: Socket.IO with rooms `team:<id>` and `organizers`. On `hello`, authenticate by token, join the right
  room. Broadcast `team_progress` to organizers when a `scan_end` is applied. Emit `state_update` to a team when
  its score/hints change.
- Dashboard (Vite + React): organizer/admin login, then a **live scoreboard** (teams sorted by score, with last
  station + time) and a **team list** that updates in real time via socket; falls back to polling `/admin/teams`
  if socket drops.
- **Acceptance:** finishing a station on the phone (online) makes the dashboard scoreboard update within ~2s
  without refresh.

### M5 — Leaflet map + passed-station trails (dashboard, then in-app)
- **Map module (shared HTML/JS)** in `tools/` or `dashboard/`: a Leaflet map centered on Gharzouz showing all 11
  station markers colored by category. Functions to (a) draw a team's **passed stations** filled-in and
  (b) draw a **polyline through them in visit order** (the "steps he passed"), and (c) place live pins for
  teams, the emergency vehicle, and organizers.
- **Dashboard map:** show every team's live pin (color = team color), the emergency pin, organizer pins. Clicking
  a team highlights its trail + current target. Live positions arrive via `team_location` socket events; each
  device emits `location` every ~10–15s (throttled; pause when backgrounded to save battery).
- **In-app map (team):** host the same Leaflet via `react-native-webview`. The team sees **its own** passed
  stations + trail + its live GPS dot. **Do NOT pin the next/unvisited station** (its location is a riddle —
  pinning spoils it). The **organizer role** in the app sees the full map like the dashboard.
- Battery/GPS: `expo-location` foreground + `expo-task-manager` for throttled background updates.
- **Acceptance:** two phones online show two moving pins on the dashboard; each team's app shows only its own
  visited stations connected by a line, growing as it completes stations; no unvisited station is pinned in the
  team view.

### M6 — Help hints, Contact (walkie-talkie) buttons, SOS, and exit tracking
- **Help hints:** team taps "I'm stuck" → writes a `help_request` (synced) and tells them to radio HQ. An
  organizer, on the dashboard, taps **Give hint** for that team → `POST /admin/hint {delta:-1}` (server enforces
  ≥0, logs it, emits `help_granted` with new count). The phone shows the updated remaining count. The actual
  help is spoken over the phone call — the app only tracks the credit. At 0, the button still sends the request
  but the dashboard shows "no hints left".
- **Contact screen — two big buttons, no chat:**
  - **Call HQ** and **Call Emergency** → place a real cellular call via Android `ACTION_CALL` (request
    `CALL_PHONE` permission) to `hq_phone` / `emergency_phone` from settings. This works on patchy data because
    it uses the voice network.
  - **Emergency** also writes an `sos` event with the team's last known `lat,lng` → server inserts an `alert`
    and emits `alert` to organizers; dashboard shows it immediately with location. Server replies `sos_ack`.
- **Exit tracking (anti-cheat signal):** subscribe to React Native `AppState`. When it leaves `active`
  (background/inactive), record `leftAt`; when it returns to `active`, write an `exit` row
  (`left_at, returned_at, away_sec`) and sync it. **Suppress** the exit that happens because of the app's own
  call buttons: set an `expectingCall` flag right before dialing and ignore the next background transition.
  Ignore ultra-short (<2s) transitions. **No automatic penalty** — surface counts + total away-time on the
  dashboard per team and let organizers judge. (Optional: a configurable threshold that flags a team in red.)
- **Acceptance:** granting a hint on the dashboard decrements the phone's counter live and can't go below 0;
  Call HQ dials without logging a false "exit"; leaving the app to the home screen for 10s logs an exit that
  appears on the dashboard; SOS drops a located alert on the dashboard within ~2s.

### M7 — Local media capture (no upload)
- **Capture** on the Challenge screen uses vision-camera to take photos and short videos, saved to app storage
  via `expo-file-system`, indexed in the `captures` table tagged with `station_id` + timestamp. A small gallery
  lets the team review/retake. **Nothing is uploaded or referenced to the server.**
- Provide an **end-of-day export**: a screen (or `adb pull` instructions in the README) to copy all media off the
  phone. Recommended folder layout on device: `RallyMedia/<teamId>/<stationId>/<timestamp>.<ext>`.
- **Acceptance:** a photo and a video can be captured offline, appear in the in-app gallery tagged by station,
  survive an app restart, and can be pulled off the device; verify no network call carries media.

### M8 — Admin tools: scoring, broadcast, clue override, alerts, export
- Dashboard **Team detail**: per-station times, exits, current target; buttons to set/adjust a station's
  `points` (`/admin/score`), push a **broadcast** message (`/admin/broadcast`, target one team or all → phone
  shows it as a banner/notification), and a **manual clue override** (`/admin/clue` → phone shows it, to
  unstick a lost team). **Alerts queue** with resolve. **Export** results to CSV.
- Scoring model: challenges are judged by humans. Default each completed station to `basePoints` on `scan_end`,
  but let organizers overwrite per team per station from the dashboard. Keep `score` server-authoritative; never
  let the team device write score.
- **Acceptance:** an organizer can change a team's station points and see the scoreboard reorder; a broadcast
  appears on the targeted phone; a clue override appears on the phone; CSV export contains every team's score and
  per-station durations.

### M9 — Offline map tiles, hardening, field + load test
- **Offline tiles** (signal is patchy): default approach — pre-download OpenStreetMap raster tiles for the
  Gharzouz bounding box at zoom 16–19 with a script in `tools/` (e.g. iterate the tile x/y range and fetch),
  bundle them with the app (or serve from the backend), and point Leaflet's `tileLayer` at the local tiles with
  online OSM as fallback. (Alternative, on-brand: overlay a single georeferenced town-map image via
  `L.imageOverlay` with known corner coordinates — include this as a config switch.)
- Hardening: retry/backoff on sync; guard against duplicate scans; clock-skew note (use server time for scoring,
  device time only as fallback); keep-awake during active play; graceful "server unreachable" UI that never
  blocks the loop.
- **Field test:** walk the real route with 2–3 phones; record dead zones; confirm sync catches up after each.
- **Load test:** simulate all 8 teams emitting locations + finishing stations at once; confirm dashboard keeps
  up and the server DB stays consistent.
- **Acceptance:** with Wi-Fi/data off, the map still renders Gharzouz and pins; after a simulated dead-zone the
  queued events all arrive once; 8 concurrent teams don't break the dashboard.

---

## 5. `/sync` side-effects (server) — exact behavior per event type
Process events in `client_ts` order, each wrapped so a duplicate `uuid` is a no-op:
- `scan_start` → upsert `progress(team,station).started_at`; set team `status='in_station'`, `last_seen=now`.
- `scan_end` → set `progress.ended_at`, `duration_sec`; if `points` null set `points = station.base_points`;
  recompute team `score = sum(progress.points)`; set `status='moving'`; emit `team_progress` + `state_update`.
- `station_result` → merge result/notes if present.
- `exit` → store in `events`; emit `exit_logged` to organizers (for the dashboard counter). No score change.
- `help_request` → store; emit to organizers so they know who's asking. (Deduction happens via `/admin/hint`.)
- `sos` → insert `alerts`; emit `alert`; reply `sos_ack`.
- `location` (fallback path) → upsert `locations`.
Always return current `{score, hintsRemaining, clueOverride?, broadcasts[]}` so the phone reconciles.

---

## 6. Configuration & deployment
- **`seed_data.json`** is the control panel: set real `eventStartIso`, `durationMinutes`, `hqPhone`,
  `emergencyPhone`, `helpHintsPerTeam`, `serverUrl`, and the team `code`s before the event. Re-run the seed.
- **Server hosting:** because team phones use their own mobile data across town, the backend must be reachable on
  the public internet. Deploy `server/` to a small VPS (Node LTS) with a domain + HTTPS (a reverse proxy like
  Caddy/Nginx for TLS + WebSocket upgrade). For local dev, run on the laptop and point the app at the LAN IP or a
  tunnel. (Plain cPanel shared hosting is not recommended for the Socket.IO server.)
- **App distribution:** build a signed APK (`eas build -p android --profile preview`), share the file, enable
  "install unknown apps", install on each team phone, log in with that team's code once **while online** so the
  route caches locally. After that it runs offline.
- **QR codes:** add `tools/gen-qr.ts` to render two PNGs per station (`<stationId>-START.png`,
  `<stationId>-END.png`) from the `startCode`/`endCode` strings, for printing onto the station signs from the
  print pack. Encode the exact `RALLY:<id>:<KIND>` text.
- **Env:** `server/.env` → `PORT`, `JWT_SECRET`, `ORGANIZER_CODE`, `ADMIN_CODE`, `DB_PATH`.

## 7. Build order recap (do in this sequence)
M0 shared → M1 backend+auth+sync → **M2 offline team loop (bulletproof this)** → M3 sync worker →
M4 sockets+scoreboard → M5 Leaflet map+trails → M6 hints+contact+SOS+exit-tracking → M7 local capture →
M8 admin tools → M9 offline tiles + field/load test.

## 8. Definition of done
- A team phone, **offline**, runs the entire 11-station journey from its fixed route, validating scans and
  revealing each next clue locally, recording per-station times, and logging app-exits and captured media
  locally.
- When it regains signal, every durable event syncs exactly once; the HQ dashboard shows live scores, a live map
  with each team's pin and its trail of passed stations, alerts, and exit counts, and can adjust scores, deduct
  help hints, broadcast, override a clue, and export results.
- No media ever leaves the phone over the network. No kiosk lock, no device formatting. Android only.
