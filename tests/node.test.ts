import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { NodeAdapter, projectService } from '../src/adapters/node';
import { parseConfig } from '../src/observer/config';

const timestamp = '2026-10-22T09:00:00.000Z';

test('partial skill pages survive disconnect and cached catalogs become stale without disappearing', async () => {
  let unavailable = false;
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    const pathname = new URL(req.url!, 'http://localhost').pathname;
    if (unavailable || (pathname === '/skills' && req.url?.includes('offset=1'))) {
      res.writeHead(503); res.end(JSON.stringify({ error: 'temporarily unavailable' })); return;
    }
    if (pathname === '/health') res.end(JSON.stringify({ node_id: 'fixture-node', status: 'ok' }));
    else if (pathname === '/manifest') res.end(JSON.stringify({ node_id: 'fixture-node', name: 'Fixture', type: 'linux', services: [{ id: 'dreammate-skill-manager', liveness: 'up', lastProbedAt: timestamp, methods: { catalog: { description: 'Skill catalog' } } }] }));
    else if (pathname === '/skills') res.end(JSON.stringify({ skills: [{ id: 'skill-1', name: 'First skill', revision: 'abc' }], has_more: true, next_offset: 1 }));
    else { res.writeHead(404); res.end('{}'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    const adapter = new NodeAdapter(parseConfig({ nodeUrls: [url], timeoutMs: 300, staleAfterMs: 5000 }, {}));
    const first = await adapter.read({ url }, timestamp);
    assert.equal(first.node.catalogAvailable, true);
    assert.equal(first.node.online, true);
    assert.equal(first.source.status, 'partial');
    assert.equal(first.services[0].skills.length, 1);
    unavailable = true;
    const stale = await adapter.read({ url }, '2026-10-22T09:00:10.000Z');
    assert.equal(stale.node.id, first.node.id);
    assert.equal(stale.node.status, 'stale');
    assert.equal(stale.source.observedAt, timestamp);
    assert.equal(stale.services[0].skills.length, 1);
    assert.equal(stale.services[0].status, 'unknown');
    const freshAdapter = new NodeAdapter(parseConfig({ nodeUrls: [url], timeoutMs: 300 }, {}));
    const unknown = await freshAdapter.read({ url });
    assert.equal(unknown.node.catalogAvailable, false);
    assert.equal(unknown.node.online, null);
    assert.equal(unknown.source.status, 'unavailable');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('old or implausibly future service probes do not establish current availability', () => {
  const service = (lastProbedAt: string) => ({ id: 'service', liveness: 'up', lastProbedAt });
  assert.equal(projectService(service('2026-10-22T08:58:00Z'), 'n', 's', timestamp)?.status, 'unknown');
  assert.equal(projectService(service('2026-10-22T09:10:00Z'), 'n', 's', timestamp)?.status, 'unknown');
  assert.equal(projectService(service('2026-10-22T08:59:59Z'), 'n', 's', timestamp)?.status, 'up');
});

test('skill catalog first-page failure retains prior successful skills with stale coverage', async () => {
  let failSkills = false;
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url?.startsWith('/skills')) {
      if (failSkills) { res.writeHead(503); res.end(JSON.stringify({ error: 'unavailable' })); }
      else res.end(JSON.stringify({ skills: [{ id: 'retained', name: 'Retained skill' }], has_more: false }));
    } else if (req.url === '/manifest') res.end(JSON.stringify({ node_id: 'n', name: 'N', services: [{ id: 'dreammate-skill-manager' }] }));
    else res.end(JSON.stringify({ node_id: 'n', status: 'ok' }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    const config = parseConfig({ nodeUrls: [url], timeoutMs: 300 }, {});
    const adapter = new NodeAdapter(config);
    const first = await adapter.read({ url }, timestamp);
    assert.equal(first.services[0].skillsStatus, 'ok');
    failSkills = true;
    const cached = await adapter.read({ url }, '2026-10-22T09:00:05Z');
    assert.equal(cached.services[0].skills[0].id, 'retained');
    assert.equal(cached.services[0].skillsStatus, 'stale');
    assert.equal(cached.services[0].skillsObservedAt, timestamp);
    const firstFailure = await new NodeAdapter(config).read({ url }, timestamp);
    assert.equal(firstFailure.services[0].skillsObservedAt, null);
    assert.equal(firstFailure.services[0].skillsStatus, 'unavailable');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('a replacement node never receives previous-node skills on failed or partial skill reads', async () => {
  let id = 'old', partial = false;
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/manifest') res.end(JSON.stringify({ node_id: id, services: [{ id: 'dreammate-skill-manager' }] }));
    else if (req.url?.startsWith('/skills')) {
      if (id === 'old') res.end(JSON.stringify({ skills: [{ id: 'old-only', name: 'Old device skill' }] }));
      else if (partial && !req.url.includes('offset=1')) res.end(JSON.stringify({ skills: [{ id: 'new-only', name: 'New device skill' }], has_more: true, next_offset: 1 }));
      else { res.writeHead(503); res.end('{}'); }
    } else res.end(JSON.stringify({ node_id: id }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const target = { url: `http://127.0.0.1:${address.port}` };
  try {
    for (const partialRead of [false, true]) {
      id = 'old'; partial = partialRead;
      const adapter = new NodeAdapter(parseConfig({ nodeUrls: [target.url], timeoutMs: 300 }, {}));
      await adapter.read(target, timestamp);
      id = 'new';
      const next = await adapter.read(target, timestamp);
      assert.equal(next.node.nativeId, 'new');
      assert.deepEqual(next.services[0].skills.map(skill => skill.id), partialRead ? ['new-only'] : []);
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
