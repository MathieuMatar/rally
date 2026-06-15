import type { StateResponse } from '@rally/shared';
import { syncEvents } from '../api/client';
import { getNextSyncDelayMs } from '../core/syncBackoff';
import { getOutboxBatch, incrementTries, removeFromOutbox } from '../db/outbox';
import { getSetting } from '../db/settings';

const BASE_INTERVAL_MS = 15_000;

/**
 * Drains the local outbox to `/sync` every ~15s (or sooner via `triggerNow`),
 * backing off exponentially on failure. Never blocks the UI thread — every
 * cycle is scheduled with `setTimeout` and runs to completion before the next
 * is scheduled.
 */
export class SyncWorker {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveFailures = 0;
  private running = false;
  private cycleInFlight = false;

  constructor(private readonly onStateUpdate: (state: StateResponse) => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Call after enqueueing a new event, or when connectivity is restored. */
  triggerNow(): void {
    if (!this.running || this.cycleInFlight) return;
    if (this.timer) clearTimeout(this.timer);
    this.scheduleNext(0);
  }

  private scheduleNext(delayMs: number): void {
    this.timer = setTimeout(() => {
      void this.runCycle();
    }, delayMs);
  }

  private async runCycle(): Promise<void> {
    if (!this.running) return;
    this.cycleInFlight = true;

    try {
      const batch = getOutboxBatch();
      if (batch.length === 0) {
        this.consecutiveFailures = 0;
        return;
      }

      const token = getSetting('token');
      const serverUrl = getSetting('server_url');
      if (!token || !serverUrl) {
        return;
      }

      try {
        const response = await syncEvents(serverUrl, token, batch);
        removeFromOutbox(response.accepted);
        this.consecutiveFailures = 0;
        this.onStateUpdate(response.state);
      } catch {
        incrementTries(batch.map((event) => event.uuid));
        this.consecutiveFailures += 1;
      }
    } finally {
      this.cycleInFlight = false;
      if (this.running) {
        this.scheduleNext(getNextSyncDelayMs(this.consecutiveFailures, BASE_INTERVAL_MS));
      }
    }
  }
}
