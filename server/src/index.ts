import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { openDb } from './db/index.js';
import { createRealtimeHub } from './realtime.js';
import { loadSeedData } from './seedData.js';

const db = openDb(config.dbPath);
const seedData = loadSeedData();

const httpServer = createServer();
const hub = createRealtimeHub(httpServer);
const app = createApp(db, seedData, hub);
httpServer.on('request', app);

httpServer.listen(config.port, () => {
  console.log(`Rally server listening on port ${config.port}`);
});
