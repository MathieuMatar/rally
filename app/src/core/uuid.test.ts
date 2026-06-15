import { describe, expect, it } from 'vitest';
import { generateUuid } from './uuid';

describe('generateUuid', () => {
  it('produces RFC4122 v4-shaped ids', () => {
    const id = generateUuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('produces unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateUuid()));
    expect(ids.size).toBe(1000);
  });
});
