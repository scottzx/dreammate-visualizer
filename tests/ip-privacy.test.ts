import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { containsIpAddress, displayServiceAuthority, HIDDEN_IP, redactIpText } from '../src/read-model/ip-privacy';
import { createSnapshotRedactor } from '../src/server/privacy';
import { createObserverServer } from '../src/server/index';
import { parseConfig } from '../src/observer/config';
import type { Observer } from '../src/observer/index';
import type { NodeView, ObserverSnapshot } from '../src/read-model/types';
import { serviceEntry, serviceSystems } from '../src/read-model/service-systems';

function fixture(): ObserverSnapshot {
  const now = '2026-10-23T02:00:00Z';
  const urls = ['http://203.0.113.10:36908', 'http://203.0.113.11:36908'];
  const nodes = urls.map((address, i): NodeView => ({ id: `node:${address}`, nativeId: address, name: `device-${i}`, address,
    platform: 'linux', online: true, networkOnline: true, status: 'ok', observedAt: now, serviceIds: [], agentStatus: 'unknown',
    evidence: [{ sourceId: `source:${address}`, locator: `${address}/manifest`, observedAt: now }],
    device: { status: 'observed', observedAt: now, model: 'test device', systemName: 'test OS', systemVersion: '1.2.3', arch: 'arm64', hostname: `device-${i}`,
      interfaces: [{ name: 'eth0', mac: '02:00:00:00:00:01', addresses: [{ family: 'IPv4', address: `192.168.1.${i + 1}`, netmask: '255.255.255.0' }] }] } }));
  return { version: 1, mode: 'live', serviceNodeId: nodes[0].id, layoutScope: JSON.stringify(urls), generatedAt: now, refreshIntervalMs: 15000,
    nodes, services: [], jobs: [], projects: [], sources: urls.map(address => ({ id: `source:${address}`, name: address, kind: 'node', status: 'ok',
      scope: `Gateway ${address}`, url: address, observedAt: now, version: '1.2.3', diagnostics: [`Route through ${address} or [2001:db8::1]`] })),
    events: [{ id: 'event', sourceId: `source:${urls[0]}`, type: 'test', title: 'test event', status: 'unknown', occurredAt: now,
      observedAt: now, nodeId: nodes[0].id, targetNodeId: nodes[1].id, causalConfirmed: false, evidence: [] }], limitations: [],
    network: { status: 'ok', observedAt: now, observerNodeId: nodes[0].id, relays: [], connections: [
      { fromNodeId: nodes[0].id, toNodeId: nodes[1].id, kind: 'direct', observedAt: now }], diagnostics: [] } };
}

test('IP privacy removes public, private, overlay, loopback and IPv6 literals, including mapped and scoped forms', () => {
  for (const address of ['203.0.113.7', '10.0.0.2', '100.64.0.2', '127.0.0.1', '255.255.255.0', '2001:db8::1', '::1', '::',
    '[2001:db8::1]', '::ffff:192.0.2.1', '[::ffff:192.0.2.1]', 'fe80::1%en0', '[fe80::1%en0]']) {
    assert.equal(containsIpAddress(address), true, 'An address literal was missed');
    assert.equal(containsIpAddress(redactIpText(address)), false);
    assert.ok(redactIpText(address).includes(HIDDEN_IP));
  }
  for (const text of ['2026-10-23T02:00:00.000Z', 'version 1.2.3', 'version 10.20.30.40.50', '999.0.113.7', '00:11:22:33:44:55', 'service.example.test:4318', 'private:abcdef0123456789', 'ap-formula-v1::{…}::ap-formula-v1']) {
    assert.equal(redactIpText(text), text);
  }
});

test('URL locators and percent-encoded addresses cannot bypass privacy filtering', () => {
  const cases = ['http://203.0.113.7:4318/health', 'http://[2001:db8::1]:4318/health', 'http://2130706433:4318/',
    'http://0x7f000001:4318/', 'node:2001:db8::1', 'ip=203.0.113.7.', 'sub.203.0.113.7.example.test', encodeURIComponent('http://203.0.113.7:4318/'),
    encodeURIComponent(encodeURIComponent('http://[2001:db8::1]/'))];
  for (const text of cases) {
    assert.equal(containsIpAddress(text), true);
    assert.ok(redactIpText(text).includes(HIDDEN_IP));
    assert.equal(redactIpText(redactIpText(text)), redactIpText(text));
  }
});

test('service domains stay readable while an IP-based browser URL receives a role label', () => {
  assert.equal(displayServiceAuthority('https://service.example.test:8443/'), 'service.example.test:8443');
  assert.equal(displayServiceAuthority('http://203.0.113.7:4318/'), '当前服务');
  assert.equal(displayServiceAuthority('http://[::1]:4318/'), '当前服务');
  assert.equal(displayServiceAuthority('http://203.0.113.7.example.test/'), '当前服务');
});

test('redacted snapshot references stay unique, linked and stable without mutating collection data', () => {
  const raw = fixture(), unchanged = structuredClone(raw);
  const redact = createSnapshotRedactor(new Uint8Array(32).fill(7));
  const result = redact(raw), again = redact(raw);
  assert.deepEqual(raw, unchanged);
  assert.deepEqual(result, again);
  assert.equal(result.privacy?.ipAddresses, 'hidden');
  assert.equal(containsIpAddress(JSON.stringify(result)), false);
  assert.equal(new Set(result.nodes.map(node => node.id)).size, raw.nodes.length);
  assert.equal(new Set(result.sources.map(source => source.id)).size, raw.sources.length);
  assert.equal(result.nodes[0].evidence[0].sourceId, result.sources[0].id);
  assert.equal(result.events[0].nodeId, result.nodes[0].id);
  assert.equal(result.events[0].targetNodeId, result.nodes[1].id);
  assert.equal(result.network?.observerNodeId, result.serviceNodeId);
  assert.equal(result.network?.connections[0].toNodeId, result.nodes[1].id);
  assert.equal(result.nodes[0].device?.systemVersion, '1.2.3');
  const entry = serviceEntry(result, 'https://service.example.test/');
  assert.equal(entry.nodeId, result.nodes[0].id);
  assert.equal(serviceSystems(result, entry).find(system => system.kind === 'entry')?.nodeIds.length, 2);
});

test('HTTP snapshots always redact IPs, including demo, refresh and attempted opt-out queries', async () => {
  const raw = fixture();
  const observer: Observer = { config: parseConfig({}, {}), peek: () => raw, snapshot: async mode => ({ ...raw, mode: mode ?? 'live' }) };
  const server = createObserverServer(observer);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try {
    for (const query of ['', '?mode=demo', '?refresh=1', '?includeIps=1&redact=0']) {
      const response: Response = await fetch(`http://127.0.0.1:${address.port}/api/snapshot${query}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const body = await response.text();
      assert.equal(containsIpAddress(body), false);
      assert.equal(JSON.parse(body).privacy.ipAddresses, 'hidden');
    }
    assert.deepEqual(raw, fixture());
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
