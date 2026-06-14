import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { SyncResponse } from '@rally/shared';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { TeamTokenPayload } from '../auth/jwt.js';
import { getTeamState } from '../state.js';
import { applySyncEvent } from '../sync/apply.js';
import { syncRequestSchema } from '../validation.js';

export function syncRouter(db: Database.Database): Router {
  const router = Router();

  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO events (uuid, team_id, type, station_id, payload_json, client_ts, server_ts)
    VALUES (@uuid, @teamId, @type, @stationId, @payloadJson, @clientTs, @serverTs)
  `);

  router.post('/', requireAuth, requireRole('team'), (req, res) => {
    const parsed = syncRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { teamId } = req.auth as TeamTokenPayload;
    const events = [...parsed.data.events].sort((a, b) => a.clientTs - b.clientTs);
    const accepted: string[] = [];

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
          applySyncEvent(db, teamId, event, serverTs);
        }
        accepted.push(event.uuid);
      }
    });
    run();

    const response: SyncResponse = {
      accepted,
      state: getTeamState(db, teamId),
      serverTime: Date.now(),
    };
    res.json(response);
  });

  return router;
}
