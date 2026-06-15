import { describe, expect, it } from 'vitest';
import { getNextSyncDelayMs } from './syncBackoff';

describe('getNextSyncDelayMs', () => {
  it('waits the base interval after a successful or empty cycle', () => {
    expect(getNextSyncDelayMs(0)).toBe(15_000);
  });

  it('doubles the delay for each consecutive failure', () => {
    expect(getNextSyncDelayMs(1)).toBe(30_000);
    expect(getNextSyncDelayMs(2)).toBe(60_000);
    expect(getNextSyncDelayMs(3)).toBe(120_000);
  });

  it('caps the delay at maxMs', () => {
    expect(getNextSyncDelayMs(10, 15_000, 5 * 60_000)).toBe(5 * 60_000);
  });
});
