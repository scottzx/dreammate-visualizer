import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { capabilityRingMotion, orbitPlane, orbitTrack, planetSpin, spatialOrbitExtent, spatialOrbitOffset, spinQuaternion } from '../src/view/spatial-motion';
import { advanceOrbitTime } from '../src/view/universe-motion';

const near = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance);

test('similarly named devices receive stable, distinct orbital normals and oblique spin axes', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `node:pc-${i}`);
  const normals = ids.map(id => orbitPlane(id));
  assert.ok(Math.max(...normals.map(p => p.inclination)) - Math.min(...normals.map(p => p.inclination)) > 0.25);
  assert.ok(Math.max(...normals.map(p => p.longitude)) - Math.min(...normals.map(p => p.longitude)) > 4);
  for (const id of ids) {
    assert.deepEqual(orbitPlane(id), orbitPlane(id));
    assert.deepEqual(planetSpin(id), planetSpin(id));
    near(Math.hypot(...planetSpin(id).axis), 1);
    assert.ok(Math.hypot(planetSpin(id).axis[0], planetSpin(id).axis[2]) > 0.3);
  }
  assert.ok(new Set(ids.map(id => capabilityRingMotion(id).rotation.join(','))).size === ids.length);
});

test('every drawn track closes, fits its bound, and contains the corresponding moving body', () => {
  for (const id of ['host', 'phone', 'pc', 'relay']) {
    const plane = orbitPlane(id), radius = 24, track = orbitTrack(radius, plane);
    near(new Vector3(...track[0]).distanceTo(new Vector3(...track.at(-1)!)), 0);
    for (const point of track) {
      assert.ok(Math.hypot(...point) <= spatialOrbitExtent(radius, plane) + 1e-9);
      near(point[1], (point[2] * Math.cos(plane.longitude) - point[0] * Math.sin(plane.longitude)) * Math.tan(plane.inclination));
    }
    for (const phase of [0.12, 1.5, 4.2]) {
      const point = new Vector3(...spatialOrbitOffset(radius, phase, plane));
      let nearest = Infinity;
      for (let i = 0; i < track.length - 1; i++) {
        const a = new Vector3(...track[i]), segment = new Vector3(...track[i + 1]).sub(a);
        const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(segment) / segment.lengthSq()));
        nearest = Math.min(nearest, point.distanceTo(a.addScaledVector(segment, t)));
      }
      assert.ok(nearest < radius * 0.001, 'Body must remain on the visible polyline');
    }
  }
});

test('independently oriented orbits occupy volume rather than a shared plane', () => {
  const points = ['a', 'b', 'c', 'd'].map((id, i) => new Vector3(...spatialOrbitOffset(20, i * Math.PI / 2 + 0.2, orbitPlane(id))));
  const volume = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).dot(points[3].clone().sub(points[0]));
  assert.ok(Math.abs(volume) > 100);
});

test('all spin axes freeze with the shared pause clock and resume without a jump', () => {
  const spin = planetSpin('device'), before = spinQuaternion(spin, 12);
  let time = 12;
  for (let frame = 0; frame < 60; frame++) time = advanceOrbitTime(time, 1, false);
  assert.deepEqual(spinQuaternion(spin, time), before);
  assert.notDeepEqual(spinQuaternion(spin, advanceOrbitTime(time, 0.05, true)), before);
  for (const seconds of [0, 10, 1e12, Number.MAX_VALUE, Number.NaN]) {
    const quaternion = spinQuaternion(spin, seconds);
    assert.ok(quaternion.every(Number.isFinite));
    near(Math.hypot(...quaternion), 1);
  }
});
