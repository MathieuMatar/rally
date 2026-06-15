import type { SyncEvent } from '@rally/shared';

/**
 * Pure builders for the durable events written to the local `outbox` table.
 *
 * `uuid` and `clientTs` are injected rather than generated here so these stay
 * deterministic and unit-testable; callers supply `uuidv4()` / `Date.now()`.
 */

export function buildScanStartEvent(uuid: string, clientTs: number, stationId: string): SyncEvent {
  return { uuid, type: 'scan_start', stationId, clientTs };
}

export function buildScanEndEvent(
  uuid: string,
  clientTs: number,
  stationId: string,
  durationSec: number,
): SyncEvent {
  return { uuid, type: 'scan_end', stationId, clientTs, payload: { durationSec } };
}

export function buildStationResultEvent(
  uuid: string,
  clientTs: number,
  stationId: string,
  result: string,
): SyncEvent {
  return { uuid, type: 'station_result', stationId, clientTs, payload: { result } };
}

export function buildExitEvent(
  uuid: string,
  clientTs: number,
  leftAt: number,
  returnedAt: number,
): SyncEvent {
  return {
    uuid,
    type: 'exit',
    clientTs,
    payload: { leftAt, returnedAt, awaySec: Math.round((returnedAt - leftAt) / 1000) },
  };
}

export function buildHelpRequestEvent(uuid: string, clientTs: number, stationId: string): SyncEvent {
  return { uuid, type: 'help_request', stationId, clientTs };
}

export function buildSosEvent(
  uuid: string,
  clientTs: number,
  lat: number | null,
  lng: number | null,
): SyncEvent {
  return { uuid, type: 'sos', clientTs, payload: { lat, lng } };
}

export function buildLocationEvent(
  uuid: string,
  clientTs: number,
  lat: number,
  lng: number,
  battery: number,
): SyncEvent {
  return { uuid, type: 'location', clientTs, payload: { lat, lng, battery } };
}
