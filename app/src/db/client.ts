import { open, type DB } from '@op-engineering/op-sqlite';
import { MIGRATIONS } from './schema';

let db: DB | null = null;

/** Opens (or returns the already-open) on-device database, running migrations on first access. */
export function getDb(): DB {
  if (!db) {
    db = open({ name: 'rally.db' });
    for (const statement of MIGRATIONS) {
      db.executeSync(statement);
    }
  }
  return db;
}
