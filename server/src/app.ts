import cors from 'cors';
import express, { type Express } from 'express';
import type Database from 'better-sqlite3';
import type { SeedData } from '@rally/shared';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { stateRouter } from './routes/state.js';
import { syncRouter } from './routes/sync.js';
import { config } from './config.js';
import type { RealtimeHub } from './realtime.js';

export function createApp(db: Database.Database, seedData: SeedData, hub?: RealtimeHub): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/auth', authRouter(db, seedData));
  app.use('/state', stateRouter(db));
  app.use('/sync', syncRouter(db, hub));
  app.use('/admin', adminRouter(db, hub));

  // Pre-downloaded OSM tiles for offline map use (see tools/download-tiles.ts, §M9).
  // Missing files simply 404 — the map's online OSM layer fills the gap.
  app.use('/tiles', express.static(config.tilesPath, { fallthrough: true }));

  return app;
}
