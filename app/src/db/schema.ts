/**
 * Phone DB schema (BUILD_INSTRUCTIONS §2.3) — one SQLite file per app install.
 * `route.base_points` is an addition to the spec's column list: the team app
 * needs it to reconstruct full `Station` objects for the route engine.
 */
export const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS route (
    idx INTEGER PRIMARY KEY,
    station_id TEXT NOT NULL,
    station_name TEXT NOT NULL,
    category TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    clue TEXT NOT NULL,
    start_code TEXT NOT NULL,
    end_code TEXT NOT NULL,
    base_points INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS scans (
    uuid TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    client_ts INTEGER NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS progress (
    station_id TEXT PRIMARY KEY,
    started_at INTEGER,
    ended_at INTEGER,
    duration_sec INTEGER,
    result TEXT,
    synced INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS exits (
    uuid TEXT PRIMARY KEY,
    left_at INTEGER NOT NULL,
    returned_at INTEGER,
    away_sec INTEGER,
    synced INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS help_reqs (
    uuid TEXT PRIMARY KEY,
    station_id TEXT,
    at INTEGER NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS alerts (
    uuid TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    lat REAL,
    lng REAL,
    at INTEGER NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    type TEXT NOT NULL,
    local_path TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS outbox (
    uuid TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    client_ts INTEGER NOT NULL,
    tries INTEGER NOT NULL DEFAULT 0
  )`,
];
