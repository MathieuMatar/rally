/**
 * Delay before the next sync attempt. Successful (or empty) cycles always
 * wait `baseMs` (~15s); consecutive failures back off exponentially up to `maxMs`.
 */
export function getNextSyncDelayMs(consecutiveFailures: number, baseMs = 15_000, maxMs = 5 * 60_000): number {
  if (consecutiveFailures <= 0) return baseMs;
  return Math.min(baseMs * 2 ** consecutiveFailures, maxMs);
}
