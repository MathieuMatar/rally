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

describe('POST /admin/score', () => {
  it('rejects a team token', async () => {
    const { app } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app)
      .post('/admin/score')
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId: 'red_a', stationId: 'ai_or_not', points: 100 });

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown team', async () => {
    const { app } = buildTestApp(data);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    const res = await request(app)
      .post('/admin/score')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ teamId: 'nope', stationId: 'ai_or_not', points: 100 });

    expect(res.status).toBe(404);
  });

  it("overwrites a station's points and recomputes the team score, reordering the scoreboard", async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
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
    const res = await request(app)
      .post('/admin/score')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ teamId: 'red_a', stationId: 'ai_or_not', points: 250 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ score: 250, points: 250 });

    expect(hub.toTeams).toContainEqual({
      teamId: 'red_a',
      event: SOCKET_EVENTS.STATE_UPDATE,
      payload: { score: 250, hintsRemaining: data.event.helpHintsPerTeam },
    });
    expect(hub.toOrganizers).toContainEqual(
      expect.objectContaining({ event: SOCKET_EVENTS.TEAM_PROGRESS, payload: expect.objectContaining({ teamId: 'red_a', stationId: 'ai_or_not' }) }),
    );

    const teams = await request(app).get('/admin/teams').set('Authorization', `Bearer ${orgToken}`);
    const redA = teams.body.find((t: { team: { id: string } }) => t.team.id === 'red_a');
    expect(redA.score).toBe(250);
    expect(redA.progress.find((p: { stationId: string }) => p.stationId === 'ai_or_not').points).toBe(250);
  });

  it('sets points for a station the team has not started yet', async () => {
    const { app } = buildTestApp(data);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    const res = await request(app)
      .post('/admin/score')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ teamId: 'red_a', stationId: 'puzzle', points: 50 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ score: 50, points: 50 });
  });
});

describe('POST /admin/broadcast', () => {
  it('rejects a team token', async () => {
    const { app } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app)
      .post('/admin/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({ target: 'red_a', message: 'hi' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown team target', async () => {
    const { app } = buildTestApp(data);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    const res = await request(app)
      .post('/admin/broadcast')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ target: 'nope', message: 'hi' });

    expect(res.status).toBe(404);
  });

  it('emits broadcast to a single targeted team and stores it for /state', async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    const res = await request(app)
      .post('/admin/broadcast')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ target: 'red_a', message: 'Water station moved to the square' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(hub.toTeams).toEqual([
      {
        teamId: 'red_a',
        event: SOCKET_EVENTS.BROADCAST,
        payload: { message: 'Water station moved to the square', at: expect.any(Number) },
      },
    ]);

    const teamToken_ = await teamToken(app, 'REDA-2026');
    const state = await request(app).get('/state').set('Authorization', `Bearer ${teamToken_}`);
    expect(state.body.broadcasts).toEqual([
      { message: 'Water station moved to the square', at: expect.any(Number) },
    ]);
  });

  it("emits broadcast to every team when target is 'all'", async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    const res = await request(app)
      .post('/admin/broadcast')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ target: 'all', message: '15 minutes left!' });

    expect(res.status).toBe(200);
    expect(hub.toTeams).toHaveLength(data.teams.length);
    expect(hub.toTeams).toContainEqual({
      teamId: 'red_a',
      event: SOCKET_EVENTS.BROADCAST,
      payload: { message: '15 minutes left!', at: expect.any(Number) },
    });
    expect(hub.toTeams).toContainEqual({
      teamId: 'blue_a',
      event: SOCKET_EVENTS.BROADCAST,
      payload: { message: '15 minutes left!', at: expect.any(Number) },
    });
  });
});

