import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTANT_NEBULA_COUNT, distantNebulae } from '../src/read-model/distant-nebulae';

test('the demo far field is a dozen nebulas of ten-plus planets each', () => {
  const clusters = distantNebulae('scenario-v3', 20);
  assert.equal(clusters.length, DISTANT_NEBULA_COUNT);
  assert.equal(new Set(clusters.map(cluster => cluster.id)).size, clusters.length);
  for (const cluster of clusters) {
    assert.ok(cluster.planets.length >= 10, 'each nebula keeps a dozen-ish planets');
    assert.ok(cluster.planets.length <= 12);
    assert.ok(cluster.haloRadius > 0);
    for (const planet of cluster.planets) {
      assert.ok(planet.radius > 0);
      assert.ok(planet.offset.every(Number.isFinite));
    }
  }
});

test('the far field is deterministic and stays outside the observed ring', () => {
  const first = distantNebulae('scenario-v3', 20);
  assert.deepEqual(distantNebulae('scenario-v3', 20), first);
  for (const cluster of first) assert.ok(Math.hypot(cluster.center[0], cluster.center[2]) >= 20 * 1.5);
  const guarded = distantNebulae('scenario-v3', Number.NaN, 1);
  assert.equal(guarded.length, 1);
  assert.ok(guarded[0].planets.every(planet => Number.isFinite(planet.radius)));
});
