import type {
  AdminBroadcastRequest,
  AdminClueRequest,
  AdminHintRequest,
  AdminHintResponse,
  AdminScoreRequest,
  AdminScoreResponse,
  AdminTeamSummary,
  Alert,
  AuthOrganizerRequest,
  AuthOrganizerResponse,
  OkResponse,
  Station,
} from '@rally/shared';
import { SERVER_URL } from './config';

export class ApiError extends Error {}

/** Calls `POST /auth/organizer`. */
export async function authOrganizer(code: string): Promise<AuthOrganizerResponse> {
  let response: Response;
  try {
    response = await fetch(`${SERVER_URL}/auth/organizer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code } satisfies AuthOrganizerRequest),
    });
  } catch {
    throw new ApiError('Could not reach the server.');
  }

  if (!response.ok) {
    throw new ApiError('Invalid code.');
  }

  return (await response.json()) as AuthOrganizerResponse;
}

/** Calls `GET /admin/teams`. */
export async function fetchTeams(token: string): Promise<AdminTeamSummary[]> {
  const response = await fetch(`${SERVER_URL}/admin/teams`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new ApiError(`Failed to load teams (${response.status}).`);
  }

  return (await response.json()) as AdminTeamSummary[];
}

/** Calls `GET /admin/stations`. */
export async function fetchStations(token: string): Promise<Station[]> {
  const response = await fetch(`${SERVER_URL}/admin/stations`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new ApiError(`Failed to load stations (${response.status}).`);
  }

  return (await response.json()) as Station[];
}

/** Calls `POST /admin/hint`. `delta` is usually -1; the server enforces hintsRemaining >= 0. */
export async function sendHint(token: string, teamId: string, delta: number): Promise<AdminHintResponse> {
  const response = await fetch(`${SERVER_URL}/admin/hint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ teamId, delta } satisfies AdminHintRequest),
  });

  if (!response.ok) {
    throw new ApiError(`Failed to grant hint (${response.status}).`);
  }

  return (await response.json()) as AdminHintResponse;
}

/** Calls `POST /admin/score` to set/overwrite a team's points for one station. */
export async function sendScore(
  token: string,
  teamId: string,
  stationId: string,
  points: number,
): Promise<AdminScoreResponse> {
  const response = await fetch(`${SERVER_URL}/admin/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ teamId, stationId, points } satisfies AdminScoreRequest),
  });

  if (!response.ok) {
    throw new ApiError(`Failed to set score (${response.status}).`);
  }

  return (await response.json()) as AdminScoreResponse;
}

/** Calls `POST /admin/broadcast`. `target` is a team id or `'all'`. */
export async function sendBroadcast(token: string, target: string, message: string): Promise<OkResponse> {
  const response = await fetch(`${SERVER_URL}/admin/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ target, message } satisfies AdminBroadcastRequest),
  });

  if (!response.ok) {
    throw new ApiError(`Failed to send broadcast (${response.status}).`);
  }

  return (await response.json()) as OkResponse;
}

/** Calls `POST /admin/clue` to push a manual next-clue override to a team. */
export async function sendClueOverride(token: string, teamId: string, text: string): Promise<OkResponse> {
  const response = await fetch(`${SERVER_URL}/admin/clue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ teamId, text } satisfies AdminClueRequest),
  });

  if (!response.ok) {
    throw new ApiError(`Failed to send clue override (${response.status}).`);
  }

  return (await response.json()) as OkResponse;
}

/** Calls `GET /admin/alerts` for the current open alerts queue. */
export async function fetchAlerts(token: string): Promise<Alert[]> {
  const response = await fetch(`${SERVER_URL}/admin/alerts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new ApiError(`Failed to load alerts (${response.status}).`);
  }

  return (await response.json()) as Alert[];
}

/** Calls `POST /admin/alerts/:id/resolve`. */
export async function resolveAlert(token: string, alertId: number): Promise<OkResponse> {
  const response = await fetch(`${SERVER_URL}/admin/alerts/${alertId}/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new ApiError(`Failed to resolve alert (${response.status}).`);
  }

  return (await response.json()) as OkResponse;
}

/** Calls `GET /admin/export` and returns the CSV body as a Blob for download. */
export async function exportResultsCsv(token: string): Promise<Blob> {
  const response = await fetch(`${SERVER_URL}/admin/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new ApiError(`Failed to export results (${response.status}).`);
  }

  return await response.blob();
}
