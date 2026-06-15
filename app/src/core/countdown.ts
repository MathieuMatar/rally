export interface Countdown {
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
  isOver: boolean;
}

/** Overall event countdown, derived from event_start_iso + duration — never from the network. */
export function getCountdown(
  eventStartIso: string,
  durationMinutes: number,
  now: number = Date.now(),
): Countdown {
  const startMs = new Date(eventStartIso).getTime();
  const totalMs = durationMinutes * 60_000;
  const endMs = startMs + totalMs;
  const elapsedMs = Math.max(0, now - startMs);
  const remainingMs = Math.min(totalMs, Math.max(0, endMs - now));

  return { totalMs, elapsedMs, remainingMs, isOver: now >= endMs };
}

/** Formats milliseconds as H:MM:SS (or M:SS under an hour). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}
