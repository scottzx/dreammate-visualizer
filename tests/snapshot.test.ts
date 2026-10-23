import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSnapshot } from '../src/observer/demo';
import { snapshotFacts } from '../src/read-model/presentation';
import { createObserver } from '../src/observer/index';
import { parseConfig } from '../src/observer/config';

test('failed discovery rechecks known devices without reusing cached network presence', async t => {
  let disconnected = false;
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input);
    if (url.pathname === '/nodes') return disconnected
      ? new Response('{}', { status: 503 })
      : Response.json({ nodes: [{ node_id: 'peer', name: 'Peer', ipv4: 'peer.test', network_online: true }] });
    const node_id = url.hostname === 'seed.test' ? 'seed' : 'peer';
    return Response.json(url.pathname === '/health' ? { node_id } : { node_id, name: node_id, services: [] });
  });
  const observer = createObserver(parseConfig({ nodeUrls: ['http://seed.test:36908'] }, {}));
  const first = await observer.snapshot('live', true);
  assert.equal(first.nodes.find(node => node.nativeId === 'peer')?.networkOnline, true);
  disconnected = true;
  const second = await observer.snapshot('live', true);
  const retained = second.nodes.find(node => node.nativeId === 'peer');
  assert.ok(retained, 'the device remains selectable');
  assert.equal(retained.status, 'ok', 'the known address is probed again even when discovery fails');
  assert.equal(retained.networkOnline, null);
  assert.equal(retained.online, true, 'a fresh health response establishes current gateway availability');
});

test('empty and smaller successful address books keep rechecking previously discovered devices', async t => {
  let directory = ['alpha', 'beta'];
  const reads: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input);
    if (url.pathname === '/nodes') return Response.json({ nodes: directory.map(id => ({ node_id: id, ipv4: `${id}.test`, network_online: true })) });
    const node_id = url.hostname.split('.')[0];
    if (url.pathname === '/manifest') reads.push(node_id);
    return Response.json(url.pathname === '/health' ? { node_id } : { node_id, name: node_id, services: [{ id: 'capability' }] });
  });
  const observer = createObserver(parseConfig({ nodeUrls: ['http://seed.test:36908'] }, {}));
  const first = await observer.snapshot('live', true);
  const identities = first.nodes.map(node => node.id).sort();
  assert.equal(identities.length, 3);
  directory = [];
  const empty = await observer.snapshot('live', true);
  assert.deepEqual(empty.nodes.map(node => node.id).sort(), identities);
  assert.equal(empty.services.length, 3);
  assert.ok(empty.nodes.filter(node => node.nativeId !== 'seed').every(node => node.networkOnline === null && node.online === true));
  directory = ['alpha'];
  const smaller = await observer.snapshot('live', true);
  assert.deepEqual(smaller.nodes.map(node => node.id).sort(), identities);
  assert.equal(smaller.nodes.find(node => node.nativeId === 'alpha')?.networkOnline, true);
  assert.equal(smaller.nodes.find(node => node.nativeId === 'beta')?.networkOnline, null);
  assert.equal(reads.filter(id => id === 'beta').length, 3, 'missing known devices receive a fresh manifest read on every collection');
});

test('undiscovered and unreachable devices retain cached capabilities and recover on return', async t => {
  let listed = true, reachable = true, revision = 'first';
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input), peer = url.hostname === 'peer.test';
    if (url.pathname === '/nodes') return Response.json({ nodes: listed ? [{ node_id: 'peer', ipv4: 'peer.test', network_online: true }] : [] });
    if (peer && !reachable) return new Response('{}', { status: 503 });
    const node_id = peer ? 'peer' : 'seed';
    return Response.json(url.pathname === '/health' ? { node_id } : { node_id, name: node_id,
      metadata: { hardware: { storage_total_bytes: 100_000_000_000 } },
      services: [{ id: revision, skills: [{ id: 'known-skill', name: 'Known skill' }] }] });
  });
  const observer = createObserver(parseConfig({ nodeUrls: ['http://seed.test:36908'] }, {}));
  const first = await observer.snapshot('live', true);
  const firstPeer = first.nodes.find(node => node.nativeId === 'peer')!;
  listed = false; reachable = false;
  const missing = await observer.snapshot('live', true);
  const cached = missing.nodes.find(node => node.id === firstPeer.id);
  assert.ok(cached, 'the device remains visible when both discovery and gateway are temporarily unavailable');
  assert.ok(cached.status === 'partial' || cached.status === 'stale');
  assert.equal(cached.online, null);
  assert.equal(cached.networkOnline, null);
  assert.equal(cached.observedAt, firstPeer.observedAt);
  assert.equal(cached.storage?.status, 'cached');
  const cachedServices = missing.services.filter(service => service.nodeId === cached.id);
  assert.equal(cachedServices[0].nativeId, 'first');
  assert.equal(cachedServices[0].skills[0].id, 'known-skill');
  assert.equal(cachedServices[0].status, 'unknown');
  assert.equal(cachedServices[0].skillsStatus, 'stale');
  listed = true; reachable = true; revision = 'restored';
  const restored = await observer.snapshot('live', true);
  const peer = restored.nodes.find(node => node.id === firstPeer.id)!;
  assert.equal(peer.status, 'ok');
  assert.equal(peer.online, true);
  assert.equal(peer.networkOnline, true);
  assert.equal(peer.storage?.status, 'observed');
  assert.deepEqual(restored.services.filter(service => service.nodeId === peer.id).map(service => service.nativeId), ['restored']);
});

