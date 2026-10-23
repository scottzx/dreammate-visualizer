import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniverseLayout, placeUniverseLabels, universeFleetSample, universeNodeSize, universePeerConnections, universeRingRadius, UNIVERSE_NEIGHBOR_ARC_LENGTH } from '../src/view/universe-layout';
import { universeOverviewDistance } from '../src/view/universe-framing';
import { DEFAULT_STORAGE_RADIUS } from '../src/read-model/storage';
import type { ObserverSnapshot } from '../src/read-model/types';

const points = (layout: ReturnType<typeof createUniverseLayout>) => [...layout.plots].sort(([a], [b]) => a.localeCompare(b));
test('circular order survives refresh ordering, additions, disappearance and returning identities', () => {
  const ids = Array.from({ length: 24 }, (_, index) => `node:${index}`);
  const original = createUniverseLayout(ids);
  assert.deepEqual(points(createUniverseLayout([...ids].reverse())), points(original));
  const missing = createUniverseLayout([ids[0], ids[5]], original.assignments);
  const returned = createUniverseLayout(ids, missing.assignments);
  assert.deepEqual(points(returned), points(original));
  const added = createUniverseLayout([...ids, 'node:new'], returned.assignments);
  assert.deepEqual([...added.plots.keys()].filter(id => id !== 'node:new'), [...original.plots.keys()]);
  assert.ok(added.radius > original.radius);
  for (const id of ids) assert.equal(added.plots.get(id)!.slot, original.plots.get(id)!.slot);
  const locations = [...original.plots.values()].map((plot) => `${plot.x}:${plot.y}:${plot.z}`);
  assert.equal(new Set(locations).size, ids.length);
});

test('every device occupies the same ring with equal neighbouring arc lengths, including the closing gap', () => {
  for (const count of [1, 2, 3, 6, 13, 24, 100]) {
    const ids = Array.from({ length: count }, (_, i) => `node:${i}`);
    const layout = createUniverseLayout(ids);
    const plots = [...layout.plots.values()];
    assert.deepEqual(layout.rings, [layout.radius]);
    for (let index = 0; index < count; index++) {
      const a = plots[index], b = plots[(index + 1) % count];
      assert.ok(Math.abs(Math.hypot(a.x, a.z) - layout.radius) < 1e-10);
      const turn = (Math.atan2(b.z, b.x) - Math.atan2(a.z, a.x) + 2 * Math.PI) % (2 * Math.PI);
      assert.ok(Math.abs((count === 1 ? 2 * Math.PI : turn) * layout.radius - UNIVERSE_NEIGHBOR_ARC_LENGTH) < 1e-9);
    }
  }
  const ten = createUniverseLayout(Array.from({ length: 10 }, (_, i) => String(i)));
  const twenty = createUniverseLayout(Array.from({ length: 20 }, (_, i) => String(i)), ten.assignments);
  assert.equal(twenty.radius, ten.radius * 2);
  assert.equal(createUniverseLayout(['same', 'same']).plots.size, 1);
  assert.deepEqual(createUniverseLayout([]).rings, []);
  for (const count of [0, -1, NaN, Infinity, 1.5]) assert.equal(universeRingRadius(count), 0);
});

test('malformed persisted orbit data is repaired without duplicate slots', () => {
  const layout = createUniverseLayout(['a', 'b', 'c'], [{ id: 'a', slot: 2 }, { id: 'b', slot: 2 }, { id: 'c', slot: -1 }]);
  assert.equal(new Set([...layout.plots.values()].map((plot) => plot.slot)).size, 3);
});

test('only the confirmed relay occupies the centre; radius depends on the other devices', () => {
  const ids = ['mac', 'relay', ...Array.from({ length: 11 }, (_, i) => `device:${i}`)];
  const original = createUniverseLayout(ids);
  const layout = createUniverseLayout(ids, original.assignments, 'relay');
  assert.equal(layout.plots.size, 13);
  assert.equal(layout.radius, universeRingRadius(12));
  assert.deepEqual(layout.plots.get('relay'), { id: 'relay', slot: original.plots.get('relay')!.slot,
    x: 0, y: 0.3, z: 0, orbitRadius: 0, role: 'relay-center' });
  const orbit = [...layout.plots.values()].filter(plot => plot.role !== 'relay-center');
  for (let index = 0; index < orbit.length; index++) {
    const a = orbit[index], b = orbit[(index + 1) % orbit.length];
    const angle = (Math.atan2(b.z, b.x) - Math.atan2(a.z, a.x) + Math.PI * 2) % (Math.PI * 2);
    assert.ok(Math.abs(angle * layout.radius - UNIVERSE_NEIGHBOR_ARC_LENGTH) < 1e-9);
  }
  const larger = createUniverseLayout([...ids, 'new'], layout.assignments, 'relay');
  assert.equal(larger.radius, universeRingRadius(13));
  assert.deepEqual(larger.plots.get('relay'), layout.plots.get('relay'));
  assert.deepEqual(createUniverseLayout(ids, [], 'missing'), createUniverseLayout(ids));
  assert.equal(createUniverseLayout(['relay'], [], 'relay').radius, 0);
  assert.deepEqual(createUniverseLayout(['relay'], [], 'relay').rings, []);
});

