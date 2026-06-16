# Béatitudes Ados — "Live It" Rally

A monorepo for a one-day town rally event: 8 teams move on foot between 11 challenge stations
following a fixed pre-defined route. Each team carries one Android phone running the app.
Organizers roam with phones; HQ watches a live web dashboard.

For the original feature spec / design rationale, see [`BUILD_INSTRUCTIONS.md`](BUILD_INSTRUCTIONS.md).
For non-technical usage instructions (team codes, how to use the app on event day), see
[`Guide.md`](Guide.md).

---

## 1. Architecture

```
┌──────────────────────┐         HTTPS /sync (durable events, offline-queued)
│  TEAM APP (Android)   │ ───────────────────────────────────────────────┐
│  React Native + Expo  │         WebSocket (live location + live pushes) │
│  local SQLite         │ ─────────────────────────────────┐             │
└──────────────────────┘                                   │             │
┌──────────────────────┐                                   ▼             ▼
│ ORGANIZER (dashboard) │ ◄─────────────────────────►  ┌───────────────────────────┐
│ React + Vite + Leaflet│        HTTPS + WebSocket      │   NODE BACKEND            │
└──────────────────────┘                               │   Express + Socket.IO     │
                                                         │   better-sqlite3 (1 file) │
                                                         └───────────────────────────┘
```

- **Offline-first**: the team app's game loop (clues → scan START → challenge → scan END →
  next clue) runs entirely from data cached on the phone after the first login. The server is
  an oversight/scoreboard layer, never a gate on gameplay.
- **Durable events** (`scan_start`, `scan_end`, `station_result`, `exit`, `help_request`, `sos`)
  are written to local SQLite (`outbox` table), then POSTed in batches to `/sync`. They're
  idempotent (deduped by UUID), so retries are safe.
- **Ephemeral live data** (GPS location, live progress pushes, broadcasts, hint/score updates)
  flows over Socket.IO when connected.
- **No media upload, ever.** Photos/videos are captured in-app and stored locally only, tagged
  by station. Collected after the event over USB/adb — see [`app/README.md`](app/README.md).

## 2. Repo layout (npm workspaces)

```
rally/
  package.json            # workspaces: shared, server, dashboard, app, tools
  seed_data.json           # single source of truth for event content (stations, teams, codes, timings)
  shared/                  # TS types + constants shared by all three (@rally/shared)
    src/types.ts, events.ts, qr.ts, schema.ts, map/
  server/                  # Node/Express + Socket.IO backend, better-sqlite3
  dashboard/               # React + Vite web app for HQ (organizer/admin)
  app/                     # React Native (Expo) Android app (team role)
  tools/                   # seed.ts, download-tiles.ts, loadtest.ts
```

## 3. Tech stack

- **Server**: Express, Socket.IO, better-sqlite3, zod, jsonwebtoken, uuid, cors, run via `tsx`
- **Dashboard**: React + Vite + TypeScript, Leaflet/react-leaflet, socket.io-client
- **App**: Expo SDK ~56 (prebuild, not Expo Go — has native modules), React Native 0.85,
  React 19, `@op-engineering/op-sqlite` (local DB), `expo-camera` (QR scan + capture),
  `react-native-webview` (Leaflet map), `expo-location` + `expo-task-manager` (background GPS),
  socket.io-client, react-navigation
- **Build**: TypeScript everywhere, npm workspaces, eslint + prettier, vitest

## 4. Prerequisites

- Node.js 22.x (repo developed/tested with v22.13.1) and npm
- For Android builds: Android SDK (platforms 34–36), Android NDK, JDK 21 (Temurin), and the
  Gradle wrapper bundled in `app/android` after prebuild — see §7

## 5. Local development

```sh
npm install            # installs all workspaces

# Backend (http://localhost:4000)
npm run dev -w server

# Dashboard (Vite dev server, proxies to backend)
npm run dev -w dashboard

# Mobile app (Expo dev server — requires a prebuilt dev client, see §7)
npm run start -w app
```

