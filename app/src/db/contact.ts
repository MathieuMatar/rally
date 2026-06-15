import { getDb } from './client';

/** Records a local "I'm stuck" help request, mirroring the outbox `help_request` event. */
export function recordHelpRequest(uuid: string, stationId: string | null, at: number): void {
  getDb().executeSync('INSERT OR IGNORE INTO help_reqs (uuid, station_id, at) VALUES (?, ?, ?)', [
    uuid,
    stationId,
    at,
  ]);
}

/** Records a local SOS alert, mirroring the outbox `sos` event. */
export function recordAlert(uuid: string, type: string, lat: number | null, lng: number | null, at: number): void {
  getDb().executeSync('INSERT OR IGNORE INTO alerts (uuid, type, lat, lng, at) VALUES (?, ?, ?, ?, ?)', [
    uuid,
    type,
    lat,
    lng,
    at,
  ]);
}
