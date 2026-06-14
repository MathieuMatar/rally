import { describe, expect, it } from 'vitest';
import { buildCode, parseCode } from './qr';

describe('parseCode', () => {
  it('parses a valid START code', () => {
    expect(parseCode('RALLY:puzzle:START')).toEqual({ stationId: 'puzzle', kind: 'START' });
  });

  it('parses a valid END code', () => {
    expect(parseCode('RALLY:build:END')).toEqual({ stationId: 'build', kind: 'END' });
  });

  it('rejects malformed codes', () => {
    expect(parseCode('garbage')).toBeNull();
    expect(parseCode('RALLY:puzzle:MIDDLE')).toBeNull();
    expect(parseCode('RALLY::START')).toBeNull();
    expect(parseCode('NOTRALLY:puzzle:START')).toBeNull();
    expect(parseCode('RALLY:puzzle:START:extra')).toBeNull();
  });
});

describe('buildCode', () => {
  it('round-trips with parseCode', () => {
    const code = buildCode('cipher', 'END');
    expect(code).toBe('RALLY:cipher:END');
    expect(parseCode(code)).toEqual({ stationId: 'cipher', kind: 'END' });
  });
});
