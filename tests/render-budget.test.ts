import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { Line2, LineGeometry } from 'three-stdlib';
import { ANIMATION_FPS, scheduleAnimationFrames } from '../src/view/frame-scheduler';
import { updateEvidenceLine } from '../src/view/evidence-line';

test('animation rendering stays at 30 fps on 60, 120 and 144 Hz displays and cancels cleanly', () => {
  for (const hz of [60, 120, 144]) {
    let callback: (timestamp: number) => void = () => {};
    let frames = 0, elapsed = 0, pending = 0, cancelled = 0;
    const stop = scheduleAnimationFrames(delta => { frames++; elapsed += delta; }, {
      request: next => { callback = next; return ++pending; },
      cancel: id => { cancelled = id; },
    });
    for (let tick = 0; tick <= hz * 60; tick++) callback(tick * 1000 / hz);
    assert.equal(frames, ANIMATION_FPS * 60 + 1, `${hz} Hz`);
    assert.ok(Math.abs(elapsed - 60) < 0.001);
    stop(); assert.equal(cancelled, pending);
    callback(100000); assert.equal(frames, ANIMATION_FPS * 60 + 1);
  }
});

test('a suspended animation loop cannot advance motion by an entire inactive period', () => {
  let callback: (timestamp: number) => void = () => {};
  const deltas: number[] = [];
  const stop = scheduleAnimationFrames(delta => deltas.push(delta), {
    request: next => { callback = next; return 1; }, cancel: () => {},
  });
  callback(0); callback(3600000);
  assert.deepEqual(deltas, [0, 0.1]); stop();
});

test('moving evidence lines retain their position and dash buffers across thousands of frames', () => {
  const geometry = new LineGeometry().setPositions(new Array(17 * 3).fill(0));
  const line = new Line2(geometry); line.computeLineDistances();
  const attributes = { ...geometry.attributes };
  const from = new Vector3(), to = new Vector3();
  for (let frame = 0; frame < 2000; frame++) {
    from.set(frame / 10, 1, 0); to.set(frame / 10 + 10, 2, 5);
    updateEvidenceLine(geometry, from, to);
  }
  for (const key of Object.keys(attributes)) assert.equal(geometry.attributes[key], attributes[key]);
  const start = geometry.getAttribute('instanceStart'), end = geometry.getAttribute('instanceEnd');
  assert.equal(start.getX(0), Math.fround(from.x));
  assert.equal(end.getZ(end.count - 1), to.z);
  assert.ok(geometry.boundingBox!.containsPoint(new Vector3().fromBufferAttribute(end, end.count - 1)));
  const distanceStart = geometry.getAttribute('instanceDistanceStart'), distanceEnd = geometry.getAttribute('instanceDistanceEnd');
  assert.equal(distanceStart.getX(0), 0);
  for (let index = 1; index < distanceStart.count; index++) assert.equal(distanceStart.getX(index), distanceEnd.getX(index - 1));
  assert.ok(distanceEnd.getX(distanceEnd.count - 1) > from.distanceTo(to));
  geometry.dispose(); line.material.dispose();
});
