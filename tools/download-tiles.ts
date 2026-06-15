/**
 * Pre-downloads OSM raster tiles covering the Gharzouz station bounding box (derived from
 * seed_data.json, plus a margin) at zoom 16-19, into server/tiles/{z}/{x}/{y}.png. The server
 * serves this directory at /tiles (see server/src/app.ts); shared/src/map/mapHtml.ts layers it
 * over the public OSM CDN so the map still renders with no internet access at the event.
 *
 * This is a one-off pre-event download for a small area (a few hundred tiles), rate-limited
 * and sent with a descriptive User-Agent per OSM's tile usage policy. Re-run only if the route
 * (and therefore the bounding box) changes.
 *
 * Usage: npm run download-tiles -w tools
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SeedData } from '@rally/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(ROOT, 'seed_data.json');
const TILES_DIR = resolve(ROOT, 'server', 'tiles');

const ZOOM_LEVELS = [16, 17, 18, 19];
const MARGIN_DEG = 0.003; // ~300m around the outermost stations
const TILE_SERVER = 'https://tile.openstreetmap.org';
const USER_AGENT = 'rally-app-tile-downloader/1.0 (one-off pre-event offline cache)';
const DELAY_MS = 250;

interface Bounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

function lon2x(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}

function lat2y(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

function loadBounds(): Bounds {
  const data = JSON.parse(readFileSync(SEED_PATH, 'utf-8')) as SeedData;
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;

  for (const station of data.stations) {
    minLat = Math.min(minLat, station.lat);
    maxLat = Math.max(maxLat, station.lat);
    minLng = Math.min(minLng, station.lng);
    maxLng = Math.max(maxLng, station.lng);
  }

  return {
    minLat: minLat - MARGIN_DEG,
    maxLat: maxLat + MARGIN_DEG,
    minLng: minLng - MARGIN_DEG,
    maxLng: maxLng + MARGIN_DEG,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function downloadTile(z: number, x: number, y: number): Promise<'saved' | 'skipped' | 'failed'> {
  const dir = resolve(TILES_DIR, String(z), String(x));
  const path = resolve(dir, `${y}.png`);
  if (existsSync(path)) return 'skipped';

  const response = await fetch(`${TILE_SERVER}/${z}/${x}/${y}.png`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    console.warn(`  failed ${z}/${x}/${y}: HTTP ${response.status}`);
    return 'failed';
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  return 'saved';
}

async function main(): Promise<void> {
  const bounds = loadBounds();
  const counts = { saved: 0, skipped: 0, failed: 0 };

  for (const z of ZOOM_LEVELS) {
    const xMin = lon2x(bounds.minLng, z);
    const xMax = lon2x(bounds.maxLng, z);
    const yMin = lat2y(bounds.maxLat, z); // larger latitude -> smaller y
    const yMax = lat2y(bounds.minLat, z);

    console.log(`Zoom ${z}: x ${xMin}-${xMax}, y ${yMin}-${yMax}`);

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const outcome = await downloadTile(z, x, y);
        counts[outcome] += 1;
        if (outcome === 'saved') await delay(DELAY_MS);
      }
    }
  }

  console.log(`Done. saved=${counts.saved} skipped=${counts.skipped} failed=${counts.failed} in ${TILES_DIR}`);
}

void main();
