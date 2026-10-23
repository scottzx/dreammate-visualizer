import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniverseLayout, type UniversePlot } from '../src/view/universe-layout';
import { advanceOrbitTime, orbitAngularSpeed, orbitInclination, orbitPosition, orbitRingPoint, ORBIT_CENTER_Y } from '../src/view/universe-motion';

const near = (actual: number, expected: number, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance,
  `Expected ${actual} to be within ${tolerance} of ${expected}`);

test('planetary revolution preserves distance in a tilted 3D orbital plane', () => {
  const layout = createUniverseLayout(['mac', ...Array.from({ length: 20 }, (_, i) => `planet:${i}`)]);
  for (const plot of layout.plots.values()) {
    for (let time = 0; time <= 600; time += 15) {
      const [x, y, z] = orbitPosition(plot, time);
      near(Math.hypot(x, y - ORBIT_CENTER_Y, z), plot.orbitRadius);
      near(y - ORBIT_CENTER_Y, z * Math.tan(orbitInclination()));
    }
  }
  const highPoint = orbitRingPoint(10, Math.PI / 2);
  assert.ok(highPoint[1] > ORBIT_CENTER_Y + 1);
});

test('the DERP hub stays fixed while the equal-spaced device ring revolves around it', () => {
  const layout = createUniverseLayout(['relay', 'mac', 'phone', 'pc'], [], 'relay');
  for (const time of [0, 10, 100, 1e12]) assert.deepEqual(orbitPosition(layout.plots.get('relay')!, time), [0, ORBIT_CENTER_Y, 0]);
  for (const id of ['mac', 'phone', 'pc']) {
    const plot = layout.plots.get(id)!;
    assert.notDeepEqual(orbitPosition(plot, 0), orbitPosition(plot, 10));
    const [x, y, z] = orbitPosition(plot, 10);
    near(Math.hypot(x, y - ORBIT_CENTER_Y, z), layout.radius);
  }
});

test('all devices including the former Mac centre revolve clockwise at the same angular speed', () => {
  const layout = createUniverseLayout(['mac', 'second', 'third', 'device']);
  const elapsed = 60;
  for (const plot of layout.plots.values()) {
    const initial = orbitPosition(plot, 0);
    const next = orbitPosition(plot, elapsed);
    const phase = (position: number[]) => Math.atan2(position[2] / Math.cos(orbitInclination()), position[0]);
    const turn = (phase(next) - phase(initial) + 2 * Math.PI) % (2 * Math.PI);
    near(turn, elapsed * orbitAngularSpeed());
    // Viewed from +Y with +X right and +Z down, positive phase turns clockwise.
    assert.ok(initial[0] * next[2] - initial[2] * next[0] > 0);
  }
});

test('slot phases stay deterministic across snapshot ordering and returning devices', () => {
  const ids = ['mac', 'phone', 'server', 'workstation'];
  const original = createUniverseLayout(ids);
  const reversed = createUniverseLayout([...ids].reverse(), original.assignments);
  const partial = createUniverseLayout(['mac', 'phone'], original.assignments);
  const returned = createUniverseLayout(ids, partial.assignments);
  for (const id of ids) {
    const plot = original.plots.get(id)!;
    assert.deepEqual(orbitPosition(plot, 57), orbitPosition(reversed.plots.get(id)!, 57));
    assert.deepEqual(orbitPosition(plot, 57), orbitPosition(returned.plots.get(id)!, 57));
    assert.deepEqual(orbitPosition(plot, 0), orbitRingPoint(plot.orbitRadius, Math.atan2(plot.z, plot.x)));
  }
});

test('the shared orbit clock preserves equal neighbour distances through a full revolution', () => {
  const plots = [...createUniverseLayout(Array.from({ length: 13 }, (_, i) => String(i))).plots.values()];
  const distance = (a: number[], b: number[]) => Math.hypot(...a.map((value, i) => value - b[i]));
  const expected = distance(orbitPosition(plots[0], 0), orbitPosition(plots[1], 0));
  for (const time of [0, 15, 100, 2 * Math.PI / orbitAngularSpeed(), 1e12]) {
    for (let index = 0; index < plots.length; index++) {
      near(distance(orbitPosition(plots[index], time), orbitPosition(plots[(index + 1) % plots.length], time)), expected);
    }
  }
});

test('pause and reduced-motion freeze the shared clock without resuming elapsed wall time', () => {
  let time = advanceOrbitTime(0, 0.016, true);
  near(time, 0.016);
  for (let i = 0; i < 120; i += 1) time = advanceOrbitTime(time, 1, false);
  near(time, 0.016);
  time = advanceOrbitTime(time, 60 * 60, true);
  near(time, 0.116);
  near(advanceOrbitTime(time, 0.016, true), 0.132);
});

test('invalid deltas and malformed numeric fields cannot poison the orbital clock or coordinates', () => {
  for (const delta of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0]) {
    assert.equal(advanceOrbitTime(10, delta, true), 10);
  }
  assert.equal(advanceOrbitTime(Number.NaN, 0.02, false), 0);
  assert.equal(advanceOrbitTime(-10, 0.02, true), 0.02);
  assert.ok(Number.isFinite(advanceOrbitTime(Number.MAX_VALUE, Number.MAX_VALUE, true)));
  const plot: UniversePlot = { id: 'invalid', slot: 1, x: Number.NaN, y: Number.NaN,
    z: Number.POSITIVE_INFINITY, orbitRadius: Number.NEGATIVE_INFINITY };
  for (const seconds of [Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE, -Number.MAX_VALUE]) {
    assert.ok(orbitPosition(plot, seconds).every(Number.isFinite));
    assert.ok(orbitPosition({ ...plot, x: 10, z: 2, orbitRadius: 12 }, seconds).every(Number.isFinite));
  }
  assert.ok(orbitRingPoint(Number.NaN, Number.NaN).every(Number.isFinite));
});
