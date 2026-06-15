import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { AdminTeamSummary } from '@rally/shared';
import { SOCKET_EVENTS } from '@rally/shared';
import { fetchTeams } from './api';
import { SERVER_URL } from './config';

const POLL_INTERVAL_MS = 5_000;

export interface LiveTeams {
  teams: AdminTeamSummary[];
  connected: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Loads `/admin/teams` once, then keeps it fresh via Socket.IO `team_progress`/`exit_logged` pushes.
 * Falls back to polling `/admin/teams` every 5s whenever the socket is disconnected.
 */
export function useLiveTeams(token: string): LiveTeams {
  const [teams, setTeams] = useState<AdminTeamSummary[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetchTeams(token)
      .then((data) => {
        setTeams(data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load teams.');
      });
  }, [token]);

  useEffect(() => {
    refresh();

    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.HELLO, { token });
      refresh();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(SOCKET_EVENTS.TEAM_PROGRESS, () => refresh());
    socket.on(SOCKET_EVENTS.EXIT_LOGGED, () => refresh());

    const pollId = setInterval(() => {
      if (!socket.connected) refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollId);
      socket.disconnect();
    };
  }, [token, refresh]);

  return { teams, connected, error, refresh };
}
