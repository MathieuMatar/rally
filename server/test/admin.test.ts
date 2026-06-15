import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadSeedData } from '../src/seedData.js';
import { buildTestApp } from './helpers.js';

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
});
