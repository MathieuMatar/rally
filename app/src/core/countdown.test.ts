import { describe, expect, it } from 'vitest';
import { formatDuration, getCountdown } from './countdown';

describe('getCountdown', () => {
  const eventStartIso = '2026-07-01T16:00:00+03:00';
  const durationMinutes = 210; // 3h30m
  const startMs = new Date(eventStartIso).getTime();

  it('reports the full duration before the event starts', () => {
    const c = getCountdown(eventStartIso, durationMinutes, startMs - 60_000);
    expect(c.remainingMs).toBe(durationMinutes * 60_000);
    expect(c.elapsedMs).toBe(0);
    expect(c.isOver).toBe(false);
  });

  it('counts down during the event', () => {
    const now = startMs + 30 * 60_000; // 30 minutes in
    const c = getCountdown(eventStartIso, durationMinutes, now);
    expect(c.elapsedMs).toBe(30 * 60_000);
    expect(c.remainingMs).toBe(180 * 60_000);
    expect(c.isOver).toBe(false);
  });

  it('clamps to zero and reports isOver once the duration elapses', () => {
    const now = startMs + (durationMinutes + 10) * 60_000;
    const c = getCountdown(eventStartIso, durationMinutes, now);
    expect(c.remainingMs).toBe(0);
    expect(c.isOver).toBe(true);
  });
});

describe('formatDuration', () => {
  it('formats sub-hour durations as M:SS', () => {
    expect(formatDuration(5_000)).toBe('0:05');
    expect(formatDuration(65_000)).toBe('1:05');
  });

  it('formats durations over an hour as H:MM:SS', () => {
    expect(formatDuration(3_661_000)).toBe('1:01:01');
  });
});
