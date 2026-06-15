import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Alert } from '@rally/shared';
import { SOCKET_EVENTS } from '@rally/shared';
import { SERVER_URL } from './config';

const MAX_ALERTS = 20;

/** Joins the organizers room and accumulates `alert` pushes (help_request, sos) as they arrive. */
export function useAlerts(token: string): Alert[] {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      socket.emit(SOCKET_EVENTS.HELLO, { token });
    });

    socket.on(SOCKET_EVENTS.ALERT, (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS));
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return alerts;
}
