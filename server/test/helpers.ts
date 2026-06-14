import Database from 'better-sqlite3';
import { SERVER_SCHEMA_SQL, type SeedData } from '@rally/shared';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/db/seed.js';

export function buildTestApp(seedData: SeedData) {
  const db = new Database(':memory:');
  db.exec(SERVER_SCHEMA_SQL);
  seedDatabase(db, seedData);
  const app = createApp(db, seedData);
  return { db, app };
}
