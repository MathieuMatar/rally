import { describe, expect, it } from 'vitest';
import {
  buildExitEvent,
  buildHelpRequestEvent,
  buildLocationEvent,
  buildScanEndEvent,
  buildScanStartEvent,
  buildSosEvent,
  buildStationResultEvent,
} from './outboxEvents';

const uuid = 'fixed-uuid';
const clientTs = 1_700_000_000_000;

describe('outboxEvents builders', () => {
  it('builds a scan_start event', () => {
    expect(buildScanStartEvent(uuid, clientTs, 'puzzle')).toEqual({
      uuid,
      type: 'scan_start',
      stationId: 'puzzle',
      clientTs,
    });
  });

  it('builds a scan_end event with duration', () => {
    expect(buildScanEndEvent(uuid, clientTs, 'puzzle', 125)).toEqual({
      uuid,
      type: 'scan_end',
      stationId: 'puzzle',
      clientTs,
      payload: { durationSec: 125 },
    });
  });

  it('builds a station_result event', () => {
    expect(buildStationResultEvent(uuid, clientTs, 'puzzle', 'success')).toEqual({
      uuid,
      type: 'station_result',
      stationId: 'puzzle',
      clientTs,
      payload: { result: 'success' },
    });
  });

  it('builds an exit event and derives awaySec', () => {
    const leftAt = 1_700_000_000_000;
    const returnedAt = 1_700_000_015_000;
    expect(buildExitEvent(uuid, clientTs, leftAt, returnedAt)).toEqual({
      uuid,
      type: 'exit',
      clientTs,
      payload: { leftAt, returnedAt, awaySec: 15 },
    });
  });

  it('builds a help_request event', () => {
    expect(buildHelpRequestEvent(uuid, clientTs, 'puzzle')).toEqual({
      uuid,
      type: 'help_request',
      stationId: 'puzzle',
      clientTs,
    });
  });

  it('builds an sos event with last known location', () => {
    expect(buildSosEvent(uuid, clientTs, 33.9, 35.5)).toEqual({
      uuid,
      type: 'sos',
      clientTs,
      payload: { lat: 33.9, lng: 35.5 },
    });
  });

  it('builds an sos event when location is unavailable', () => {
    expect(buildSosEvent(uuid, clientTs, null, null)).toEqual({
      uuid,
      type: 'sos',
      clientTs,
      payload: { lat: null, lng: null },
    });
  });

  it('builds a location event', () => {
    expect(buildLocationEvent(uuid, clientTs, 33.9, 35.5, 80)).toEqual({
      uuid,
      type: 'location',
      clientTs,
      payload: { lat: 33.9, lng: 35.5, battery: 80 },
    });
  });
});
