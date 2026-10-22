import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createObserverServer, listenObserverServers } from '../src/server/index';
import { createDemoSnapshot } from '../src/observer/demo';
import { parseConfig } from '../src/observer/config';
import type { Observer } from '../src/observer/index';
import type { DataMode } from '../src/read-model/types';

test('observer HTTP surface rejects mutations and validates modes before collecting', async () => {
  const calls: DataMode[] = [];
  const observer: Observer = {
    config: parseConfig({}, {}),
    peek: () => undefined,
    snapshot: async (mode = 'live') => {
      calls.push(mode);
      return { ...createDemoSnapshot(), mode };
    },
  };
  const server = createObserverServer(observer);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const result = await fetch(`${base}/api/snapshot?mode=live`, { method });
      assert.equal(result.status, 405);
      assert.equal(result.headers.get('allow'), 'GET, HEAD');
    }
    assert.equal(calls.length, 0, 'Rejected methods must not call any adapter');
    assert.equal((await fetch(`${base}/api/snapshot?mode=other`)).status, 400);
    assert.equal((await fetch(`${base}/api/not-a-method`)).status, 404);
    assert.equal(calls.length, 0);
    const health = await (await fetch(`${base}/api/health`)).json() as { readOnly: boolean };
    assert.equal(health.readOnly, true);
    const result = await fetch(`${base}/api/snapshot?mode=demo`);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal((await result.json() as { mode: string }).mode, 'demo');
    await fetch(`${base}/api/snapshot`);
    assert.deepEqual(calls, ['demo', 'live']);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('listener configuration preserves explicit scope and environment override', () => {
  assert.deepEqual(parseConfig({}, {}).listenHosts, ['127.0.0.1']);
  assert.deepEqual(parseConfig({ listenHosts: ['127.0.0.1', ' 100.64.0.2 ', '127.0.0.1'] }, {}).listenHosts, ['127.0.0.1', '100.64.0.2']);
  assert.deepEqual(parseConfig({ listenHosts: ['100.64.0.2'] }, { OBSERVER_HOST: '127.0.0.1' }).listenHosts, ['127.0.0.1']);
  for (const listenHosts of [[], '', [''], ['https://example.com'], [123]]) assert.throws(() => parseConfig({ listenHosts }, {}));
});

test('multiple addresses share one observer and a failed bind releases earlier listeners', async () => {
  const observer: Observer = { config: parseConfig({}, {}), peek: () => undefined, snapshot: async () => createDemoSnapshot() };
  const servers = await listenObserverServers(observer, ['127.0.0.1', '::1'], 0);
  const first = servers[0].address(); assert.ok(first && typeof first !== 'string');
  const port = first.port;
  try {
    for (const host of ['127.0.0.1', '[::1]']) {
      const response = await fetch(`http://${host}:${port}/api/health`);
      assert.equal(response.status, 200);
      assert.equal((await response.json() as { readOnly: boolean }).readOnly, true);
    }
  } finally {
    await Promise.all(servers.map(server => { server.closeAllConnections(); return new Promise<void>(resolve => server.close(() => resolve())); }));
  }
  const blocker = createObserverServer(observer);
  blocker.listen(0, '::1'); await once(blocker, 'listening');
  const blockedAddress = blocker.address(); assert.ok(blockedAddress && typeof blockedAddress !== 'string');
  try {
    await assert.rejects(listenObserverServers(observer, ['127.0.0.1', '::1'], blockedAddress.port), { code: 'EADDRINUSE' });
    const recovered = await listenObserverServers(observer, ['127.0.0.1'], blockedAddress.port);
    await new Promise<void>(resolve => recovered[0].close(() => resolve()));
  } finally {
    await new Promise<void>(resolve => blocker.close(() => resolve()));
  }
});
