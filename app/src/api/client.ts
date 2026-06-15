import type { AuthTeamRequest, AuthTeamResponse } from '@rally/shared';

export class AuthError extends Error {}

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
