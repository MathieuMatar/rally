import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { AdminHintResponse, AdminTeamSummary, ExitEntry, ProgressEntry, Station } from '@rally/shared';
import { SOCKET_EVENTS } from '@rally/shared';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { stationRowToStation, type StationRow, type TeamRow } from '../db/rows.js';
import type { RealtimeHub } from '../realtime.js';
import { adminHintSchema } from '../validation.js';

interface ProgressRow {
  station_id: string;
  started_at: number | null;
  ended_at: number | null;
  duration_sec: number | null;
  result: string | null;
  points: number | null;
}

interface ExitEventRow {
  payload_json: string | null;
}

interface HintsRemainingRow {
  hints_remaining: number;
}

export function adminRouter(db: Database.Database, hub?: RealtimeHub): Router {
  const router = Router();

  const listTeams = db.prepare<[], TeamRow>('SELECT * FROM teams ORDER BY id');
  const listProgress = db.prepare<[string], ProgressRow>(
    'SELECT station_id, started_at, ended_at, duration_sec, result, points FROM progress WHERE team_id = ?',
  );
  const listExits = db.prepare<[string], ExitEventRow>(
    "SELECT payload_json FROM events WHERE team_id = ? AND type = 'exit' ORDER BY client_ts ASC",
  );

  router.get('/teams', requireAuth, requireRole('organizer', 'admin'), (_req, res) => {
    const summaries: AdminTeamSummary[] = listTeams.all().map((team) => {
      const progressRows = listProgress.all(team.id);
      const progress: ProgressEntry[] = progressRows.map((row) => ({
        stationId: row.station_id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        durationSec: row.duration_sec,
        result: row.result,
        points: row.points,
      }));

      const lastCompleted = [...progressRows]
        .filter((row) => row.ended_at != null)
        .sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0))[0];

      const exits: ExitEntry[] = listExits.all(team.id).flatMap((row) => {
        if (!row.payload_json) return [];
        const payload = JSON.parse(row.payload_json) as { leftAt?: unknown; returnedAt?: unknown; awaySec?: unknown };
        if (typeof payload.leftAt !== 'number' || typeof payload.awaySec !== 'number') return [];
        return [
          {
            leftAt: payload.leftAt,
            returnedAt: typeof payload.returnedAt === 'number' ? payload.returnedAt : null,
            awaySec: payload.awaySec,
          },
        ];
      });

      return {
        team: { id: team.id, name: team.name, color: team.color },
        progress,
        score: team.score,
        hintsRemaining: team.hints_remaining,
        exits,
        lastSeen: team.last_seen,
        lastStation: lastCompleted?.station_id ?? null,
      };
    });

    res.json(summaries);
  });

  router.get('/stations', requireAuth, requireRole('organizer', 'admin'), (_req, res) => {
    const stations: Station[] = db
      .prepare<[], StationRow>('SELECT * FROM stations')
      .all()
      .map(stationRowToStation);
    res.json(stations);
  });

  router.post('/hint', requireAuth, requireRole('organizer', 'admin'), (req, res) => {
    const parsed = adminHintSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { teamId, delta } = parsed.data;

    const team = db.prepare<[string], HintsRemainingRow>('SELECT hints_remaining FROM teams WHERE id = ?').get(teamId);
    if (!team) {
      res.status(404).json({ error: 'Unknown team' });
      return;
    }

    const hintsRemaining = Math.max(0, team.hints_remaining + delta);
    db.prepare('UPDATE teams SET hints_remaining = ? WHERE id = ?').run(hintsRemaining, teamId);
    db.prepare('INSERT INTO hints_log (team_id, at, by_organizer, note) VALUES (?, ?, ?, ?)').run(
      teamId,
      Date.now(),
      req.auth?.role ?? null,
      null,
    );

    hub?.emitToTeam(teamId, SOCKET_EVENTS.HELP_GRANTED, { hintsRemaining });

    const response: AdminHintResponse = { hintsRemaining };
    res.json(response);
  });

  return router;
}
