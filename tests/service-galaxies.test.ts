import test from 'node:test';
import assert from 'node:assert/strict';
import type { NodeView, ObserverSnapshot } from '../src/read-model/types';
import { serviceEntry, serviceSystems } from '../src/read-model/service-systems';
import { createGalaxyLayout } from '../src/view/galaxy-layout';
import { GALACTIC_ANGULAR_SPEED, SOLAR_ANGULAR_SPEED, orbitPosition } from '../src/view/universe-motion';
import { universeNodeSize } from '../src/view/universe-layout';

function fixture(planets = 5): ObserverSnapshot {
  const names = ['host', 'relay', 'remote', 'offline', ...Array.from({ length: planets }, (_, i) => `pc-${i}`)];
  const nodes = names.map((name, index): NodeView => ({ id: `node:${name}`, nativeId: name, name, address: `http://100.64.0.${index + 1}:36908`,
    platform: 'unknown', online: null, status: 'unknown', observedAt: null, serviceIds: [], agentStatus: 'unknown', evidence: [] }));
  return { version: 1, mode: 'live', generatedAt: '2026-10-23T00:00:00Z', refreshIntervalMs: 15000,
    serviceNodeId: 'node:host', nodes, services: [], jobs: [], events: [], sources: [], limitations: [],
    network: { status: 'ok', observedAt: '2026-10-23T00:00:00Z', observerNodeId: 'node:host', centralRelayId: 'relay',
      relays: [{ id: 'relay', regionId: 901, regionCode: 'private', name: 'DERP', host: 'derp.example.test', port: 8443, nodeId: 'node:relay', evidence: [] }],
      connections: nodes.filter(node => node.id !== 'node:host').map(node => ({ fromNodeId: 'node:host', toNodeId: node.id,
        kind: node.name === 'offline' ? 'offline' : node.name === 'remote' ? 'derp' : 'direct', observedAt: '2026-10-23T00:00:00Z' })), diagnostics: [] } };
}
const position = (layout: ReturnType<typeof createGalaxyLayout>, id: string, time: number) => orbitPosition(layout.plots.get(id)!, time);
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
const near = (a: number, b: number, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const layoutOf = (snapshot: ObserverSnapshot) => createGalaxyLayout(snapshot, serviceSystems(snapshot, serviceEntry(snapshot, 'https://visualizer.example.test/')), 'node:relay');

test('the opened service domain labels its host sun; aliases retain device identity', () => {
  const snapshot = fixture();
  const named = serviceEntry(snapshot, 'https://visualizer.example.test:8443/');
  assert.deepEqual(named, { nodeId: 'node:host', authority: 'visualizer.example.test:8443', binding: 'configured-host' });
  assert.equal(serviceEntry(snapshot, 'http://localhost:4318/').nodeId, named.nodeId);
  const systems = serviceSystems(snapshot, named);
  const local = systems.find(system => system.kind === 'entry')!;
  assert.equal(local.centerNodeId, 'node:host');
  assert.equal(local.authority, named.authority);
  assert.equal(local.nodeIds.length, 6);
  assert.ok(!local.nodeIds.includes('node:relay'));
  assert.ok(!local.nodeIds.includes('node:remote'));
  assert.ok(!local.nodeIds.includes('node:offline'));
});

test('changing the hosting service changes the sun, without borrowing another observer’s paths', () => {
  const snapshot = fixture();
  snapshot.serviceNodeId = 'node:pc-0';
  const entry = serviceEntry(snapshot, 'https://second.example.test/');
  assert.equal(entry.nodeId, 'node:pc-0');
  const local = serviceSystems(snapshot, entry).find(system => system.kind === 'entry')!;
  assert.deepEqual(local.nodeIds, ['node:pc-0']);
  assert.equal(local.status, 'unknown');
  snapshot.network!.observerNodeId = 'node:pc-0';
  snapshot.network!.connections = [{ fromNodeId: 'node:pc-0', toNodeId: 'node:host', kind: 'direct', observedAt: snapshot.generatedAt }];
  assert.deepEqual(serviceSystems(snapshot, entry).find(system => system.kind === 'entry')!.nodeIds, ['node:host', 'node:pc-0']);
  delete snapshot.serviceNodeId;
  assert.equal(serviceEntry(snapshot, 'http://100.64.0.1:4318/').nodeId, 'node:host');
});

test('uncertain paths retain previous local membership, while a confirmed relay path leaves it', () => {
  const snapshot = fixture(), entry = serviceEntry(snapshot, 'https://visualizer.example.test/');
  const before = serviceSystems(snapshot, entry);
  snapshot.network!.connections.find(path => path.toNodeId === 'node:pc-0')!.kind = 'offline';
  assert.ok(serviceSystems(snapshot, entry, before).find(system => system.kind === 'entry')!.nodeIds.includes('node:pc-0'));
  snapshot.network!.connections.find(path => path.toNodeId === 'node:pc-0')!.kind = 'derp';
  assert.ok(!serviceSystems(snapshot, entry, before).find(system => system.kind === 'entry')!.nodeIds.includes('node:pc-0'));
  snapshot.network!.status = 'stale'; snapshot.network!.connections = [];
  const cached = serviceSystems(snapshot, entry, before).find(system => system.kind === 'entry')!;
  assert.equal(cached.status, 'cached');
  assert.deepEqual(cached.nodeIds, before.find(system => system.kind === 'entry')!.nodeIds);
});

test('nested layout has one plot per real device and separate service and DERP centres', () => {
  const snapshot = fixture(), layout = layoutOf(snapshot);
  assert.equal(layout.plots.size, snapshot.nodes.length);
  assert.equal(layout.plots.get('node:relay')!.role, 'relay-center');
  const sun = layout.plots.get('node:host')!;
  assert.equal(sun.role, 'service-center');
  assert.equal(sun.galaxy!.minorRadius, 0);
  assert.ok(sun.galaxy!.majorRadius > 0);
  for (let time = 0; time <= 300; time += 10) {
    assert.deepEqual(position(layout, 'node:relay', time), [0, 0.3, 0]);
    const center = position(layout, 'node:host', time);
    near(Math.hypot(center[0], center[2] / sun.galaxy!.majorPlane!.aspect), layout.majorRadius);
    for (const id of snapshot.nodes.map(node => node.id)) assert.ok(distance(position(layout, id, time), [0, 0.3, 0]) <= layout.radius + 1e-9);
  }
  const reordered = layoutOf({ ...snapshot, nodes: [...snapshot.nodes].reverse() });
  for (const id of layout.plots.keys()) assert.deepEqual(position(reordered, id, 27), position(layout, id, 27));
});

test('individual tilted local orbits follow their moving sun while retaining evenly spread horizontal phases', () => {
  const snapshot = fixture(), layout = layoutOf(snapshot);
  const local = layout.systems.find(system => system.kind === 'entry')!;
  const peers = local.nodeIds.filter(id => id !== local.centerNodeId);
  const projectedDistance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], (a[2] - b[2]) / local.minorPlane.aspect);
  const initialDistance = projectedDistance(position(layout, peers[0], 0), position(layout, peers[1], 0));
  for (const time of [0, 10, 100, 1000, 1e12]) {
    const sun = position(layout, local.centerNodeId, time);
    for (const id of peers) near(projectedDistance(position(layout, id, time), sun), local.minorRadius);
    for (let index = 0; index < peers.length; index++) near(projectedDistance(position(layout, peers[index], time), position(layout, peers[(index + 1) % peers.length], time)), initialDistance);
  }
  const localPhase = (id: string, time: number) => {
    const p = position(layout, id, time), sun = position(layout, local.centerNodeId, time);
    return Math.atan2((p[2] - sun[2]) / local.minorPlane.aspect, p[0] - sun[0]);
  };
  const majorPhase = (time: number) => { const p = position(layout, local.centerNodeId, time); return Math.atan2(p[2] / local.majorPlane.aspect, p[0]); };
  near((localPhase(peers[0], 10) - localPhase(peers[0], 0) + 2 * Math.PI) % (2 * Math.PI), local.minorSpeed * 10);
  near((majorPhase(10) - majorPhase(0) + 2 * Math.PI) % (2 * Math.PI), GALACTIC_ANGULAR_SPEED * 10);
  assert.ok(SOLAR_ANGULAR_SPEED > GALACTIC_ANGULAR_SPEED);
});

