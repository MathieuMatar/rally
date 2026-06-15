import { useEffect, useState } from 'react';
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
}

/**
 * Loads `/admin/teams` once, then keeps it fresh via Socket.IO `team_progress` pushes.
 * Falls back to polling `/admin/teams` every 5s whenever the socket is disconnected.
 */
export function useLiveTeams(token: string): LiveTeams {
  const [teams, setTeams] = useState<AdminTeamSummary[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      fetchTeams(token)
        .then((data) => {
          if (cancelled) return;
          setTeams(data);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : 'Failed to load teams.');
        });
    };

    refresh();

    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SOCKET_EVENTS.HELLO, { token });
      refresh();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on(SOCKET_EVENTS.TEAM_PROGRESS, () => refresh());

    const pollId = setInterval(() => {
      if (!socket.connected) refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      socket.disconnect();
    };
  }, [token]);

  return { teams, connected, error };
}
