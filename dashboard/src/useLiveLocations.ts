import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '@rally/shared';
import { SERVER_URL } from './config';

export interface TeamLocation {
  teamId: string;
  lat: number;
  lng: number;
  battery: number | null;
  at: number;
}

/** Joins the organizers room and keeps a live map of each team's latest reported location. */
export function useLiveLocations(token: string): Record<string, TeamLocation> {
  const [locations, setLocations] = useState<Record<string, TeamLocation>>({});

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
