import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotPolling, snapshotRefreshInterval } from '../src/view/snapshot-polling';

function setup(visible = true) {
  let now = 0;
  const timers = new Set<{ at: number; callback: () => void }>();
  const requests: { force: boolean; resolve: (interval?: number) => void; reject: (error: Error) => void }[] = [];
  const polling = createSnapshotPolling({
    request: force => new Promise((resolve, reject) => requests.push({ force, resolve, reject })),
    isVisible: () => visible,
    now: () => now,
    schedule: (callback, delayMs) => {
      const timer = { at: now + delayMs, callback };
      timers.add(timer);
      return () => { timers.delete(timer); };
    },
  });
  return {
    polling, requests, timers,
    advance: (elapsed: number) => {
      now += elapsed;
      for (const timer of [...timers]) if (timer.at <= now) { timers.delete(timer); timer.callback(); }
    },
    visibility: (next: boolean) => { visible = next; polling.visibilityChanged(); },
    finish: async (interval?: number) => { requests.at(-1)!.resolve(interval); await Promise.resolve(); },
  };
}

test('frontend intervals have a three-minute floor and reject malformed timer values', () => {
  for (const invalid of [undefined, null, '600000', Number.NaN, Infinity, -1, 0, 300000.5, 2 ** 31]) {
    assert.equal(snapshotRefreshInterval(invalid), 180000);
  }
  assert.equal(snapshotRefreshInterval(15000), 180000);
  assert.equal(snapshotRefreshInterval(180000), 180000);
  assert.equal(snapshotRefreshInterval(300000), 300000);
});

test('first and subsequent responses can extend the polling interval', async () => {
  const state = setup();
  assert.deepEqual(state.requests.map(request => request.force), [false]);
  await state.finish(240000);
  state.advance(180000);
  assert.equal(state.requests.length, 1);
  state.advance(60000);
  assert.equal(state.requests.length, 2);
  await state.finish(360000);
  state.advance(240000);
  assert.equal(state.requests.length, 2);
  state.advance(120000);
  assert.equal(state.requests.length, 3);
  state.polling.stop();
});

test('slow requests never overlap and get a full interval after completion', async () => {
  const state = setup();
  state.advance(900000);
  state.polling.refreshNow();
  state.visibility(false);
  state.visibility(true);
  assert.equal(state.requests.length, 1);
  assert.equal(state.timers.size, 0);
  await state.finish();
  state.advance(179999);
  assert.equal(state.requests.length, 1);
  state.advance(1);
  assert.equal(state.requests.length, 2);
  state.polling.stop();
});

test('hidden tabs suspend timers and returning before or after the due time behaves correctly', async () => {
  const state = setup();
  await state.finish();
  state.advance(60000);
  state.visibility(false);
  assert.equal(state.timers.size, 0);
  state.advance(60000);
  state.visibility(true);
  assert.equal(state.requests.length, 1);
  state.advance(40000);
  state.visibility(false);
  state.advance(80000);
  assert.equal(state.requests.length, 1);
  state.visibility(true);
  state.visibility(true);
  assert.equal(state.requests.length, 2);
  state.visibility(false);
  await state.finish();
  assert.equal(state.timers.size, 0);
  state.polling.stop();
});

test('an initially hidden tab waits until visible; a manual refresh can run immediately', async () => {
  const state = setup(false);
  assert.equal(state.requests.length, 0);
  state.visibility(true);
  assert.equal(state.requests.length, 1);
  await state.finish();
  state.advance(10000);
  state.visibility(false);
  state.polling.refreshNow();
  assert.deepEqual(state.requests.map(request => request.force), [false, true]);
  await state.finish();
  state.visibility(true);
  state.advance(179999);
  assert.equal(state.requests.length, 2);
  state.advance(1);
  assert.equal(state.requests.length, 3);
  state.polling.stop();
});

test('failed requests keep the previous interval instead of retrying continuously', async () => {
  const state = setup();
  await state.finish(300000);
  state.advance(300000);
  state.requests.at(-1)!.reject(new Error('offline'));
  await Promise.resolve();
  state.advance(180000);
  assert.equal(state.requests.length, 2);
  state.advance(120000);
  assert.equal(state.requests.length, 3);
  state.polling.stop();
});

test('stopping a mode prevents pending requests and old timers from scheduling more reads', async () => {
  const oldMode = setup();
  oldMode.polling.stop();
  const newMode = setup();
  await oldMode.finish(600000);
  oldMode.advance(900000);
  oldMode.visibility(false);
  oldMode.visibility(true);
  oldMode.polling.refreshNow();
  assert.equal(oldMode.requests.length, 1);
  assert.equal(oldMode.timers.size, 0);
  await newMode.finish();
  assert.equal(newMode.timers.size, 1);
  newMode.polling.stop();
  newMode.advance(900000);
  assert.equal(newMode.requests.length, 1);
  assert.equal(newMode.timers.size, 0);
});
