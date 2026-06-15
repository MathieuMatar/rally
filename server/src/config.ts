import 'dotenv/config';
import { resolve } from 'node:path';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  organizerCode: process.env.ORGANIZER_CODE ?? 'ORGANIZER-2026',
  adminCode: process.env.ADMIN_CODE ?? 'ADMIN-2026',
  dbPath: process.env.DB_PATH ?? resolve(process.cwd(), 'data', 'rally.db'),
  tilesPath: process.env.TILES_PATH ?? resolve(process.cwd(), 'tiles'),
  dashboardDistPath: process.env.DASHBOARD_DIST_PATH ?? resolve(process.cwd(), '..', 'dashboard', 'dist'),
};
