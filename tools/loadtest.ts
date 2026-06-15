/**
 * Load test (§M9): authenticates all 8 seeded teams, has each send a burst of GPS pings and
 * complete the first two stations of its route concurrently, then prints the resulting
 * scoreboard. Used to confirm the dashboard keeps up and the server DB stays consistent when
 * every team is active at once.
 *
 * Requires a running, seeded server (npm run seed -w tools && npm run dev -w server).
 * Usage: npm run loadtest -w tools
 *        LOADTEST_SERVER_URL=http://localhost:4000 npm run loadtest -w tools
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  AdminTeamSummary,
  AuthOrganizerResponse,
  AuthTeamResponse,
  SeedData,
  SyncEvent,
  SyncResponse,
} from '@rally/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SEED_PATH = resolve(ROOT, 'seed_data.json');

const SERVER_URL = process.env.LOADTEST_SERVER_URL ?? 'http://localhost:4000';
const ADMIN_CODE = process.env.LOADTEST_ADMIN_CODE ?? 'ADMIN-2026';
const LOCATION_PINGS_PER_TEAM = 5;
const STATIONS_PER_TEAM = 2;

function loadSeed(): SeedData {
  return JSON.parse(readFileSync(SEED_PATH, 'utf-8')) as SeedData;
}

function uuid(): string {
  return `loadtest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function authTeam(code: string): Promise<AuthTeamResponse> {
  const response = await fetch(`${SERVER_URL}/auth/team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error(`auth/team ${code} failed: HTTP ${response.status}`);
  return (await response.json()) as AuthTeamResponse;
}

async function sync(token: string, events: SyncEvent[]): Promise<SyncResponse> {
  const response = await fetch(`${SERVER_URL}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ events }),
  });
  if (!response.ok) throw new Error(`sync failed: HTTP ${response.status}`);
  return (await response.json()) as SyncResponse;
}

/** Simulates one team: a burst of GPS pings near its first station, then finishing its first stations. */
async function simulateTeam(auth: AuthTeamResponse): Promise<void> {
  const { token, route } = auth;
  const origin = route[0];
  if (!origin) return;

  const locationEvents: SyncEvent[] = Array.from({ length: LOCATION_PINGS_PER_TEAM }, (_, i) => ({
    uuid: uuid(),
    type: 'location',
    clientTs: Date.now() + i,
    payload: {
      lat: origin.lat + (Math.random() - 0.5) * 0.001,
      lng: origin.lng + (Math.random() - 0.5) * 0.001,
      battery: 80,
    },
  }));
  await sync(token, locationEvents);

  for (const station of route.slice(0, STATIONS_PER_TEAM)) {
    const startedAt = Date.now();
    await sync(token, [{ uuid: uuid(), type: 'scan_start', stationId: station.id, clientTs: startedAt }]);

    const endedAt = Date.now();
    await sync(token, [
      {
        uuid: uuid(),
        type: 'scan_end',
        stationId: station.id,
        clientTs: endedAt,
        payload: { durationSec: Math.round((endedAt - startedAt) / 1000) },
      },
    ]);
  }
}

async function printScoreboard(): Promise<void> {
  const orgResponse = await fetch(`${SERVER_URL}/auth/organizer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: ADMIN_CODE }),
  });
  if (!orgResponse.ok) {
    console.warn(`Could not authenticate as admin (${ADMIN_CODE}) to fetch the scoreboard.`);
    return;
  }
  const { token } = (await orgResponse.json()) as AuthOrganizerResponse;

  const teamsResponse = await fetch(`${SERVER_URL}/admin/teams`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const teams = (await teamsResponse.json()) as AdminTeamSummary[];

  for (const team of teams) {
    const done = team.progress.filter((p) => p.endedAt != null).length;
    console.log(`  ${team.team.name}: score=${team.score}, stations done=${done}`);
  }
}

async function main(): Promise<void> {
  const seed = loadSeed();
  console.log(`Load testing ${seed.teams.length} teams against ${SERVER_URL}...`);

  const start = Date.now();
  const auths = await Promise.all(seed.teams.map((team) => authTeam(team.code)));
  await Promise.all(auths.map((auth) => simulateTeam(auth)));
  console.log(`All ${seed.teams.length} teams synced in ${Date.now() - start}ms.`);

  await printScoreboard();
}

void main();
