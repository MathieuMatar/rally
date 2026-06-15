import { parseCode, type Station } from '@rally/shared';
import { getCurrentStation, isFinished, type RouteState } from './routeEngine';

export type ScanMode = 'START' | 'END';

export type ScanResult =
  | { ok: true; station: Station }
  | { ok: false; reason: 'finished' | 'malformed' | 'not_expected' };

/**
 * Validates a scanned QR payload against the team's current target station.
 *
 * - In START mode, the code must be exactly `currentStation.startCode`.
 * - In END mode, the code must be exactly `currentStation.endCode` (the station the team
 *   already started — scanning some other station's END is refused).
 */
export function evaluateScan(state: RouteState, mode: ScanMode, rawCode: string): ScanResult {
  if (isFinished(state)) {
    return { ok: false, reason: 'finished' };
  }

  if (!parseCode(rawCode)) {
    return { ok: false, reason: 'malformed' };
  }

  const current = getCurrentStation(state) as Station;
  const expected = mode === 'START' ? current.startCode : current.endCode;

  if (rawCode !== expected) {
    return { ok: false, reason: 'not_expected' };
  }

  return { ok: true, station: current };
}
