import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadSeedData } from '../src/seedData.js';
import { buildTestApp } from './helpers.js';

const data = loadSeedData();

async function teamToken(app: Parameters<typeof request>[0], code: string): Promise<string> {
  const res = await request(app).post('/auth/team').send({ code });
  return res.body.token as string;
}

describe('POST /sync', () => {
  it('rejects requests without a bearer token', async () => {
    const { app } = buildTestApp(data);

    const res = await request(app).post('/sync').send({ events: [] });

    expect(res.status).toBe(401);
  });

  it('applies a batch once, even when the same batch is replayed', async () => {
    const { app, db } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');
    const teamId = 'red_a';

    const events = [
      { uuid: 'evt-start', type: 'scan_start' as const, stationId: 'ai_or_not', clientTs: 1_000 },
      { uuid: 'evt-end', type: 'scan_end' as const, stationId: 'ai_or_not', clientTs: 31_000 },
    ];

    const res1 = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ events });

    expect(res1.status).toBe(200);
    expect(res1.body.accepted).toEqual(['evt-start', 'evt-end']);
    expect(res1.body.state.score).toBe(100); // ai_or_not basePoints

    // Replay the exact same batch.
    const res2 = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ events });

    expect(res2.status).toBe(200);
    expect(res2.body.accepted).toEqual(['evt-start', 'evt-end']);
    expect(res2.body.state.score).toBe(100);

    const eventCount = db
      .prepare('SELECT COUNT(*) as c FROM events WHERE team_id = ?')
      .get(teamId) as { c: number };
    expect(eventCount.c).toBe(2);

    const progress = db
      .prepare('SELECT duration_sec, points FROM progress WHERE team_id = ? AND station_id = ?')
      .get(teamId, 'ai_or_not') as { duration_sec: number; points: number };
    expect(progress.duration_sec).toBe(30);
    expect(progress.points).toBe(100);

    const progressCount = db
      .prepare('SELECT COUNT(*) as c FROM progress WHERE team_id = ?')
      .get(teamId) as { c: number };
    expect(progressCount.c).toBe(1);
  });
});

describe('GET /state', () => {
  it("returns the team's current score and hints", async () => {
    const { app } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app).get('/state').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      score: 0,
      hintsRemaining: data.event.helpHintsPerTeam,
      broadcasts: [],
    });
  });
});
