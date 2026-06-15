import { describe, expect, it } from 'vitest';
import type { Station } from '@rally/shared';
import { advance, createRouteState } from './routeEngine';
import { evaluateScan } from './scan';

function station(id: string): Station {
  return {
    id,
    name: id,
    category: 'cat1',
    lat: 0,
    lng: 0,
    clue: `clue-${id}`,
    startCode: `RALLY:${id}:START`,
    endCode: `RALLY:${id}:END`,
    basePoints: 100,
  };
}

const route: Station[] = [station('ai_or_not'), station('puzzle')];

describe('evaluateScan', () => {
  it('accepts the current station START code', () => {
    const state = createRouteState(route);
    const result = evaluateScan(state, 'START', 'RALLY:ai_or_not:START');
    expect(result).toEqual({ ok: true, station: route[0] });
  });

  it('refuses a START code for a different station ("not your next station")', () => {
    const state = createRouteState(route);
    const result = evaluateScan(state, 'START', 'RALLY:puzzle:START');
    expect(result).toEqual({ ok: false, reason: 'not_expected' });
  });

  it('refuses an END code while expecting a START scan', () => {
    const state = createRouteState(route);
    const result = evaluateScan(state, 'START', 'RALLY:ai_or_not:END');
    expect(result).toEqual({ ok: false, reason: 'not_expected' });
  });

  it('accepts the current station END code', () => {
    const state = createRouteState(route);
    const result = evaluateScan(state, 'END', 'RALLY:ai_or_not:END');
    expect(result).toEqual({ ok: true, station: route[0] });
  });

  it('refuses an END code for a station other than the one started', () => {
    const state = createRouteState(route);
    const result = evaluateScan(state, 'END', 'RALLY:puzzle:END');
    expect(result).toEqual({ ok: false, reason: 'not_expected' });
  });

  it('rejects malformed QR payloads', () => {
    const state = createRouteState(route);
    expect(evaluateScan(state, 'START', 'not-a-rally-code')).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('reports finished once the route is complete', () => {
    const state = advance(advance(createRouteState(route)));
    expect(evaluateScan(state, 'START', 'RALLY:ai_or_not:START')).toEqual({
      ok: false,
      reason: 'finished',
    });
  });
});
