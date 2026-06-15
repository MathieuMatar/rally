import type Database from 'better-sqlite3';
import type { Alert, SyncEvent } from '@rally/shared';

interface ProgressStartedRow {
  started_at: number | null;
}

interface StationPointsRow {
  base_points: number;
}

/** Notifications the route should push over the realtime hub after the sync transaction commits. */
export type SyncSideEffect =
  | { kind: 'alert'; alert: Alert }
  | { kind: 'exit_logged'; teamId: string; awaySec: number; at: number }
  | { kind: 'sos_ack'; teamId: string };

/** Applies the §5 side-effects for one durable event. Called only for newly-inserted events. */
export function applySyncEvent(
  db: Database.Database,
  teamId: string,
  event: SyncEvent,
  serverTs: number,
): SyncSideEffect[] {
  let sideEffects: SyncSideEffect[] = [];

  switch (event.type) {
    case 'scan_start':
      applyScanStart(db, teamId, event);
      break;
    case 'scan_end':
      applyScanEnd(db, teamId, event);
      break;
    case 'station_result':
      applyStationResult(db, teamId, event);
      break;
    case 'exit':
      sideEffects = applyExit(teamId, event);
      break;
    case 'help_request':
      sideEffects = applyHelpRequest(db, teamId, event);
      break;
    case 'sos':
      sideEffects = applySos(db, teamId, event);
      break;
    case 'location':
      applyLocation(db, teamId, event);
      break;
  }

  db.prepare('UPDATE teams SET last_seen = ? WHERE id = ?').run(serverTs, teamId);
  return sideEffects;
}

function applyScanStart(db: Database.Database, teamId: string, event: SyncEvent): void {
  if (!event.stationId) return;

  db.prepare(
    `
    INSERT INTO progress (team_id, station_id, started_at)
    VALUES (?, ?, ?)
    ON CONFLICT(team_id, station_id) DO UPDATE SET started_at = excluded.started_at
  `,
  ).run(teamId, event.stationId, event.clientTs);

  db.prepare("UPDATE teams SET status = 'in_station' WHERE id = ?").run(teamId);
}

function applyScanEnd(db: Database.Database, teamId: string, event: SyncEvent): void {
  if (!event.stationId) return;

  const existing = db
    .prepare<
      [string, string],
      ProgressStartedRow
    >('SELECT started_at FROM progress WHERE team_id = ? AND station_id = ?')
    .get(teamId, event.stationId);

  const startedAt = existing?.started_at ?? null;
  const durationSec =
    startedAt != null ? Math.max(0, Math.round((event.clientTs - startedAt) / 1000)) : null;

  const payloadPoints = event.payload?.points;
  let points = typeof payloadPoints === 'number' ? payloadPoints : null;
  if (points == null) {
    const station = db
      .prepare<[string], StationPointsRow>('SELECT base_points FROM stations WHERE id = ?')
      .get(event.stationId);
    points = station?.base_points ?? 0;
  }

  db.prepare(
    `
    INSERT INTO progress (team_id, station_id, ended_at, duration_sec, points)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(team_id, station_id) DO UPDATE SET
      ended_at = excluded.ended_at,
      duration_sec = excluded.duration_sec,
      points = excluded.points
  `,
  ).run(teamId, event.stationId, event.clientTs, durationSec, points);

  db.prepare(
    `
    UPDATE teams SET
      score = (SELECT COALESCE(SUM(points), 0) FROM progress WHERE team_id = ?),
      status = 'moving'
    WHERE id = ?
  `,
  ).run(teamId, teamId);
}

function applyStationResult(db: Database.Database, teamId: string, event: SyncEvent): void {
  if (!event.stationId) return;

  const result = event.payload?.result;
  if (typeof result !== 'string') return;

  db.prepare(
    `
    INSERT INTO progress (team_id, station_id, result)
    VALUES (?, ?, ?)
    ON CONFLICT(team_id, station_id) DO UPDATE SET result = excluded.result
  `,
  ).run(teamId, event.stationId, result);
}

function applyExit(teamId: string, event: SyncEvent): SyncSideEffect[] {
  const awaySec = event.payload?.awaySec;
  if (typeof awaySec !== 'number') return [];

  return [{ kind: 'exit_logged', teamId, awaySec, at: event.clientTs }];
}

function applyHelpRequest(db: Database.Database, teamId: string, event: SyncEvent): SyncSideEffect[] {
  const result = db
    .prepare(
      `
    INSERT INTO alerts (team_id, type, lat, lng, at, resolved)
    VALUES (?, 'help_request', NULL, NULL, ?, 0)
  `,
    )
    .run(teamId, event.clientTs);

  return [
    {
      kind: 'alert',
      alert: {
        id: Number(result.lastInsertRowid),
        teamId,
        type: 'help_request',
        lat: null,
        lng: null,
        at: event.clientTs,
        resolved: false,
      },
    },
  ];
}

function applySos(db: Database.Database, teamId: string, event: SyncEvent): SyncSideEffect[] {
  const lat = typeof event.payload?.lat === 'number' ? event.payload.lat : null;
  const lng = typeof event.payload?.lng === 'number' ? event.payload.lng : null;

  const result = db
    .prepare(
      `
    INSERT INTO alerts (team_id, type, lat, lng, at, resolved)
    VALUES (?, 'sos', ?, ?, ?, 0)
  `,
    )
    .run(teamId, lat, lng, event.clientTs);

  return [
    {
      kind: 'alert',
      alert: {
        id: Number(result.lastInsertRowid),
        teamId,
        type: 'sos',
        lat,
        lng,
        at: event.clientTs,
        resolved: false,
      },
    },
    { kind: 'sos_ack', teamId },
  ];
}

function applyLocation(db: Database.Database, teamId: string, event: SyncEvent): void {
  const lat = event.payload?.lat;
  const lng = event.payload?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return;

  const battery = typeof event.payload?.battery === 'number' ? event.payload.battery : null;
  const deviceId = typeof event.payload?.deviceId === 'string' ? event.payload.deviceId : teamId;

  db.prepare(
    `
    INSERT INTO locations (device_id, role, team_id, lat, lng, battery, at)
    VALUES (?, 'team', ?, ?, ?, ?, ?)
  `,
  ).run(deviceId, teamId, lat, lng, battery, event.clientTs);
}
