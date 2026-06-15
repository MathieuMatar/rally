/**
 * Server used for the one-time `/auth/team` login call.
 * The response's `event.serverUrl` is then cached locally and used for sync (M3).
 * Replace before building for the event.
 */
export const DEFAULT_SERVER_URL = 'https://REPLACE_WITH_YOUR_SERVER';
