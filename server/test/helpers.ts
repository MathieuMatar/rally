import Database from 'better-sqlite3';
import { SERVER_SCHEMA_SQL, type SeedData } from '@rally/shared';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/db/seed.js';
import type { RealtimeHub } from '../src/realtime.js';

/** Records emitted events instead of pushing them over a real socket. */
export class FakeRealtimeHub implements RealtimeHub {
  toTeams: { teamId: string; event: string; payload: unknown }[] = [];
  toOrganizers: { event: string; payload: unknown }[] = [];

  emitToTeam(teamId: string, event: string, payload: unknown): void {
    this.toTeams.push({ teamId, event, payload });
  }

  emitToOrganizers(event: string, payload: unknown): void {
    this.toOrganizers.push({ event, payload });
  }
}

export function buildTestApp(seedData: SeedData, hub?: RealtimeHub) {
  const db = new Database(':memory:');
  db.exec(SERVER_SCHEMA_SQL);
  seedDatabase(db, seedData);
  const app = createApp(db, seedData, hub);
  return { db, app };
}
