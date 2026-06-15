import { describe, expect, it } from 'vitest';
import type { Station } from '@rally/shared';
import {
  advance,
  createRouteState,
  getCurrentStation,
  getPreviousStation,
  isCrossingCategory,
  isFinished,
} from './routeEngine';

function station(id: string, category: Station['category']): Station {
  return {
    id,
    name: id,
    category,
    lat: 0,
    lng: 0,
    clue: `clue-${id}`,
    startCode: `RALLY:${id}:START`,
    endCode: `RALLY:${id}:END`,
    basePoints: 100,
  };
}

const route: Station[] = [
  station('a', 'cat1'),
  station('b', 'cat1'),
  station('c', 'cat2'),
];

describe('routeEngine', () => {
  it('starts at the first station with no previous station', () => {
    const state = createRouteState(route);
    expect(getCurrentStation(state)?.id).toBe('a');
    expect(getPreviousStation(state)).toBeNull();
    expect(isCrossingCategory(state)).toBe(false);
    expect(isFinished(state)).toBe(false);
  });

  it('does not flag a crossing within the same category', () => {
    const state = advance(createRouteState(route));
    expect(getCurrentStation(state)?.id).toBe('b');
    expect(getPreviousStation(state)?.id).toBe('a');
    expect(isCrossingCategory(state)).toBe(false);
  });

  it('flags a crossing when the category changes', () => {
    const state = advance(advance(createRouteState(route)));
    expect(getCurrentStation(state)?.id).toBe('c');
    expect(getPreviousStation(state)?.id).toBe('b');
    expect(isCrossingCategory(state)).toBe(true);
  });

  it('is finished once the team passes the last station', () => {
    const state = advance(advance(advance(createRouteState(route))));
    expect(isFinished(state)).toBe(true);
    expect(getCurrentStation(state)).toBeNull();
  });
});
