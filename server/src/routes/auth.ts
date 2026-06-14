import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { AuthOrganizerResponse, AuthTeamResponse, SeedData } from '@rally/shared';
import { signToken } from '../auth/jwt.js';
import { config } from '../config.js';
import { buildRoute, stationRowToStation, type StationRow, type TeamRow } from '../db/rows.js';
import { authOrganizerSchema, authTeamSchema } from '../validation.js';

export function authRouter(db: Database.Database, seedData: SeedData): Router {
  const router = Router();

  router.post('/team', (req, res) => {
    const parsed = authTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const team = db
      .prepare<[string], TeamRow>('SELECT * FROM teams WHERE code = ?')
      .get(parsed.data.code);

    if (!team) {
      res.status(401).json({ error: 'Invalid team code' });
      return;
    }

    const stationRows = db.prepare<[], StationRow>('SELECT * FROM stations').all();
    const stations = stationRows.map(stationRowToStation);
    const stationsById = new Map(stations.map((s) => [s.id, s]));
    const routeIds: string[] = JSON.parse(team.route_json);
    const route = buildRoute(routeIds, stationsById);

    const token = signToken({ role: 'team', teamId: team.id });

    const response: AuthTeamResponse = {
      token,
      team: {
        id: team.id,
        name: team.name,
        color: team.color,
        startCategory: route[0]?.category ?? 'cat1',
        score: team.score,
        hintsRemaining: team.hints_remaining,
      },
      route,
      stations,
      event: seedData.event,
    };
    res.json(response);
  });

  router.post('/organizer', (req, res) => {
    const parsed = authOrganizerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { code } = parsed.data;
    let role: 'organizer' | 'admin' | null = null;
    if (code === config.adminCode) {
      role = 'admin';
    } else if (code === config.organizerCode) {
      role = 'organizer';
    }

    if (!role) {
      res.status(401).json({ error: 'Invalid organizer code' });
      return;
    }

    const token = signToken({ role });
    const response: AuthOrganizerResponse = { token, role };
    res.json(response);
  });

  return router;
}
