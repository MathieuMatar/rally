import { Router } from 'express';
import type Database from 'better-sqlite3';
import { SOCKET_EVENTS, type SyncResponse } from '@rally/shared';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { TeamTokenPayload } from '../auth/jwt.js';
import type { RealtimeHub } from '../realtime.js';
import { getTeamState } from '../state.js';
import { applySyncEvent, type SyncSideEffect } from '../sync/apply.js';
import { syncRequestSchema } from '../validation.js';

interface ProgressResultRow {
  ended_at: number | null;
  result: string | null;
}

export function syncRouter(db: Database.Database, hub?: RealtimeHub): Router {
  const router = Router();

  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO events (uuid, team_id, type, station_id, payload_json, client_ts, server_ts)
    VALUES (@uuid, @teamId, @type, @stationId, @payloadJson, @clientTs, @serverTs)
  `);

  const getProgress = db.prepare<[string, string], ProgressResultRow>(
    'SELECT ended_at, result FROM progress WHERE team_id = ? AND station_id = ?',
  );

  router.post('/', requireAuth, requireRole('team'), (req, res) => {
    const parsed = syncRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { teamId } = req.auth as TeamTokenPayload;
    const events = [...parsed.data.events].sort((a, b) => a.clientTs - b.clientTs);
    const accepted: string[] = [];
    const completedStationIds: string[] = [];
    const sideEffects: SyncSideEffect[] = [];

    const run = db.transaction(() => {
      for (const event of events) {
        const serverTs = Date.now();
        const result = insertEvent.run({
          uuid: event.uuid,
          teamId,
          type: event.type,
          stationId: event.stationId ?? null,
          payloadJson: event.payload ? JSON.stringify(event.payload) : null,
          clientTs: event.clientTs,
          serverTs,
        });

        if (result.changes === 1) {
          sideEffects.push(...applySyncEvent(db, teamId, event, serverTs));
          if (event.type === 'scan_end' && event.stationId) {
            completedStationIds.push(event.stationId);
          }
        }
        accepted.push(event.uuid);
      }
    });
    run();

    const state = getTeamState(db, teamId);

    if (hub) {
      for (const stationId of completedStationIds) {
        const progress = getProgress.get(teamId, stationId);
        hub.emitToOrganizers(SOCKET_EVENTS.TEAM_PROGRESS, {
          teamId,
          stationId,
          result: progress?.result ?? 'completed',
          at: progress?.ended_at ?? Date.now(),
        });
      }
      if (completedStationIds.length > 0) {
        hub.emitToTeam(teamId, SOCKET_EVENTS.STATE_UPDATE, {
          score: state.score,
          hintsRemaining: state.hintsRemaining,
        });
      }
      for (const effect of sideEffects) {
        switch (effect.kind) {
          case 'alert':
            hub.emitToOrganizers(SOCKET_EVENTS.ALERT, effect.alert);
            break;
          case 'exit_logged':
            hub.emitToOrganizers(SOCKET_EVENTS.EXIT_LOGGED, {
              teamId: effect.teamId,
              awaySec: effect.awaySec,
              at: effect.at,
            });
            break;
          case 'sos_ack':
            hub.emitToTeam(effect.teamId, SOCKET_EVENTS.SOS_ACK, {});
            break;
        }
      }
    }

    const response: SyncResponse = {
      accepted,
      state,
      serverTime: Date.now(),
    };
    res.json(response);
  });

  return router;
}
