import { createApp } from './app.js';
import { config } from './config.js';
import { openDb } from './db/index.js';
import { loadSeedData } from './seedData.js';

const db = openDb(config.dbPath);
const seedData = loadSeedData();
const app = createApp(db, seedData);

app.listen(config.port, () => {
  console.log(`Rally server listening on port ${config.port}`);
});