test('peer topology connects every unique visible pair exactly once without inventing events', () => {
  for (const count of [0, 1, 2, 13, 100]) {
    const ids = Array.from({ length: count }, (_, i) => `node:${i}`);
    const links = universePeerConnections(ids);
    assert.equal(links.length, Math.max(0, count * (count - 1) / 2));
    assert.equal(new Set(links.map(link => JSON.stringify([link.from, link.to]))).size, links.length);
    assert.ok(links.every(link => link.from !== link.to && ids.includes(link.from) && ids.includes(link.to)));
    if (count) assert.equal(links.filter(link => link.from === ids[0] || link.to === ids[0]).length, count - 1);
    assert.deepEqual(universePeerConnections([...ids].reverse().concat(ids)), links);
  }
  assert.deepEqual(universePeerConnections(['a', 'c']), [{ from: 'a', to: 'c' }]);
});

test('overview framing grows with membership and fits the complete ring in the narrower field of view', () => {
  let previous = 0;
  for (const count of [1, 2, 13, 24, 100]) {
    const radius = universeRingRadius(count);
    for (const aspect of [16 / 9, 1, 9 / 16]) {
      const distance = universeOverviewDistance(radius, 3.6, aspect);
      const vertical = Math.PI / 8;
      const halfFov = Math.min(vertical, Math.atan(Math.tan(vertical) * aspect));
      assert.ok(distance * Math.sin(halfFov) > radius + 3.6 * 2.4);
    }
    const distance = universeOverviewDistance(radius, 3.6, 16 / 9);
    assert.ok(distance > previous);
    previous = distance;
  }
  assert.ok(Number.isFinite(universeOverviewDistance(NaN, Infinity, 0)));
});

test('catalogue samples remain bounded and size never claims missing work counts', () => {
  const snapshot = { nodes: [], services: [] } as unknown as ObserverSnapshot;
  assert.equal(universeFleetSample(snapshot, 'node:a'), 0);
  assert.equal(universeNodeSize(snapshot, 'node:a'), DEFAULT_STORAGE_RADIUS);
  snapshot.services = Array.from({ length: 256 }, (_, index) => ({ id: String(index), nodeId: 'node:a', skills: [] })) as unknown as ObserverSnapshot['services'];
  assert.equal(universeFleetSample(snapshot, 'node:a'), 7);
  assert.equal(universeNodeSize(snapshot, 'node:a'), DEFAULT_STORAGE_RADIUS);
});

test('dense device labels avoid the centre planet and each other, without depending on input order', () => {
  const anchors = Array.from({ length: 13 }, (_, index) => ({ id: `label:${index}`, x: 640 + (index % 5) * 70,
    y: 330 + Math.floor(index / 5) * 45, width: 155, height: 62, priority: index === 0 ? 0 : 2 }));
  const planets = [{ x: 800, y: 450, radius: 90 }, { x: 570, y: 290, radius: 40 }, { x: 1020, y: 330, radius: 40 }];
  const layout = placeUniverseLabels(anchors, planets, 1600, 900);
  assert.deepEqual(layout, placeUniverseLabels([...anchors].reverse(), planets, 1600, 900));
  const rects: { left: number; right: number; top: number; bottom: number }[] = [];
  for (const anchor of anchors) {
    const placed = layout.get(anchor.id)!;
    assert.equal(placed.visible, true);
    const rect = { left: placed.x - anchor.width / 2, right: placed.x + anchor.width / 2, top: placed.y - anchor.height, bottom: placed.y - 17 };
    assert.equal(planets.some((planet) => rect.left < planet.x + planet.radius && rect.right > planet.x - planet.radius
      && rect.top < planet.y + planet.radius && rect.bottom > planet.y - planet.radius), false);
    assert.equal(rects.some((other) => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top), false);
    rects.push(rect);
  }
});

test('device labels reserve the visible network legend instead of covering its path colors', () => {
  const reserved = { left: 860, right: 1100, top: 410, bottom: 600 };
  const anchor = { id: 'device', x: 960, y: 500, width: 155, height: 70, priority: 2 };
  const label = placeUniverseLabels([anchor], [], 1280, 720, [reserved]).get('device')!;
  assert.equal(label.visible, true);
  assert.equal(label.x - 155 / 2 < reserved.right && label.x + 155 / 2 > reserved.left
    && label.y - 70 < reserved.bottom && label.y - 17 > reserved.top, false);
});
