import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SeedData } from '@rally/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, '..', '..', 'seed_data.json');

/** Loads seed_data.json — the source of truth for event config (e.g. start time, phones). */
export function loadSeedData(): SeedData {
  return JSON.parse(readFileSync(SEED_PATH, 'utf-8')) as SeedData;
}
