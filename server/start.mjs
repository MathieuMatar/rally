// Production entrypoint for hosts (e.g. cPanel Node Selector) that run `node <startup file>`
// directly and can't set NODE_OPTIONS=--import tsx without also affecting npm itself.
// Registers tsx's ESM loader programmatically, then runs the real TypeScript entrypoint.
import { register } from 'tsx/esm/api';

register();
// No top-level await: hosts like Passenger `require()` this file, which fails on
// ESM graphs containing top-level await (ERR_REQUIRE_ASYNC_MODULE).
import('./src/index.ts');
