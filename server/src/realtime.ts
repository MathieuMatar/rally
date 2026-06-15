import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS } from '@rally/shared';
import { verifyToken } from './auth/jwt.js';

const ORGANIZERS_ROOM = 'organizers';

export function teamRoom(teamId: string): string {
  return `team:${teamId}`;
}

/** Live push layer (§3.3). Durable state still flows through /sync and /admin/*. */
export interface RealtimeHub {
  emitToTeam(teamId: string, event: string, payload: unknown): void;
  emitToOrganizers(event: string, payload: unknown): void;
}

/**
 * Sets up Socket.IO on top of an existing HTTP server. Clients authenticate by emitting
 * `hello` with their bearer token, then join `team:<id>` or `organizers` accordingly.
 */
export function createRealtimeHub(httpServer: HttpServer): RealtimeHub {
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on(SOCKET_EVENTS.HELLO, (data: unknown) => {
      const token = typeof data === 'object' && data !== null ? (data as { token?: unknown }).token : undefined;
      if (typeof token !== 'string') return;

      try {
        const payload = verifyToken(token);
        if (payload.role === 'team') {
          void socket.join(teamRoom(payload.teamId));
        } else {
          void socket.join(ORGANIZERS_ROOM);
        }
      } catch {
        // Invalid/expired token: leave the socket out of any room.
      }
    });
  });

  return {
    emitToTeam(teamId, event, payload) {
      io.to(teamRoom(teamId)).emit(event, payload);
    },
    emitToOrganizers(event, payload) {
      io.to(ORGANIZERS_ROOM).emit(event, payload);
    },
  };
}