test('known device probes respect maxNodes and stay inside the configured source scope', async t => {
  let directory = ['alpha'];
  const reads: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input);
    if (url.pathname === '/nodes') return Response.json({ nodes: directory.map(id => ({ node_id: id, ipv4: `${id}.test` })) });
    const node_id = url.hostname.split('.')[0];
    if (url.pathname === '/manifest') reads.push(node_id);
    return Response.json(url.pathname === '/health' ? { node_id } : { node_id, name: node_id, services: [] });
  });
  const config = parseConfig({ nodeUrls: ['http://seed.test:36908'], maxNodes: 2 }, {});
  const observer = createObserver(config);
  assert.equal((await observer.snapshot('live', true)).nodes.length, 2);
  directory = ['beta']; reads.length = 0;
  const capped = await observer.snapshot('live', true);
  assert.deepEqual(capped.nodes.map(node => node.nativeId).sort(), ['beta', 'seed']);
  assert.equal(reads.length, 2);
  assert.ok(capped.limitations.some(note => note.includes('扫描上限')));
  directory = []; reads.length = 0;
  assert.equal((await observer.snapshot('live', true)).nodes.length, 2);
  assert.deepEqual(reads.sort(), ['beta', 'seed']);
  config.nodeUrls = ['http://other.test:36908']; reads.length = 0;
  const changed = await observer.snapshot();
  assert.deepEqual(changed.nodes.map(node => node.nativeId), ['other']);
  assert.deepEqual(reads, ['other']);
  assert.notEqual(changed.layoutScope, capped.layoutScope);
});

test('a device missing from the address book is kept for the grace period and then dropped', async t => {
  let directory = ['alpha'];
  const reads: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const url = new URL(input);
    if (url.pathname === '/nodes') return Response.json({ nodes: directory.map(id => ({ node_id: id, ipv4: `${id}.test`, network_online: true })) });
    const node_id = url.hostname.split('.')[0];
    if (url.pathname === '/manifest') reads.push(node_id);
    return Response.json(url.pathname === '/health' ? { node_id } : { node_id, name: node_id, services: [] });
  });
  // staleAfterMs / refreshIntervalMs = 2 rounds of grace.
  const observer = createObserver(parseConfig({ nodeUrls: ['http://seed.test:36908'], refreshIntervalMs: 60000, staleAfterMs: 120000 }, {}));
  const listed = await observer.snapshot('live', true);
  assert.deepEqual(listed.nodes.map(node => node.nativeId).sort(), ['alpha', 'seed']);
  directory = [];
  for (const round of [1, 2]) {
    const kept = await observer.snapshot('live', true);
    assert.deepEqual(kept.nodes.map(node => node.nativeId).sort(), ['alpha', 'seed'], `round ${round} still keeps the missing device`);
  }
  reads.length = 0;
  const dropped = await observer.snapshot('live', true);
  assert.deepEqual(dropped.nodes.map(node => node.nativeId), ['seed'], 'a device missing for the whole grace period leaves the observed range');
  assert.deepEqual(reads, ['seed'], 'a dropped device is no longer probed');
  assert.ok(dropped.limitations.some(note => note.includes('未出现在地址簿')), 'the removal is reported instead of silently shrinking');
});

test('demonstration snapshot is isolated and entity references resolve', () => {
  const snapshot = createDemoSnapshot(new Date('2026-10-22T09:00:00Z'));
  assert.equal(snapshot.mode, 'demo');
  const nodeIds = new Set(snapshot.nodes.map(n => n.id));
  const serviceIds = new Set(snapshot.services.map(s => s.id));
  const jobIds = new Set(snapshot.jobs.map(j => j.id));
  const attemptIds = new Set(snapshot.jobs.flatMap(j => j.attempts.map(a => a.id)));
  assert.equal(nodeIds.size, snapshot.nodes.length);
  for (const node of snapshot.nodes) for (const id of node.serviceIds) assert.ok(serviceIds.has(id));
  for (const service of snapshot.services) assert.ok(nodeIds.has(service.nodeId));
  for (const event of snapshot.events) {
    if (event.nodeId) assert.ok(nodeIds.has(event.nodeId));
    if (event.targetNodeId) assert.ok(nodeIds.has(event.targetNodeId));
    if (event.jobId) assert.ok(jobIds.has(event.jobId));
    if (event.attemptId) assert.ok(attemptIds.has(event.attemptId));
    if (event.causalConfirmed) assert.ok(event.evidence.length > 0, 'Confirmed causal edges require evidence');
  }
});

test('retry attempts do not create extra business jobs', () => {
  const snapshot = createDemoSnapshot(new Date('2026-10-22T09:00:00Z'));
  const facts = snapshotFacts(snapshot);
  assert.equal(facts.jobs, snapshot.jobs.length);
  assert.equal(facts.attempts, snapshot.jobs.flatMap(j => j.attempts).length);
  assert.ok(snapshot.jobs.some(j => j.attempts.length > 1), 'Demo needs a retry example');
  assert.ok(facts.attempts > facts.jobs);
});