test('system envelopes never overlap, and joining devices grows the relevant orbit', () => {
  const layout = layoutOf(fixture(6)), larger = layoutOf(fixture(7));
  assert.ok(larger.systems.find(system => system.kind === 'entry')!.minorRadius > layout.systems.find(system => system.kind === 'entry')!.minorRadius);
  assert.ok(larger.majorRadius > layout.majorRadius);
  const centres = layout.systems;
  for (const time of [0, 70, 250, 500, 1000]) for (let a = 0; a < centres.length; a++) for (let b = a + 1; b < centres.length; b++) {
    assert.ok(distance(position(layout, centres[a].centerNodeId, time), position(layout, centres[b].centerNodeId, time)) >= centres[a].envelope + centres[b].envelope + 8 - 1e-9);
  }
});

test('independent orbital planes retain clearance between service hosts and all nearby planets', () => {
  for (const count of [2, 5, 20]) {
    const snapshot = fixture(count), layout = layoutOf(snapshot);
    const ids = layout.systems.find(system => system.kind === 'entry')!.nodeIds;
    for (let time = 0; time <= 1000; time += 20) for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const clearance = (universeNodeSize(snapshot, ids[a]) + universeNodeSize(snapshot, ids[b])) * 1.9 + 2;
      assert.ok(distance(position(layout, ids[a], time), position(layout, ids[b], time)) >= clearance - 1e-9);
    }
  }
});

test('hosting the visualizer on the DERP device reuses its one centre without duplication', () => {
  const snapshot = fixture(); snapshot.serviceNodeId = 'node:relay'; snapshot.network!.observerNodeId = 'node:relay';
  snapshot.network!.connections = [{ fromNodeId: 'node:relay', toNodeId: 'node:host', kind: 'direct', observedAt: snapshot.generatedAt }];
  const layout = layoutOf(snapshot);
  assert.equal(layout.plots.size, snapshot.nodes.length);
  assert.equal(layout.systems.find(system => system.kind === 'entry')!.majorRadius, 0);
  assert.deepEqual(position(layout, 'node:relay', 33), [0, 0.3, 0]);
  assert.ok(distance(position(layout, 'node:host', 0), [0, 0.3, 0]) > 0);
});
