/**
 * Reads seed_data.json and loads it into the server SQLite DB (server/data/rally.db).
 * Idempotent: stations and teams are upserted by id, so this can be re-run whenever
 * seed_data.json changes before the event without duplicating rows or resetting scores.
 *
 * Usage: npm run seed -w tools
 */
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SERVER_SCHEMA_SQL,
  UPSERT_STATION_SQL,
  UPSERT_TEAM_SQL,
  stationToRow,
  teamToRow,
  type SeedData,
} from '@rally/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(ROOT, 'seed_data.json');
const DB_PATH = resolve(ROOT, 'server', 'data', 'rally.db');

function loadSeed(): SeedData {
  return JSON.parse(readFileSync(SEED_PATH, 'utf-8')) as SeedData;
}

function seed(): void {
  const data = loadSeed();

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(SERVER_SCHEMA_SQL);

  const upsertStation = db.prepare(UPSERT_STATION_SQL);
  const upsertTeam = db.prepare(UPSERT_TEAM_SQL);

  const insertAll = db.transaction(() => {
    for (const station of data.stations) {
      upsertStation.run(stationToRow(station));
    }
    for (const team of data.teams) {
      upsertTeam.run(teamToRow(team, data.event.helpHintsPerTeam));
    }
  });

  insertAll();
  db.close();

  console.log(
    `Seeded ${data.stations.length} stations and ${data.teams.length} teams into ${DB_PATH}`,
  );
}

seed();
