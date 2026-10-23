import test from 'node:test';
import assert from 'node:assert/strict';
import { voyageMotion } from '../src/read-model/voyages';
import {
  VOYAGE_BERTH_RADIUS_FACTOR, VOYAGE_BOW_MAX, VOYAGE_DESTINATION_ORBIT_FACTOR, VOYAGE_LIFT_MAX, VOYAGE_LIFT_MIN,
  VOYAGE_MAX_FRAME_SECONDS, VOYAGE_OUTER_RING_FACTOR, VOYAGE_PALETTE, VOYAGE_SAMPLES_PER_LEG, VOYAGE_SHIP_LENGTH_FACTOR,
  VOYAGE_SHIP_MODEL_LENGTH, advanceVoyageElapsed, voyageAngle, voyageBerthPoint, voyageBow, voyageColor, voyageDockIndex,
  voyageElapsedFromCycleStart, voyageHasError, voyageLateral, voyageLegPoint, voyageLift, voyageOrbitAngle, voyageOrbitPoint,
  voyageOrbitTangent, voyageOuterDockPoint, voyagePoseAt, voyageRouteSamples, voyageShipScale, voyageUnit,
  writeVoyageLegPoint, writeVoyageOrbitPoint,
} from '../src/view/voyage-motion';

const TAU = Math.PI * 2;
const CYCLE = 100_000;
const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
const pointOf = (waypoint: { x: number; y: number; z: number }) => [waypoint.x, waypoint.y, waypoint.z];
const waypoints = (values: readonly [number, number, number][]) => values.map(([x, y, z]) => ({ x, y, z }));

test('stable angles, accents, and colours do not depend on array order', () => {
  const ids = ['demo:project:alpha', 'demo:project:beta', 'demo:project:gamma', 'demo:project:delta'];
  const forward = new Map(ids.map((id) => [id, voyageAngle(id, 'berth')]));
  const backward = new Map([...ids].reverse().map((id) => [id, voyageAngle(id, 'berth')]));
  for (const id of ids) {
    assert.equal(forward.get(id), backward.get(id));
    assert.equal(voyageAngle(id, 'berth'), voyageAngle(id, 'berth'));
    const angle = voyageAngle(id, 'berth');
    assert.ok(angle >= 0 && angle < TAU);
    assert.ok(voyageUnit(id, 'berth') >= 0 && voyageUnit(id, 'berth') < 1);
    for (let leg = 0; leg < 5; leg += 1) {
      const lift = voyageLift(id, leg);
      assert.ok(lift >= VOYAGE_LIFT_MIN && lift <= VOYAGE_LIFT_MAX);
      assert.equal(lift, voyageLift(id, leg));
    }
    assert.ok(Math.abs(voyageBow(id)) <= VOYAGE_BOW_MAX);
    assert.ok(Math.abs(voyageLateral(id)) <= 0.5);
  }
  assert.equal(new Set(forward.values()).size, ids.length);
  assert.equal(voyageColor('session'), VOYAGE_PALETTE.session);
  assert.equal(voyageColor('acp'), VOYAGE_PALETTE.acp);
  assert.equal(voyageColor('acp', true), VOYAGE_PALETTE.error);
  assert.equal(voyageHasError([{ status: 'ok' }, { status: 'error' }]), true);
  assert.equal(voyageHasError([{ status: 'ok' }, { status: 'unknown' }]), false);
});

test('a voyage without MCP stops stays at its berth for the whole cycle', () => {
  const origin = { x: 2, y: 0.3, z: -1 };
  for (const elapsed of [0, CYCLE * 0.5, CYCLE, CYCLE * 2, -10, Number.NaN]) {
    const pose = voyagePoseAt([origin], elapsed, CYCLE);
    const motion = voyageMotion(0, elapsed, CYCLE);
    assert.equal(pose.phase, motion.phase);
    assert.equal(pose.phase, 'origin');
    assert.equal(pose.leg, motion.leg);
    assert.equal(pose.t, motion.t);
    assert.deepEqual([pose.x, pose.y, pose.z], [origin.x, origin.y, origin.z]);
    assert.equal(pose.targetIndex, -1);
  }
  assert.equal(voyageRouteSamples(0), 0);
});

