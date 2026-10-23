import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoSnapshot } from '../src/observer/demo';
import { snapshotFacts } from '../src/read-model/presentation';
import { createObserver } from '../src/observer/index';
import { parseConfig } from '../src/observer/config';

test('devices retained after failed discovery lose cached network presence', async t => {
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
  assert.equal(retained.status, 'stale');
  assert.equal(retained.networkOnline, null);
  assert.equal(retained.online, null);
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
