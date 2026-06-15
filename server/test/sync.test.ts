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

describe('POST /sync — realtime emissions', () => {
  it('emits team_progress to organizers and state_update to the team on scan_end', async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
    const token = await teamToken(app, 'REDA-2026');

    const events = [
      { uuid: 'evt-start-2', type: 'scan_start' as const, stationId: 'ai_or_not', clientTs: 1_000 },
      { uuid: 'evt-end-2', type: 'scan_end' as const, stationId: 'ai_or_not', clientTs: 31_000 },
    ];

    const res = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ events });

    expect(res.status).toBe(200);

    expect(hub.toOrganizers).toHaveLength(1);
    expect(hub.toOrganizers[0]).toMatchObject({
      event: SOCKET_EVENTS.TEAM_PROGRESS,
      payload: { teamId: 'red_a', stationId: 'ai_or_not', result: 'completed' },
    });

    expect(hub.toTeams).toHaveLength(1);
    expect(hub.toTeams[0]).toMatchObject({
      teamId: 'red_a',
      event: SOCKET_EVENTS.STATE_UPDATE,
      payload: { score: 100, hintsRemaining: data.event.helpHintsPerTeam },
    });
  });

  it('does not emit anything for a batch with no scan_end', async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
    const token = await teamToken(app, 'REDA-2026');

    const events = [
      { uuid: 'evt-start-3', type: 'scan_start' as const, stationId: 'ai_or_not', clientTs: 1_000 },
    ];

    const res = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ events });

    expect(res.status).toBe(200);
    expect(hub.toOrganizers).toHaveLength(0);
    expect(hub.toTeams).toHaveLength(0);
  });

  it('emits exit_logged to organizers for an exit event', async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          {
            uuid: 'evt-exit',
            type: 'exit' as const,
            clientTs: 5_000,
            payload: { leftAt: 1_000, returnedAt: 5_000, awaySec: 4 },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(hub.toOrganizers).toContainEqual({
      event: SOCKET_EVENTS.EXIT_LOGGED,
      payload: { teamId: 'red_a', awaySec: 4, at: 5_000 },
    });
  });

  it('emits an alert to organizers for a help_request event', async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [{ uuid: 'evt-help', type: 'help_request' as const, stationId: 'ai_or_not', clientTs: 6_000 }],
      });

    expect(res.status).toBe(200);
    expect(hub.toOrganizers).toContainEqual({
      event: SOCKET_EVENTS.ALERT,
      payload: expect.objectContaining({ teamId: 'red_a', type: 'help_request', resolved: false }),
    });
  });

  it('emits an alert to organizers and sos_ack to the team for an sos event', async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [{ uuid: 'evt-sos', type: 'sos' as const, clientTs: 7_000, payload: { lat: 34.18, lng: 35.67 } }],
      });

    expect(res.status).toBe(200);
    expect(hub.toOrganizers).toContainEqual({
      event: SOCKET_EVENTS.ALERT,
      payload: expect.objectContaining({ teamId: 'red_a', type: 'sos', lat: 34.18, lng: 35.67, resolved: false }),
    });
    expect(hub.toTeams).toContainEqual({ teamId: 'red_a', event: SOCKET_EVENTS.SOS_ACK, payload: {} });
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
