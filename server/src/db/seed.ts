import type Database from 'better-sqlite3';
import {
  UPSERT_STATION_SQL,
  UPSERT_TEAM_SQL,
  stationToRow,
  teamToRow,
  type SeedData,
} from '@rally/shared';

/** Upserts stations + teams from seed data into an already-schema'd DB. Used by tests. */
export function seedDatabase(db: Database.Database, data: SeedData): void {
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
}
