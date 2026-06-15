import { getDb } from './client';

/**
 * `currentIndex` is never stored — it's derived from how many stations have
 * an `ended_at`, so a crashed/restarted app always recomputes the right state.
 */
export function getCompletedCount(): number {
  const result = getDb().executeSync('SELECT COUNT(*) as count FROM progress WHERE ended_at IS NOT NULL');
  return Number(result.rows[0]?.count ?? 0);
}

export function getStartedAt(stationId: string): number | null {
  const result = getDb().executeSync('SELECT started_at FROM progress WHERE station_id = ?', [stationId]);
  const row = result.rows[0];
  return row?.started_at != null ? Number(row.started_at) : null;
}

/** Records the scan + starts the per-station timer, in one local transaction. */
export function recordScanStart(uuid: string, stationId: string, clientTs: number): void {
  const db = getDb();
  db.executeSync('INSERT OR IGNORE INTO scans (uuid, station_id, kind, client_ts) VALUES (?, ?, ?, ?)', [
    uuid,
    stationId,
    'START',
    clientTs,
  ]);
  db.executeSync(
    `INSERT INTO progress (station_id, started_at) VALUES (?, ?)
     ON CONFLICT(station_id) DO UPDATE SET started_at = excluded.started_at`,
    [stationId, clientTs],
  );
}

/** Records the scan + closes out the per-station timer, in one local transaction. */
export function recordScanEnd(
  uuid: string,
  stationId: string,
  clientTs: number,
  durationSec: number,
  result: string,
): void {
  const db = getDb();
  db.executeSync('INSERT OR IGNORE INTO scans (uuid, station_id, kind, client_ts) VALUES (?, ?, ?, ?)', [
    uuid,
    stationId,
    'END',
    clientTs,
  ]);
  db.executeSync('UPDATE progress SET ended_at = ?, duration_sec = ?, result = ? WHERE station_id = ?', [
    clientTs,
    durationSec,
    result,
    stationId,
  ]);
}
