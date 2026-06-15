import type {
  AdminHintRequest,
  AdminHintResponse,
  AdminTeamSummary,
  AuthOrganizerRequest,
  AuthOrganizerResponse,
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
