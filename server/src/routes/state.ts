import { Router } from 'express';
import type Database from 'better-sqlite3';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { TeamTokenPayload } from '../auth/jwt.js';
import { getTeamState } from '../state.js';

export function stateRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', requireAuth, requireRole('team'), (req, res) => {
    const { teamId } = req.auth as TeamTokenPayload;
    res.json(getTeamState(db, teamId));
  });

  return router;
}
