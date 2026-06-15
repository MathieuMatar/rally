import { createServer } from 'node:http';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import request from 'supertest';
import { SERVER_SCHEMA_SQL, SOCKET_EVENTS } from '@rally/shared';
import { createApp } from '../src/app.js';
import { seedDatabase } from '../src/db/seed.js';
import { createRealtimeHub } from '../src/realtime.js';
import { loadSeedData } from '../src/seedData.js';

describe('realtime hub (real sockets)', () => {
  it('delivers team_progress to organizers and state_update to the team on scan_end', async () => {
    const data = loadSeedData();
    const db = new Database(':memory:');
    db.exec(SERVER_SCHEMA_SQL);
    seedDatabase(db, data);

    const httpServer = createServer();
    const hub = createRealtimeHub(httpServer);
    const app = createApp(db, data, hub);
    httpServer.on('request', app);

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected an AddressInfo from httpServer.address()');
    }
    const url = `http://localhost:${address.port}`;

    const teamRes = await request(app).post('/auth/team').send({ code: 'REDA-2026' });
    const teamToken = teamRes.body.token as string;
    const orgRes = await request(app).post('/auth/organizer').send({ code: 'ORGANIZER-2026' });
    const orgToken = orgRes.body.token as string;

    const teamSocket = ioClient(url, { transports: ['websocket'] });
    const orgSocket = ioClient(url, { transports: ['websocket'] });

    try {
      await Promise.all([
        new Promise<void>((resolve) => teamSocket.on('connect', () => resolve())),
        new Promise<void>((resolve) => orgSocket.on('connect', () => resolve())),
      ]);

      teamSocket.emit(SOCKET_EVENTS.HELLO, { token: teamToken });
      orgSocket.emit(SOCKET_EVENTS.HELLO, { token: orgToken });

      // Give the server a tick to process the `hello` room joins before we sync.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const teamProgress = new Promise((resolve) => orgSocket.once(SOCKET_EVENTS.TEAM_PROGRESS, resolve));
      const stateUpdate = new Promise((resolve) => teamSocket.once(SOCKET_EVENTS.STATE_UPDATE, resolve));

      await request(app)
        .post('/sync')
        .set('Authorization', `Bearer ${teamToken}`)
        .send({
          events: [
            { uuid: 'rt-start', type: 'scan_start', stationId: 'ai_or_not', clientTs: 1_000 },
            { uuid: 'rt-end', type: 'scan_end', stationId: 'ai_or_not', clientTs: 31_000 },
          ],
        });

      await expect(teamProgress).resolves.toMatchObject({
        teamId: 'red_a',
        stationId: 'ai_or_not',
        result: 'completed',
      });
      await expect(stateUpdate).resolves.toMatchObject({ score: 100 });
    } finally {
      teamSocket.disconnect();
      orgSocket.disconnect();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});
