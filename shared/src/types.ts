import type { DurableEventType } from './events';

export type StationCategory = 'cat1' | 'cat2';

export interface Station {
  id: string;
  name: string;
  category: StationCategory;
  lat: number;
  lng: number;
  clue: string;
  startCode: string;
  endCode: string;
  basePoints: number;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  code: string;
  startCategory: StationCategory;
  phone: string;
  /** Ordered list of station ids — this team's full 11-station journey. */
  route: string[];
}

export interface EventConfig {
  name: string;
  town: string;
  eventStartIso: string;
  durationMinutes: number;
  hqPhone: string;
  emergencyPhone: string;
  helpHintsPerTeam: number;
  serverUrl: string;
  qrPayloadFormat: string;
}

/** Shape of seed_data.json — loaded as-is, never regenerated. */
export interface SeedData {
  event: EventConfig;
  stations: Station[];
  teams: Team[];
}

export type Role = 'team' | 'organizer' | 'admin';

// ---------------------------------------------------------------------------
// REST API contracts (§3.4)
// ---------------------------------------------------------------------------

export interface AuthTeamRequest {
  code: string;
}

export interface AuthTeamResponse {
  token: string;
  team: Pick<Team, 'id' | 'name' | 'color' | 'startCategory'> & {
    score: number;
    hintsRemaining: number;
  };
  route: Station[];
  stations: Station[];
  event: EventConfig;
}

export interface AuthOrganizerRequest {
  code: string;
}

export interface AuthOrganizerResponse {
  token: string;
  role: 'organizer' | 'admin';
}

export interface BroadcastMessage {
  message: string;
  at: number;
}

export interface StateResponse {
  score: number;
  hintsRemaining: number;
  clueOverride?: string;
  broadcasts: BroadcastMessage[];
}

export interface SyncEvent {
  uuid: string;
  type: DurableEventType;
  stationId?: string;
  payload?: Record<string, unknown>;
  clientTs: number;
}

export interface SyncRequest {
  events: SyncEvent[];
}

export interface SyncResponse {
  accepted: string[];
  state: StateResponse;
  serverTime: number;
}

// ---------------------------------------------------------------------------
// Admin / organizer contracts
// ---------------------------------------------------------------------------

export interface ProgressEntry {
  stationId: string;
  startedAt: number | null;
  endedAt: number | null;
  durationSec: number | null;
  result: string | null;
  points: number | null;
}

export interface ExitEntry {
  leftAt: number;
  returnedAt: number | null;
  awaySec: number | null;
}

export interface AdminTeamSummary {
  team: Pick<Team, 'id' | 'name' | 'color'>;
  progress: ProgressEntry[];
  score: number;
  hintsRemaining: number;
  exits: ExitEntry[];
  lastSeen: number | null;
  lastStation: string | null;
}

export interface AdminScoreRequest {
  teamId: string;
  stationId: string;
  points: number;
}

export interface AdminHintRequest {
  teamId: string;
  /** Usually -1. Server enforces hintsRemaining >= 0. */
  delta: number;
}

export interface AdminHintResponse {
  hintsRemaining: number;
}

export interface AdminBroadcastRequest {
  /** A team id, or 'all'. */
  target: string;
  message: string;
}

export interface AdminClueRequest {
  teamId: string;
  text: string;
}

export interface Alert {
  id: number;
  teamId: string;
  type: string;
  lat: number | null;
  lng: number | null;
  at: number;
  resolved: boolean;
}
