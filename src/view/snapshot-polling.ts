export const MINIMUM_REFRESH_INTERVAL_MS = 180_000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;

export function snapshotRefreshInterval(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_TIMER_DELAY_MS
    ? Math.max(MINIMUM_REFRESH_INTERVAL_MS, value) : MINIMUM_REFRESH_INTERVAL_MS;
}

interface SnapshotPollingOptions {
  request: (force: boolean) => Promise<number | undefined>;
  isVisible: () => boolean;
  now?: () => number;
  schedule?: (callback: () => void, delayMs: number) => () => void;
}

/** One request at a time; a slow request gets its full interval after completion. */
export function createSnapshotPolling({ request, isVisible, now = Date.now, schedule = (callback, delayMs) => {
  const timer = setTimeout(callback, delayMs);
  return () => clearTimeout(timer);
} }: SnapshotPollingOptions) {
  let intervalMs = MINIMUM_REFRESH_INTERVAL_MS;
  let nextDueAt = now();
  let pending = false;
  let stopped = false;
  let cancelTimer: (() => void) | undefined;

  function clearTimer() { cancelTimer?.(); cancelTimer = undefined; }

  function scheduleNext() {
    clearTimer();
    if (stopped || pending || !isVisible()) return;
    const delay = Math.max(0, nextDueAt - now());
    if (!delay) void load(false);
    else cancelTimer = schedule(() => { cancelTimer = undefined; scheduleNext(); }, delay);
  }

  async function load(force: boolean) {
    if (stopped || pending) return;
    clearTimer();
    pending = true;
    try {
      const advertisedInterval = await request(force);
      if (advertisedInterval !== undefined) intervalMs = snapshotRefreshInterval(advertisedInterval);
    } catch {
      // The caller reports request errors; failures still wait before retrying.
    } finally {
      pending = false;
      nextDueAt = now() + intervalMs;
      scheduleNext();
    }
  }

  scheduleNext();
  return {
    refreshNow: () => { void load(true); },
    visibilityChanged: scheduleNext,
    stop: () => { stopped = true; clearTimer(); },
  };
}
