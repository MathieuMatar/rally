/**
 * Reads seed_data.json and loads it into the server SQLite DB (server/data/rally.db).
 * Idempotent: stations and teams are upserted by id, so this can be re-run whenever
 * seed_data.json changes before the event without duplicating rows.
 *
 * Usage: npm run seed -w tools
 */
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SeedData } from '@rally/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(ROOT, 'seed_data.json');
const DB_PATH = resolve(ROOT, 'server', 'data', 'rally.db');

function loadSeed(): SeedData {
  return JSON.parse(readFileSync(SEED_PATH, 'utf-8')) as SeedData;
}

function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      code TEXT NOT NULL UNIQUE,
      route_json TEXT NOT NULL,
      hints_remaining INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'idle',
      last_seen INTEGER
    );

    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      clue TEXT NOT NULL,
      start_code TEXT NOT NULL,
      end_code TEXT NOT NULL,
      base_points INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      uuid TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      type TEXT NOT NULL,
      station_id TEXT,
      payload_json TEXT,
      client_ts INTEGER NOT NULL,
      server_ts INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progress (
      team_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      started_at INTEGER,
      ended_at INTEGER,
      duration_sec INTEGER,
      result TEXT,
      points INTEGER,
      PRIMARY KEY (team_id, station_id)
    );

    CREATE TABLE IF NOT EXISTS locations (
      device_id TEXT NOT NULL,
      role TEXT NOT NULL,
      team_id TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      battery INTEGER,
      at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hints_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL,
      at INTEGER NOT NULL,
      by_organizer TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id TEXT NOT NULL,
      type TEXT NOT NULL,
      lat REAL,
      lng REAL,
      at INTEGER NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target TEXT NOT NULL,
      message TEXT NOT NULL,
      at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clue_override (
      team_id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      at INTEGER NOT NULL
    );
  `);
}

function seed(): void {
  const data = loadSeed();

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  ensureSchema(db);

  const upsertStation = db.prepare(`
    INSERT INTO stations (id, name, category, lat, lng, clue, start_code, end_code, base_points)
    VALUES (@id, @name, @category, @lat, @lng, @clue, @startCode, @endCode, @basePoints)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      lat = excluded.lat,
      lng = excluded.lng,
      clue = excluded.clue,
      start_code = excluded.start_code,
      end_code = excluded.end_code,
      base_points = excluded.base_points
  `);

  // Insert new teams with full hint allowance; keep runtime state (score, hints_remaining,
  // status, last_seen) untouched for teams that already exist so re-seeding mid-event is safe.
  const upsertTeam = db.prepare(`
    INSERT INTO teams (id, name, color, phone, code, route_json, hints_remaining, score, status)
    VALUES (@id, @name, @color, @phone, @code, @routeJson, @hintsRemaining, 0, 'idle')
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      color = excluded.color,
      phone = excluded.phone,
      code = excluded.code,
      route_json = excluded.route_json
  `);

  const insertAll = db.transaction(() => {
    for (const station of data.stations) {
      upsertStation.run(station);
    }
    for (const team of data.teams) {
      upsertTeam.run({
        ...team,
        routeJson: JSON.stringify(team.route),
        hintsRemaining: data.event.helpHintsPerTeam,
      });
    }
  });

  insertAll();
  db.close();

  console.log(
    `Seeded ${data.stations.length} stations and ${data.teams.length} teams into ${DB_PATH}`,
  );
}

seed();
