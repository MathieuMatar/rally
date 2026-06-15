import type { AuthTeamRequest, AuthTeamResponse, SyncEvent, SyncRequest, SyncResponse } from '@rally/shared';

export class AuthError extends Error {}
export class SyncError extends Error {}

/** Calls `POST /auth/team`. Only used for first login — everything after that runs offline. */
export async function authTeam(serverUrl: string, code: string): Promise<AuthTeamResponse> {
  let response: Response;
  try {
    response = await fetch(`${serverUrl}/auth/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code } satisfies AuthTeamRequest),
    });
  } catch {
    throw new AuthError('Could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new AuthError('Invalid team code.');
  }

  return (await response.json()) as AuthTeamResponse;
}

/** Calls `POST /sync` with a batch of queued events. Throws `SyncError` on any failure. */
export async function syncEvents(serverUrl: string, token: string, events: SyncEvent[]): Promise<SyncResponse> {
  let response: Response;
  try {
    response = await fetch(`${serverUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events } satisfies SyncRequest),
    });
  } catch {
    throw new SyncError('Could not reach the server.');
  }

  if (!response.ok) {
    throw new SyncError(`Sync failed with status ${response.status}`);
  }

  return (await response.json()) as SyncResponse;
}
