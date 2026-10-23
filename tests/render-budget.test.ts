import test from 'node:test';
import assert from 'node:assert/strict';
import { Clock, Vector3 } from 'three';
import { Line2, LineGeometry } from 'three-stdlib';
import { ANIMATION_FPS, scheduleAnimationFrames } from '../src/view/frame-scheduler';
import { updateEvidenceLine } from '../src/view/evidence-line';

// SceneFrameLoop drives the scene clock by hand. R3F's advance() calls clock.getDelta()
// before applying our timestamp, and getDelta() restarts a clock whose autoStart flag is
// still set - and Clock.start() resets elapsedTime to 0. That would make the first frame
// after a pause advance by the whole session time. The scene only works because
// Clock.stop() clears autoStart. three has deprecated Clock in favour of Timer, so this
// invariant is asserted here: if a dependency upgrade breaks it, the test fails loudly
// instead of the scene silently jumping.
test('three Clock.stop() keeps the hand-driven scene clock from restarting on its own', () => {
  const clock = new Clock();
  clock.start();
  clock.elapsedTime = 42;
  clock.stop();
  assert.equal(clock.autoStart, false, 'Clock.stop() must clear autoStart, or advance() would reset elapsedTime and jump the scene');
  assert.equal(clock.getDelta(), 0, 'a stopped clock must not restart on its own');
  assert.ok(clock.elapsedTime >= 42, 'a stopped clock must keep the elapsed time the manual loop handed over instead of resetting it');
  clock.getElapsedTime();
  assert.ok(clock.elapsedTime >= 42, 'reading the elapsed time must not restart the clock either');
});

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
