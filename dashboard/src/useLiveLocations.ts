import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '@rally/shared';
import { SERVER_URL } from './config';
import { fetchLocations } from './api';

export interface TeamLocation {
  teamId: string;
  lat: number;
  lng: number;
  battery: number | null;
  at: number;
}

/** Joins the organizers room and keeps a live map of each team's latest reported location.
 *  Seeds from the server's stored locations on mount so pins appear immediately. */
export function useLiveLocations(token: string): Record<string, TeamLocation> {
  const [locations, setLocations] = useState<Record<string, TeamLocation>>({});

  useEffect(() => {
    fetchLocations(token)
      .then((rows) => {
        const initial: Record<string, TeamLocation> = {};
        for (const row of rows) initial[row.teamId] = row;
        setLocations(initial);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      socket.emit(SOCKET_EVENTS.HELLO, { token });
    });

    socket.on(SOCKET_EVENTS.TEAM_LOCATION, (data: TeamLocation) => {
      setLocations((prev) => ({ ...prev, [data.teamId]: data }));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return locations;
}
