import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { SOCKET_EVENTS } from '@rally/shared';
import { loadSeedData } from '../src/seedData.js';
import { buildTestApp, FakeRealtimeHub } from './helpers.js';

const data = loadSeedData();

async function teamToken(app: Parameters<typeof request>[0], code: string): Promise<string> {
  const res = await request(app).post('/auth/team').send({ code });
  return res.body.token as string;
}

async function organizerToken(app: Parameters<typeof request>[0], code: string): Promise<string> {
  const res = await request(app).post('/auth/organizer').send({ code });
  return res.body.token as string;
}

describe('GET /admin/teams', () => {
  it('rejects requests without a bearer token', async () => {
    const { app } = buildTestApp(data);

    const res = await request(app).get('/admin/teams');

    expect(res.status).toBe(401);
  });

  it('rejects a team token', async () => {
    const { app } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app).get('/admin/teams').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns every team with progress, score, and last station for organizer/admin tokens', async () => {
    const { app } = buildTestApp(data);
    const teamToken_ = await teamToken(app, 'REDA-2026');

    await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${teamToken_}`)
      .send({
        events: [
          { uuid: 'evt-start', type: 'scan_start', stationId: 'ai_or_not', clientTs: 1_000 },
          { uuid: 'evt-end', type: 'scan_end', stationId: 'ai_or_not', clientTs: 31_000 },
        ],
      });

    const orgToken = await organizerToken(app, 'ORGANIZER-2026');
    const res = await request(app).get('/admin/teams').set('Authorization', `Bearer ${orgToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(data.teams.length);

    const redA = res.body.find((t: { team: { id: string } }) => t.team.id === 'red_a');
    expect(redA).toMatchObject({
      team: { id: 'red_a', name: expect.any(String), color: expect.any(String) },
      score: 100,
      hintsRemaining: data.event.helpHintsPerTeam,
      exits: [],
      lastStation: 'ai_or_not',
    });
    expect(redA.progress).toEqual([
      {
        stationId: 'ai_or_not',
        startedAt: 1_000,
        endedAt: 31_000,
        durationSec: 30,
        result: null,
        points: 100,
      },
    ]);
    expect(redA.lastSeen).toEqual(expect.any(Number));
  });

  it('allows the admin role too', async () => {
    const { app } = buildTestApp(data);
    const adminToken = await organizerToken(app, 'ADMIN-2026');

    const res = await request(app).get('/admin/teams').set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(data.teams.length);
  });

  it('includes logged exits for a team', async () => {
    const { app } = buildTestApp(data);
    const teamToken_ = await teamToken(app, 'REDA-2026');

    await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${teamToken_}`)
      .send({
        events: [
          {
            uuid: 'evt-exit-admin',
            type: 'exit',
            clientTs: 5_000,
            payload: { leftAt: 1_000, returnedAt: 5_000, awaySec: 4 },
          },
        ],
      });

    const orgToken = await organizerToken(app, 'ORGANIZER-2026');
    const res = await request(app).get('/admin/teams').set('Authorization', `Bearer ${orgToken}`);

    const redA = res.body.find((t: { team: { id: string } }) => t.team.id === 'red_a');
    expect(redA.exits).toEqual([{ leftAt: 1_000, returnedAt: 5_000, awaySec: 4 }]);
  });
});

describe('GET /admin/stations', () => {
  it('rejects a team token', async () => {
    const { app } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app).get('/admin/stations').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns all 11 stations with coordinates and category for organizer/admin tokens', async () => {
    const { app } = buildTestApp(data);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    const res = await request(app).get('/admin/stations').set('Authorization', `Bearer ${orgToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(data.stations.length);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.stringMatching(/^cat[12]$/),
      lat: expect.any(Number),
      lng: expect.any(Number),
    });
  });
});

describe('POST /admin/hint', () => {
  it('rejects a team token', async () => {
    const { app } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app)
      .post('/admin/hint')
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId: 'red_a', delta: -1 });

    expect(res.status).toBe(403);
  });

  it('decrements hintsRemaining and emits help_granted to the team', async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');
    const before = data.event.helpHintsPerTeam;

    const res = await request(app)
      .post('/admin/hint')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ teamId: 'red_a', delta: -1 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hintsRemaining: before - 1 });
    expect(hub.toTeams).toContainEqual({
      teamId: 'red_a',
      event: SOCKET_EVENTS.HELP_GRANTED,
      payload: { hintsRemaining: before - 1 },
    });
  });

  it('never lets hintsRemaining go below 0', async () => {
    const { app } = buildTestApp(data);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    for (let i = 0; i < data.event.helpHintsPerTeam + 2; i++) {
      await request(app)
        .post('/admin/hint')
        .set('Authorization', `Bearer ${orgToken}`)
        .send({ teamId: 'red_a', delta: -1 });
    }

    const res = await request(app).get('/admin/teams').set('Authorization', `Bearer ${orgToken}`);
    const redA = res.body.find((t: { team: { id: string } }) => t.team.id === 'red_a');
    expect(redA.hintsRemaining).toBe(0);
  });
});
