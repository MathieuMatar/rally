import type { SyncEvent } from '@rally/shared';
import { getDb } from './client';

/** Queues a durable event for the sync worker (M3). Deduped by uuid. */
export function enqueue(event: SyncEvent): void {
  getDb().executeSync(
    'INSERT OR IGNORE INTO outbox (uuid, type, payload_json, client_ts) VALUES (?, ?, ?, ?)',
    [event.uuid, event.type, JSON.stringify(event), event.clientTs],
  );
}

export function getOutboxBatch(limit = 50): SyncEvent[] {
  const result = getDb().executeSync('SELECT payload_json FROM outbox ORDER BY client_ts ASC LIMIT ?', [limit]);
  return result.rows.map((row) => JSON.parse(String(row.payload_json)) as SyncEvent);
}

export function removeFromOutbox(uuids: string[]): void {
  if (uuids.length === 0) return;
  const placeholders = uuids.map(() => '?').join(', ');
  getDb().executeSync(`DELETE FROM outbox WHERE uuid IN (${placeholders})`, uuids);
}

export function incrementTries(uuids: string[]): void {
  if (uuids.length === 0) return;
  const placeholders = uuids.map(() => '?').join(', ');
  getDb().executeSync(`UPDATE outbox SET tries = tries + 1 WHERE uuid IN (${placeholders})`, uuids);
}
