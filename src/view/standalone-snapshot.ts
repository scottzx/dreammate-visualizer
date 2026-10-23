import { createDemoSnapshot } from '../observer/demo';
import type { ObserverSnapshot } from '../read-model/types';

/**
 * Static builds have no observer process, so the isolated demo scenario is
 * generated in the browser. Timestamps are relative to "now", which keeps the
 * same 3-minute voyage cycle as the backend's `/api/snapshot?mode=demo`.
 */
export function standaloneDemoSnapshot(now: Date = new Date()): ObserverSnapshot {
  return createDemoSnapshot(now);
}
