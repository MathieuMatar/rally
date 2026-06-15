import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { AdminTeamSummary, ProgressEntry } from '@rally/shared';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { TeamRow } from '../db/rows.js';

interface ProgressRow {
  station_id: string;
  started_at: number | null;
  ended_at: number | null;
  duration_sec: number | null;
  result: string | null;
  points: number | null;
}

export function adminRouter(db: Database.Database): Router {
  const router = Router();

  const listTeams = db.prepare<[], TeamRow>('SELECT * FROM teams ORDER BY id');
  const listProgress = db.prepare<[string], ProgressRow>(
    'SELECT station_id, started_at, ended_at, duration_sec, result, points FROM progress WHERE team_id = ?',
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

      return {
        team: { id: team.id, name: team.name, color: team.color },
        progress,
        score: team.score,
        hintsRemaining: team.hints_remaining,
        exits: [],
        lastSeen: team.last_seen,
        lastStation: lastCompleted?.station_id ?? null,
      };
    });

    res.json(summaries);
  });

  return router;
}
