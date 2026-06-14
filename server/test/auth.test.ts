import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadSeedData } from '../src/seedData.js';
import { buildTestApp } from './helpers.js';

const data = loadSeedData();

describe('POST /auth/team', () => {
  it("returns red A's ordered route of 11 stations with coordinates and clues", async () => {
    const { app } = buildTestApp(data);

    const res = await request(app).post('/auth/team').send({ code: 'REDA-2026' });

    expect(res.status).toBe(200);
    expect(res.body.team.id).toBe('red_a');
    expect(res.body.token).toBeTypeOf('string');

    const redA = data.teams.find((t) => t.id === 'red_a')!;
    expect(res.body.route).toHaveLength(11);
    expect(res.body.route.map((s: { id: string }) => s.id)).toEqual(redA.route);
    expect(res.body.route[0]).toMatchObject({
      id: 'ai_or_not',
      lat: expect.any(Number),
      lng: expect.any(Number),
      clue: expect.any(String),
    });

    expect(res.body.stations).toHaveLength(11);
    expect(res.body.event.name).toBe(data.event.name);
  });

  it('rejects an unknown team code', async () => {
    const { app } = buildTestApp(data);

    const res = await request(app).post('/auth/team').send({ code: 'NOT-A-CODE' });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/organizer', () => {
  it('issues an admin token for the admin code', async () => {
    const { app } = buildTestApp(data);

    const res = await request(app).post('/auth/organizer').send({ code: 'ADMIN-2026' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(res.body.token).toBeTypeOf('string');
  });

  it('issues an organizer token for the organizer code', async () => {
    const { app } = buildTestApp(data);

    const res = await request(app).post('/auth/organizer').send({ code: 'ORGANIZER-2026' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('organizer');
  });

  it('rejects an unknown organizer code', async () => {
    const { app } = buildTestApp(data);

    const res = await request(app).post('/auth/organizer').send({ code: 'NOPE' });

    expect(res.status).toBe(401);
  });
});
