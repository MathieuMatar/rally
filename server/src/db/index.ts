import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SERVER_SCHEMA_SQL } from '@rally/shared';

/** Opens (creating if needed) the server SQLite DB and ensures the schema exists. */
export function openDb(path: string): Database.Database {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  if (path !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.exec(SERVER_SCHEMA_SQL);
  return db;
}
