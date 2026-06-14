/**
 * Durable game events: written to local SQLite first, then synced to the server via /sync.
 * Idempotent (deduped by uuid) so retries are safe.
 */
export const DURABLE_EVENT_TYPES = [
  'scan_start',
  'scan_end',
  'station_result',
  'exit',
  'help_request',
  'sos',
  'location',
] as const;

export type DurableEventType = (typeof DURABLE_EVENT_TYPES)[number];

/**
 * Socket.IO event names shared by server, app, and dashboard.
 */
export const SOCKET_EVENTS = {
  // client -> server
  HELLO: 'hello',
  LOCATION: 'location',
  // server -> team
  STATE_UPDATE: 'state_update',
  BROADCAST: 'broadcast',
  CLUE_OVERRIDE: 'clue_override',
  HELP_GRANTED: 'help_granted',
  SOS_ACK: 'sos_ack',
  // server -> organizers/admin
  TEAM_PROGRESS: 'team_progress',
  TEAM_LOCATION: 'team_location',
  ALERT: 'alert',
  EXIT_LOGGED: 'exit_logged',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
