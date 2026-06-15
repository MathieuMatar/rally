import { getDb } from './client';

/** Records a completed app-exit (background → foreground) locally, mirroring the outbox event. */
export function recordExit(uuid: string, leftAt: number, returnedAt: number, awaySec: number): void {
  getDb().executeSync('INSERT OR IGNORE INTO exits (uuid, left_at, returned_at, away_sec) VALUES (?, ?, ?, ?)', [
    uuid,
    leftAt,
    returnedAt,
    awaySec,
  ]);
}