describe('POST /admin/clue', () => {
  it('rejects a team token', async () => {
    const { app } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app)
      .post('/admin/clue')
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId: 'red_a', text: 'Check behind the fountain' });

    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown team', async () => {
    const { app } = buildTestApp(data);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    const res = await request(app)
      .post('/admin/clue')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ teamId: 'nope', text: 'Check behind the fountain' });

    expect(res.status).toBe(404);
  });

  it('stores the override, emits clue_override to the team, and the phone picks it up via /state', async () => {
    const hub = new FakeRealtimeHub();
    const { app } = buildTestApp(data, hub);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    const res = await request(app)
      .post('/admin/clue')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ teamId: 'red_a', text: 'Check behind the fountain' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(hub.toTeams).toEqual([
      { teamId: 'red_a', event: SOCKET_EVENTS.CLUE_OVERRIDE, payload: { text: 'Check behind the fountain' } },
    ]);

    const teamToken_ = await teamToken(app, 'REDA-2026');
    const state = await request(app).get('/state').set('Authorization', `Bearer ${teamToken_}`);
    expect(state.body.clueOverride).toBe('Check behind the fountain');
  });

  it('replaces a previous override for the same team', async () => {
    const { app } = buildTestApp(data);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    await request(app)
      .post('/admin/clue')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ teamId: 'red_a', text: 'First hint' });
    await request(app)
      .post('/admin/clue')
      .set('Authorization', `Bearer ${orgToken}`)
      .send({ teamId: 'red_a', text: 'Second hint' });

    const teamToken_ = await teamToken(app, 'REDA-2026');
    const state = await request(app).get('/state').set('Authorization', `Bearer ${teamToken_}`);
    expect(state.body.clueOverride).toBe('Second hint');
  });
});

describe('GET /admin/alerts and POST /admin/alerts/:id/resolve', () => {
  it('rejects a team token', async () => {
    const { app } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app).get('/admin/alerts').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('lists open alerts and lets organizers resolve them', async () => {
    const { app } = buildTestApp(data);
    const teamToken_ = await teamToken(app, 'REDA-2026');
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${teamToken_}`)
      .send({
        events: [{ uuid: 'evt-help', type: 'help_request', stationId: 'ai_or_not', clientTs: 6_000 }],
      });

    const listRes = await request(app).get('/admin/alerts').set('Authorization', `Bearer ${orgToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0]).toMatchObject({ teamId: 'red_a', type: 'help_request', resolved: false });

    const alertId = listRes.body[0].id as number;
    const resolveRes = await request(app)
      .post(`/admin/alerts/${alertId}/resolve`)
      .set('Authorization', `Bearer ${orgToken}`);
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body).toEqual({ ok: true });

    const afterRes = await request(app).get('/admin/alerts').set('Authorization', `Bearer ${orgToken}`);
    expect(afterRes.body).toEqual([]);
  });

  it('returns 404 when resolving an unknown alert', async () => {
    const { app } = buildTestApp(data);
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    const res = await request(app).post('/admin/alerts/999/resolve').set('Authorization', `Bearer ${orgToken}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /admin/export', () => {
  it('rejects a team token', async () => {
    const { app } = buildTestApp(data);
    const token = await teamToken(app, 'REDA-2026');

    const res = await request(app).get('/admin/export').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns a CSV with every team and per-station durations', async () => {
    const { app } = buildTestApp(data);
    const teamToken_ = await teamToken(app, 'REDA-2026');
    const orgToken = await organizerToken(app, 'ORGANIZER-2026');

    await request(app)
      .post('/sync')
      .set('Authorization', `Bearer ${teamToken_}`)
      .send({
        events: [
          { uuid: 'evt-start', type: 'scan_start', stationId: 'ai_or_not', clientTs: 1_000 },
          { uuid: 'evt-end', type: 'scan_end', stationId: 'ai_or_not', clientTs: 31_000 },
        ],
      });

    const res = await request(app).get('/admin/export').set('Authorization', `Bearer ${orgToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe(
      'team_id,team_name,score,hints_remaining,exits_count,total_away_sec,station_id,started_at,ended_at,duration_sec,points,result',
    );
    expect(lines.length).toBe(data.teams.length + 1);
    const redARow = lines.find((line) => line.startsWith('red_a,'));
    expect(redARow).toContain('ai_or_not');
    expect(redARow).toContain('100'); // ai_or_not basePoints
  });
});