### Seeding the database

```sh
npm run seed -w tools
```

Reads `seed_data.json` and upserts stations + teams into `server/data/rally.db`
(`teams.hints_remaining` is initialized from `event.helpHintsPerTeam`). Safe to re-run —
it's an upsert.

### Tests & linting

```sh
npm test               # vitest across all workspaces
npm run lint           # eslint across the whole repo
npm run format         # prettier --write .
```

## 6. `seed_data.json` — the control panel

Top-level keys: `event`, `stations[]`, `teams[]`.

- `event`: `name, town, eventStartIso, durationMinutes, hqPhone, emergencyPhone,
  helpHintsPerTeam, serverUrl, qrPayloadFormat`
- `stations[]`: `{ id, name, category("cat1"|"cat2"), lat, lng, clue, startCode, endCode, basePoints }`
- `teams[]`: `{ id, name, color(hex), code(login code), startCategory, phone, route: [stationId × 11] }`

To change event timing, phone numbers, hint counts, clues, or team codes: edit this file, then
re-run `npm run seed -w tools` against the server's DB (or re-seed as part of deployment).

QR codes encode `RALLY:<stationId>:<START|END>` (parsed/built in `shared/src/qr.ts`).

## 7. Environment variables (server)

Copy `server/.env.example` to `server/.env` and adjust:

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `JWT_SECRET` | `dev-secret-change-me` | **Change before deploying** — signs auth tokens |
| `ORGANIZER_CODE` | `ORGANIZER-2026` | Dashboard login code (organizer role) |
| `ADMIN_CODE` | `ADMIN-2026` | Dashboard login code (admin role) |
| `DB_PATH` | `./data/rally.db` | SQLite file location |
| `TILES_PATH` | `./tiles` | Pre-downloaded offline map tiles (see `tools/download-tiles.ts`) |
| `DASHBOARD_DIST_PATH` | `../dashboard/dist` | Built dashboard static files, served by the same Express app |

## 8. Building the Android APK locally

The app uses native modules (`op-sqlite`, `expo-camera`, background location), so it **cannot**
run in Expo Go — it needs a native prebuild. EAS Build (`eas build -p android --profile preview`)
is the easiest path if you have an Expo account, but a fully local build is also possible and is
documented here since it's been done successfully on Windows.

### 8.1 One-time environment setup

You need:
- **JDK 21** (Temurin) on PATH
- **Android SDK** with platforms 34–36 and build-tools installed (e.g. via Android Studio's SDK
  Manager), at a known path like `C:\Users\<you>\AppData\Local\Android\Sdk`
- The NDK is **not** required up front — Gradle/AGP will auto-download the exact version
  `op-sqlite` needs (`27.0.12077973`, ~1.3GB zip → ~2.3GB extracted) on first build, with no
  `cmdline-tools`/`sdkmanager` step needed.

### 8.2 Generate the native project

```sh
cd app
npx expo prebuild --platform android
```

This generates `app/android/` (gitignored — regenerate any time from `app.json` + plugins).

### 8.3 Two fixes required before building

1. **Pin the Gradle wrapper to 8.13.** The prebuild template defaults to a newer Gradle
   (9.x), but this repo's AGP version is pinned to **8.12.0** by
   `@react-native/gradle-plugin/gradle/libs.versions.toml`. Gradle 9.x removed
   `JvmVendorSpec.IBM_SEMERU`, which AGP 8.12 still references, causing a hard failure
   (`Class org.gradle.jvm.toolchain.JvmVendorSpec does not have member field 'IBM_SEMERU'`).

   Edit `app/android/gradle/wrapper/gradle-wrapper.properties`:
   ```
   distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
   ```

