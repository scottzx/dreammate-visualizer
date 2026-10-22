import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { projectDeviceInfo } from '../src/adapters/device-info';
import { NodeAdapter } from '../src/adapters/node';
import { parseConfig } from '../src/observer/config';

const device = { protocol: 'dreammate.device.v1', node_id: 'fixture', collected_at: '2026-10-23T10:00:00Z', hostname: 'fixture-host', model: 'Mac15,12',
  system: { name: 'macOS', version: '15.0', arch: 'arm64' }, interfaces: [{ name: 'en0', mac: '02:00:00:00:00:01', addresses: [{ family: 'IPv4', address: '192.168.1.10', netmask: '255.255.255.0' }] }] };

test('basic device projection includes model and system and rejects an unrelated node identity', () => {
  assert.equal(projectDeviceInfo(device, 'fixture')?.model, 'Mac15,12');
  assert.equal(projectDeviceInfo(device, 'fixture')?.systemName, 'macOS');
  assert.equal(projectDeviceInfo(device, 'different-node'), undefined);
  assert.equal(projectDeviceInfo({}, 'fixture'), undefined);
});

test('observer reads only the existing manifest and health routes and retains marked cached device data', async () => {
  const requests: string[] = []; let failed = false;
  const server = createServer((req, res) => {
    requests.push(req.url!); res.setHeader('content-type', 'application/json');
    if (req.url === '/health') res.end(JSON.stringify({ node_id: 'fixture', status: 'ok' }));
    else if (req.url === '/manifest' && !failed) res.end(JSON.stringify({ node_id: 'fixture', services: [], metadata: { device, network_observations: '/network/observations' } }));
    else { res.writeHead(503); res.end('{}'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    const adapter = new NodeAdapter(parseConfig({ nodeUrls: [url], timeoutMs: 300 }, {}));
    const fresh = await adapter.read({ url });
    assert.equal(fresh.node.device?.model, 'Mac15,12');
    failed = true;
    const cached = await adapter.read({ url });
    assert.equal(cached.node.device?.status, 'cached');
    assert.ok(requests.every(path => path === '/manifest' || path === '/health'));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