test('one stop departs, travels along the lifted curve, then parks at the last stop', () => {
  const origin = { x: 0, y: 0.3, z: 0 };
  const stop = { x: 20, y: 0.3, z: 8 };
  const route = [origin, stop];
  const lifts = [3], bow = 0.6;

  const depart = voyagePoseAt(route, CYCLE * 0.02, CYCLE, lifts, bow);
  assert.equal(depart.phase, 'depart');
  assert.equal(depart.leg, 0);
  assert.equal(depart.t, 0);
  assert.deepEqual([depart.x, depart.y, depart.z], [origin.x, origin.y, origin.z]);

  const travel = voyagePoseAt(route, CYCLE * 0.34, CYCLE, lifts, bow);
  assert.equal(travel.phase, 'travel');
  assert.equal(travel.leg, 0);
  near(travel.t, 0.5, 1e-9);
  assert.ok(travel.y > (origin.y + stop.y) / 2, 'the sampled curve must rise above the straight line');
  assert.deepEqual(voyageMotion(1, CYCLE * 0.34, CYCLE), { phase: travel.phase, leg: travel.leg, t: travel.t, progress: travel.progress });

  for (const elapsed of [CYCLE * 0.64, CYCLE, CYCLE * 5]) {
    const arrived = voyagePoseAt(route, elapsed, CYCLE, lifts, bow);
    assert.equal(arrived.phase, 'arrived');
    assert.equal(arrived.t, 1);
    assert.equal(arrived.leg, 1);
    assert.deepEqual([arrived.x, arrived.y, arrived.z], pointOf(stop));
    assert.equal(arrived.targetIndex, -1);
  }

  // Endpoints are exact and invalid interpolation parameters are clamped.
  assert.deepEqual(voyageLegPoint(origin, stop, -4, 3, bow), pointOf(origin));
  assert.deepEqual(voyageLegPoint(origin, stop, 4, 3, bow), pointOf(stop));
  assert.deepEqual(voyageLegPoint(origin, stop, Number.NaN, 3, bow), pointOf(origin));
  const mid = voyageLegPoint(origin, stop, 0.5, 3, bow);
  assert.ok(mid[1] > (origin.y + stop.y) / 2);
});

test('multiple stops dock exactly at each stop and arrive at the final one', () => {
  const route = waypoints([[0, 0.3, 0], [18, 0.4, 10], [-22, 0.2, 6], [8, 0.3, -25]]);
  const lifts = [2, 3.2, 1.7], bow = -0.4;
  const cases = [
    { progress: 0.14, phase: 'travel', leg: 0 },
    { progress: 0.255, phase: 'dock', leg: 1 },
    { progress: 0.32, phase: 'travel', leg: 1 },
    { progress: 0.485, phase: 'dock', leg: 2 },
  ] as const;
  for (const sample of cases) {
    const pose = voyagePoseAt(route, CYCLE * sample.progress, CYCLE, lifts, bow);
    const motion = voyageMotion(3, CYCLE * sample.progress, CYCLE);
    assert.equal(pose.phase, sample.phase, `at ${sample.progress}`);
    assert.equal(pose.leg, sample.leg);
    assert.deepEqual({ phase: pose.phase, leg: pose.leg, t: pose.t, progress: pose.progress }, motion);
    assert.ok(pose.t >= 0 && pose.t <= 1);
    if (sample.phase === 'dock') {
      assert.deepEqual([pose.x, pose.y, pose.z], pointOf(route[sample.leg]));
      assert.equal(voyageDockIndex(pose, 3), sample.leg);
    }
  }
  const arrived = voyagePoseAt(route, CYCLE * 0.8, CYCLE, lifts, bow);
  assert.equal(arrived.phase, 'arrived');
  assert.deepEqual([arrived.x, arrived.y, arrived.z], pointOf(route.at(-1)!));
  assert.equal(voyageDockIndex(arrived, 3), 3);
  assert.equal(voyageDockIndex(voyagePoseAt(route, CYCLE * 0.14, CYCLE, lifts, bow), 3), -1);
});

test('the motion wrapper agrees with read-model voyageMotion for every stop count', () => {
  const elapsedFractions = [-0.5, 0, 0.01, 0.04, 0.05, 0.1, 0.25, 0.5, 0.7, 0.9, 0.999, 1, 1.5];
  for (let stopCount = 0; stopCount <= 4; stopCount += 1) {
    const route = waypoints(Array.from({ length: stopCount + 1 }, (_, index) => [index * 9, 0.3, index % 2 === 0 ? 5 : -5]));
    assert.ok(VOYAGE_SAMPLES_PER_LEG >= 10 && VOYAGE_SAMPLES_PER_LEG <= 14);
    assert.equal(voyageRouteSamples(stopCount), stopCount * VOYAGE_SAMPLES_PER_LEG);
    for (const fraction of elapsedFractions) {
      for (const cycle of [CYCLE, 180_000, 0, Number.NaN]) {
        const elapsed = fraction * (Number.isFinite(cycle) && cycle > 0 ? cycle : 180_000);
        const pose = voyagePoseAt(route, elapsed, cycle);
        const motion = voyageMotion(stopCount, elapsed, cycle);
        assert.equal(pose.phase, motion.phase);
        assert.equal(pose.leg, motion.leg);
        assert.equal(pose.t, motion.t);
        assert.equal(pose.progress, motion.progress);
        assert.ok(pose.t >= 0 && pose.t <= 1);
        assert.ok(Number.isFinite(pose.x) && Number.isFinite(pose.y) && Number.isFinite(pose.z));
      }
    }
  }
});