2. **Point the Gradle daemon at the Android SDK** if `ANDROID_HOME`/`local.properties` isn't
   already set up for this checkout. Create `app/android/local.properties`:
   ```
   sdk.dir=C:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
   ```
   (A `local.properties` set by `expo prebuild` is gitignored and machine-specific —
   recreate it after every prebuild if needed. A Gradle daemon launched from a different shell
   than the one where `ANDROID_HOME` was set via `setx`/`[Environment]::SetEnvironmentVariable`
   won't see that env var — `local.properties` is the reliable fix.)

### 8.4 Build the release APK

```sh
cd app/android
./gradlew.bat assembleRelease
```

Output: `app/android/app/build/outputs/apk/release/app-release.apk` (~100MB).

Notes:
- Release builds use Expo's auto-generated default debug-style signing config — no manual
  keystore setup needed for sideloading to test devices.
- **First build is slow** (30–40+ minutes): it downloads the NDK, then compiles native code
  (CMake/ninja/clang) for all 4 ABIs (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) for
  `op-sqlite`, `expo-modules-core`, `react-native-screens`, and the `:app` module itself.
  Subsequent builds reuse the Gradle daemon cache and NDK/CMake artifacts and take only a
  few minutes.
- If a build fails partway through with a Maven/`dl.google.com` TLS or network error (e.g.
  "Remote host terminated the handshake" while downloading a small `androidx` jar), this is
  transient — just re-run `./gradlew.bat assembleRelease`. Already-compiled native artifacts
  are cached, so retries are fast.
- If a build appears to hang for many minutes with near-zero CPU after the NDK download (stalled
  network connection), kill the gradle daemon process and retry — cached NDK makes the retry
  much faster.

### 8.5 Distributing the APK

Copy `app-release.apk` to each phone (USB, Drive, WhatsApp, etc.) and install with "allow
unknown apps". Each team logs in once with their team code while online (see `Guide.md` for
codes) — this caches their route locally so the rest of the event works offline.

To install directly over USB instead:
```sh
adb install app/android/app/build/outputs/apk/release/app-release.apk
```

## 9. Production deployment (cPanel, single subdomain)

Currently deployed at `https://r.vibrandstudio.com`. Setup notes for this hosting model:

- **Build the dashboard** and let the Express server serve it as static files from the same
  origin/subdomain:
  ```sh
  npm run build -w dashboard
  ```
  The server serves `dashboard/dist` via `config.dashboardDistPath` (defaults to
  `../dashboard/dist` relative to `server`'s cwd) — see `server/src/app.ts`.

- **Entrypoint for cPanel's Node Selector / Passenger**: `server/start.mjs`. Many cPanel hosts
  run `node <startup file>` directly via `require()`, which can't handle a top-level-await ESM
  graph and can't easily set `NODE_OPTIONS=--import tsx`. `start.mjs` registers `tsx`'s ESM
  loader programmatically and then dynamically imports `./src/index.ts`, avoiding both issues.
  Set the app's startup file to `server/start.mjs` in cPanel's Node app config.

- `tsx` is a **runtime** dependency of `server` (not just a dev dependency), since the
  production host runs the TypeScript source directly rather than a `tsc` build output.

- **Env vars to set in cPanel's Node app config**: `PORT` (cPanel usually assigns this),
  `JWT_SECRET` (change from the default!), `ORGANIZER_CODE`, `ADMIN_CODE`, `DB_PATH`.

- `app/src/config.ts` (`DEFAULT_SERVER_URL`) and `seed_data.json`'s `event.serverUrl` must both
  point at the deployed URL (`https://r.vibrandstudio.com`) before building the APK, so the app
  knows where to sync.

- Socket.IO needs WebSocket upgrade support from the proxy; polling fallback is enabled
  (`db7ec0f`) for hosts where WebSocket upgrades are blocked.

## 10. Other tools (`tools/`)

```sh
npm run seed -w tools             # load seed_data.json into server DB (upsert)
npm run download-tiles -w tools   # pre-download OSM raster tiles for offline map use
npm run loadtest -w tools         # simulate all 8 teams syncing/locating concurrently
```

## 11. Media export (after the event)

Photos/videos captured during the event live only on each phone — see
[`app/README.md`](app/README.md) for the `adb` commands to pull `RallyMedia/<teamId>/...` off
each device.
