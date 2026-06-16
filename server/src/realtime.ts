import type { Server as HttpServer } from 'node:http';
import type Database from 'better-sqlite3';
import { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS } from '@rally/shared';
import { verifyToken, type TokenPayload } from './auth/jwt.js';

const ORGANIZERS_ROOM = 'organizers';

export function teamRoom(teamId: string): string {
  return `team:${teamId}`;
}

/** Live push layer (§3.3). Durable state still flows through /sync and /admin/*. */
export interface RealtimeHub {
  emitToTeam(teamId: string, event: string, payload: unknown): void;
  emitToOrganizers(event: string, payload: unknown): void;
}

interface LocationPayload {
  lat: number;
  lng: number;
  battery?: number;
}

function parseLocationPayload(data: unknown): LocationPayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const { lat, lng, battery } = data as { lat?: unknown; lng?: unknown; battery?: unknown };
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { lat, lng, battery: typeof battery === 'number' ? battery : undefined };
}

/**
 * Sets up Socket.IO on top of an existing HTTP server. Clients authenticate by emitting
 * `hello` with their bearer token, then join `team:<id>` or `organizers` accordingly.
 * Authenticated team sockets may emit `location` (§3.3); it's logged to `locations` and
 * relayed to organizers as `team_location`.
 */
export function createRealtimeHub(httpServer: HttpServer, db: Database.Database): RealtimeHub {
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

  const insertLocation = db.prepare(`
    INSERT INTO locations (device_id, role, team_id, lat, lng, battery, at)
    VALUES (@deviceId, @role, @teamId, @lat, @lng, @battery, @at)
  `);

  io.on('connection', (socket) => {
    let auth: TokenPayload | undefined;

    socket.on(SOCKET_EVENTS.HELLO, (data: unknown) => {
      const token = typeof data === 'object' && data !== null ? (data as { token?: unknown }).token : undefined;
      if (typeof token !== 'string') return;

      try {
        auth = verifyToken(token);
        if (auth.role === 'team') {
          void socket.join(teamRoom(auth.teamId));
        } else {
          void socket.join(ORGANIZERS_ROOM);
        }
      } catch {
        auth = undefined;
      }
    });

    socket.on(SOCKET_EVENTS.LOCATION, (data: unknown) => {
      if (!auth || auth.role !== 'team') return;
      const location = parseLocationPayload(data);
      if (!location) return;

      const at = Date.now();
      insertLocation.run({
        deviceId: auth.teamId,
        role: 'team',
        teamId: auth.teamId,
        lat: location.lat,
        lng: location.lng,
        battery: location.battery ?? null,
        at,
      });

      io.to(ORGANIZERS_ROOM).emit(SOCKET_EVENTS.TEAM_LOCATION, {
        teamId: auth.teamId,
        lat: location.lat,
        lng: location.lng,
        battery: location.battery ?? null,
        at,
      });
    });

    // ── WebRTC call signaling relay ──────────────────────────────────────────
    socket.on(SOCKET_EVENTS.CALL_OFFER, (data: unknown) => {
      if (!auth || auth.role !== 'team') return;
      io.to(ORGANIZERS_ROOM).emit(SOCKET_EVENTS.CALL_OFFER, {
        ...(data as object),
        teamId: auth.teamId,
      });
    });

    socket.on(SOCKET_EVENTS.CALL_ICE, (data: unknown) => {
      if (!auth) return;
      const payload = data as { callId?: string; candidate?: unknown; toTeamId?: string };
      if (auth.role === 'team') {
        io.to(ORGANIZERS_ROOM).emit(SOCKET_EVENTS.CALL_ICE, { ...payload, fromTeamId: auth.teamId });
      } else if (payload.toTeamId) {
        io.to(teamRoom(payload.toTeamId)).emit(SOCKET_EVENTS.CALL_ICE, payload);
      }
    });

    socket.on(SOCKET_EVENTS.CALL_ANSWER, (data: unknown) => {
      if (!auth || auth.role === 'team') return;
      const payload = data as { callId?: string; toTeamId?: string; sdp?: unknown };
      if (!payload.toTeamId) return;
      io.to(teamRoom(payload.toTeamId)).emit(SOCKET_EVENTS.CALL_ANSWER, payload);
      // Let other organizers know the call was taken so they can dismiss the ringing UI.
      socket.to(ORGANIZERS_ROOM).emit(SOCKET_EVENTS.CALL_END, { callId: payload.callId, accepted: true });
    });

    socket.on(SOCKET_EVENTS.CALL_END, (data: unknown) => {
      if (!auth) return;
      const payload = data as { callId?: string; toTeamId?: string };
      if (auth.role === 'team') {
        io.to(ORGANIZERS_ROOM).emit(SOCKET_EVENTS.CALL_END, payload);
      } else if (payload.toTeamId) {
        io.to(teamRoom(payload.toTeamId)).emit(SOCKET_EVENTS.CALL_END, payload);
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
