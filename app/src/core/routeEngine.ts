import type { Station } from '@rally/shared';

export interface RouteState {
  route: Station[];
  /** Index of the team's current target station. Equals route.length once the route is complete. */
  currentIndex: number;
}

export function createRouteState(route: Station[], currentIndex = 0): RouteState {
  return { route, currentIndex };
}

export function isFinished(state: RouteState): boolean {
  return state.currentIndex >= state.route.length;
}

/** The station the team is currently heading to / working on, or null once the route is done. */
export function getCurrentStation(state: RouteState): Station | null {
  return state.route[state.currentIndex] ?? null;
}

/** The most recently completed station, or null at the very start of the route. */
export function getPreviousStation(state: RouteState): Station | null {
  if (state.currentIndex <= 0) return null;
  return state.route[state.currentIndex - 1] ?? null;
}

/**
 * True when the upcoming station is in a different category than the one just finished —
 * the cue to show the one-time "long walk to the other area" note.
 */
export function isCrossingCategory(state: RouteState): boolean {
  const current = getCurrentStation(state);
  const previous = getPreviousStation(state);
  if (!current || !previous) return false;
  return current.category !== previous.category;
}

export function advance(state: RouteState): RouteState {
  return { ...state, currentIndex: state.currentIndex + 1 };
}
