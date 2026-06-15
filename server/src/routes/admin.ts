import { Router } from 'express';
import type Database from 'better-sqlite3';
import type {
  AdminHintResponse,
  AdminScoreResponse,
  AdminTeamSummary,
  Alert,
  ExitEntry,
  OkResponse,
  ProgressEntry,
  Station,
} from '@rally/shared';
import { SOCKET_EVENTS } from '@rally/shared';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { stationRowToStation, type StationRow, type TeamRow } from '../db/rows.js';
import type { RealtimeHub } from '../realtime.js';
import { adminBroadcastSchema, adminClueSchema, adminHintSchema, adminScoreSchema } from '../validation.js';

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

interface AlertRow {
  id: number;
  team_id: string;
  type: string;
  lat: number | null;
  lng: number | null;
  at: number;
  resolved: number;
}

function alertRowToAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    teamId: row.team_id,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    at: row.at,
    resolved: row.resolved !== 0,
  };
}

function csvField(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function adminRouter(db: Database.Database, hub?: RealtimeHub): Router {
  const router = Router();

  const listTeams = db.prepare<[], TeamRow>('SELECT * FROM teams ORDER BY id');
  const getTeamById = db.prepare<[string], TeamRow>('SELECT * FROM teams WHERE id = ?');
  const listProgress = db.prepare<[string], ProgressRow>(
    'SELECT station_id, started_at, ended_at, duration_sec, result, points FROM progress WHERE team_id = ?',
  );
  const listExitEvents = db.prepare<[string], ExitEventRow>(
    "SELECT payload_json FROM events WHERE team_id = ? AND type = 'exit' ORDER BY client_ts ASC",
  );

  function getExits(teamId: string): ExitEntry[] {
    return listExitEvents.all(teamId).flatMap((row) => {
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
  }

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
        exits: getExits(team.id),
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

    const team = getTeamById.get(teamId);
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

  router.post('/score', requireAuth, requireRole('organizer', 'admin'), (req, res) => {
    const parsed = adminScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { teamId, stationId, points } = parsed.data;

    const team = getTeamById.get(teamId);
    if (!team) {
      res.status(404).json({ error: 'Unknown team' });
      return;
    }

    db.prepare(
      `
      INSERT INTO progress (team_id, station_id, points)
      VALUES (?, ?, ?)
      ON CONFLICT(team_id, station_id) DO UPDATE SET points = excluded.points
    `,
    ).run(teamId, stationId, points);

    db.prepare(
      `
      UPDATE teams SET score = (SELECT COALESCE(SUM(points), 0) FROM progress WHERE team_id = ?)
      WHERE id = ?
    `,
    ).run(teamId, teamId);

    const updated = getTeamById.get(teamId) as TeamRow;

    hub?.emitToTeam(teamId, SOCKET_EVENTS.STATE_UPDATE, {
      score: updated.score,
      hintsRemaining: updated.hints_remaining,
    });
    hub?.emitToOrganizers(SOCKET_EVENTS.TEAM_PROGRESS, {
      teamId,
      stationId,
      result: 'completed',
      at: Date.now(),
    });

    const response: AdminScoreResponse = { score: updated.score, points };
    res.json(response);
  });

  router.post('/broadcast', requireAuth, requireRole('organizer', 'admin'), (req, res) => {
    const parsed = adminBroadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { target, message } = parsed.data;

    if (target !== 'all' && !getTeamById.get(target)) {
      res.status(404).json({ error: 'Unknown team' });
      return;
    }

    const at = Date.now();
    db.prepare('INSERT INTO broadcasts (target, message, at) VALUES (?, ?, ?)').run(target, message, at);

    const payload = { message, at };
    if (target === 'all') {
      for (const team of listTeams.all()) {
        hub?.emitToTeam(team.id, SOCKET_EVENTS.BROADCAST, payload);
      }
    } else {
      hub?.emitToTeam(target, SOCKET_EVENTS.BROADCAST, payload);
    }

    const response: OkResponse = { ok: true };
    res.json(response);
  });

  router.post('/clue', requireAuth, requireRole('organizer', 'admin'), (req, res) => {
    const parsed = adminClueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { teamId, text } = parsed.data;

    if (!getTeamById.get(teamId)) {
      res.status(404).json({ error: 'Unknown team' });
      return;
    }

    db.prepare(
      `
      INSERT INTO clue_override (team_id, text, at)
      VALUES (?, ?, ?)
      ON CONFLICT(team_id) DO UPDATE SET text = excluded.text, at = excluded.at
    `,
    ).run(teamId, text, Date.now());

    hub?.emitToTeam(teamId, SOCKET_EVENTS.CLUE_OVERRIDE, { text });

    const response: OkResponse = { ok: true };
    res.json(response);
  });

  router.get('/alerts', requireAuth, requireRole('organizer', 'admin'), (_req, res) => {
    const alerts: Alert[] = db
      .prepare<[], AlertRow>('SELECT id, team_id, type, lat, lng, at, resolved FROM alerts WHERE resolved = 0 ORDER BY at DESC')
      .all()
      .map(alertRowToAlert);
    res.json(alerts);
  });

  router.post('/alerts/:id/resolve', requireAuth, requireRole('organizer', 'admin'), (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid alert id' });
      return;
    }

    const result = db.prepare('UPDATE alerts SET resolved = 1 WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Unknown alert' });
      return;
    }

    const response: OkResponse = { ok: true };
    res.json(response);
  });

  router.get('/export', requireAuth, requireRole('organizer', 'admin'), (_req, res) => {
    const header = [
      'team_id',
      'team_name',
      'score',
      'hints_remaining',
      'exits_count',
      'total_away_sec',
      'station_id',
      'started_at',
      'ended_at',
      'duration_sec',
      'points',
      'result',
    ];
    const rows: string[] = [header.join(',')];

    for (const team of listTeams.all()) {
      const progressRows = listProgress.all(team.id);
      const exits = getExits(team.id);
      const exitsCount = exits.length;
      const totalAwaySec = exits.reduce((sum, exit) => sum + (exit.awaySec ?? 0), 0);
      const teamFields = [team.id, team.name, team.score, team.hints_remaining, exitsCount, totalAwaySec];

      if (progressRows.length === 0) {
        rows.push([...teamFields, '', '', '', '', '', ''].map(csvField).join(','));
        continue;
      }

      for (const p of progressRows) {
        rows.push(
          [...teamFields, p.station_id, p.started_at, p.ended_at, p.duration_sec, p.points, p.result]
            .map(csvField)
            .join(','),
        );
      }
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rally-export.csv"');
    res.send(rows.join('\n'));
  });

  return router;
}
