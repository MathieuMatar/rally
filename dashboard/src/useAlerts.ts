import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { Alert } from '@rally/shared';
import { SOCKET_EVENTS } from '@rally/shared';
import { fetchAlerts, resolveAlert } from './api';
import { SERVER_URL } from './config';

const MAX_ALERTS = 20;

export interface AlertsState {
  alerts: Alert[];
  resolve: (alertId: number) => Promise<void>;
}

/**
 * Loads the open alerts queue from `/admin/alerts`, then joins the organizers room and
 * accumulates `alert` pushes (help_request, sos) as they arrive.
 */
export function useAlerts(token: string): AlertsState {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    fetchAlerts(token)
      .then((data) => setAlerts(data))
      .catch(() => {
        // The socket feed will still pick up new alerts as they arrive.
      });

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

  const resolve = useCallback(
    async (alertId: number) => {
      await resolveAlert(token, alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    },
    [token],
  );

  return { alerts, resolve };
}