test('berth and unresolved docks use stable hashed angles on their rings', () => {
  const center = { x: 5, y: 0.3, z: -2 };
  const angle = voyageAngle('demo:project:alpha', 'berth');
  const radius = voyageBerthPoint(center, 4.8, angle, 0);
  near(Math.hypot(radius[0] - center.x, radius[2] - center.z), 4.8);
  const left = voyageBerthPoint(center, 4.8, angle, -0.5);
  const right = voyageBerthPoint(center, 4.8, angle, 0.5);
  assert.notDeepEqual(left, right);
  assert.deepEqual(voyageBerthPoint(center, 4.8, angle, 0.25), voyageBerthPoint(center, 4.8, angle, 0.25));
  assert.deepEqual(voyageBerthPoint(center, -10, angle, 0), [center.x, center.y, center.z]);

  const dock = voyageOuterDockPoint(40, 'voyage/stop/1');
  near(Math.hypot(dock[0], dock[2]), 40 * VOYAGE_OUTER_RING_FACTOR);
  assert.deepEqual(dock, voyageOuterDockPoint(40, 'voyage/stop/1'));
  assert.notDeepEqual(dock, voyageOuterDockPoint(40, 'voyage/stop/2'));
});

test('cycle clock initialises from the snapshot and freezes without a render-loop clock', () => {
  const start = new Date(1_000_000).toISOString();
  assert.equal(voyageElapsedFromCycleStart(start, 1_030_000, 180_000), 30_000);
  assert.equal(voyageElapsedFromCycleStart(start, 980_000, 180_000), 0, 'a future cycle start begins at the berth');
  assert.equal(voyageElapsedFromCycleStart(start, 1_000_000 + 400_000, 180_000), 180_000, 'an old cycle is clamped to the end');
  assert.equal(voyageElapsedFromCycleStart('not-a-date', 1_030_000, 180_000), 0);
  assert.equal(voyageElapsedFromCycleStart(start, 1_030_000, 0), 30_000);

  assert.equal(advanceVoyageElapsed(42_000, 10, 180_000, false), 42_000, 'paused ships must not drift');
  assert.equal(advanceVoyageElapsed(42_000, 0.05, 180_000, true), 42_050);
  assert.equal(advanceVoyageElapsed(42_000, 10, 180_000, true), 42_000 + VOYAGE_MAX_FRAME_SECONDS * 1000,
    'a suspended tab cannot advance the voyage by an entire inactive period');
  assert.equal(advanceVoyageElapsed(179_990, 1, 180_000, true), 180_000, 'the ship stops at the destination');
  assert.equal(advanceVoyageElapsed(Number.NaN, 1, 180_000, true), 100);
  assert.equal(advanceVoyageElapsed(-50, 1, 180_000, true), 100);
});

test('the berth radius factor leaves room outside the origin planet', () => {
  assert.ok(VOYAGE_BERTH_RADIUS_FACTOR > 1);
  const write = { x: -1, y: -1, z: -1 };
  writeVoyageLegPoint(write, { x: 1, y: 2, z: 3 }, { x: 4, y: 6, z: 8 }, 0.5, 2);
  assert.ok(write.y > 4);
  assert.ok(write.x > 1 && write.x < 4);
  assert.ok(write.z > 3 && write.z < 8);
});

test('voyage ships are much smaller than the capability ring and keep orbiting the destination', () => {
  for (const radius of [1, 2]) {
    const length = voyageShipScale(radius) * VOYAGE_SHIP_MODEL_LENGTH;
    near(length, radius * VOYAGE_SHIP_LENGTH_FACTOR);
    assert.ok(length < radius * 1.14, 'the hull stays smaller than the skill ring radius');
    assert.ok(length > radius * 0.2, 'the hull is still larger than a skill star point');
  }
  assert.ok(VOYAGE_SHIP_MODEL_LENGTH * voyageShipScale(4) <= 1.2, 'largest planets use the capped hull scale');
  assert.ok(VOYAGE_SHIP_LENGTH_FACTOR > 0.2 && VOYAGE_SHIP_LENGTH_FACTOR < 0.5);
  assert.equal(voyageShipScale(0.01), 0.075);
  assert.equal(voyageShipScale(100), 0.28);

  const start = voyageOrbitAngle('voyage-1', 0);
  assert.equal(start, voyageOrbitAngle('voyage-1', 0));
  near(voyageOrbitAngle('voyage-1', 10_000) - start, 3.4);
  assert.ok(voyageOrbitAngle('voyage-1', 10_000) > start);

  const point = voyageOrbitPoint({ x: 2, y: 1, z: 3 }, 5, Math.PI / 2, 0);
  near(point[0], 2);
  near(point[1], 1);
  near(point[2], 8);
  const write = { x: 0, y: 0, z: 0 };
  writeVoyageOrbitPoint(write, { x: 0, y: 0, z: 0 }, 3, 0, 2);
  near(write.x, 3);
  near(write.z, 0);
  const tangent = voyageOrbitTangent(0);
  near(tangent[0], 0); near(tangent[1], 0); near(tangent[2], 1);
  assert.ok(VOYAGE_DESTINATION_ORBIT_FACTOR > 1.1 && VOYAGE_DESTINATION_ORBIT_FACTOR < 2.2,
    'the holding orbit sits outside the planet and near the capability ring');
});
