import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { GB, GIB, formatNodeStorage, nodeStorageRadius, DEFAULT_STORAGE_RADIUS } from '../src/read-model/storage';
import type { NodeView, ObserverSnapshot } from '../src/read-model/types';
import { manifestStorage, NodeAdapter } from '../src/adapters/node';
import { parseConfig } from '../src/observer/config';
import { universeNodeSize } from '../src/view/universe-layout';
import { internalStorageTotal } from '../src/adapters/storage';

const at = '2026-10-22T10:00:00.000Z';
const storage = (gb: number): NodeView['storage'] => ({ totalBytes: gb * GB, observedAt: at, source: 'node-manifest', status: 'observed' });

test('64, 128, 256 and 512 GB double volume, with no change of scale across snapshots', () => {
  const radii = [64, 128, 256, 512].map(gb => nodeStorageRadius({ storage: storage(gb) }));
  for (let i = 1; i < radii.length; i++) {
    assert.ok(Math.abs((radii[i] / radii[i - 1]) ** 3 - 2) < 1e-10);
    assert.ok(Math.abs(radii[i - 1] / radii[i] - .7937005259840998) < 1e-10);
  }
  const snapshot = { nodes: [{ id: 'a', storage: storage(64) }, { id: 'b', storage: storage(64) }], services: [] } as unknown as ObserverSnapshot;
  assert.equal(universeNodeSize(snapshot, 'a'), universeNodeSize(snapshot, 'b'));
  snapshot.services = Array.from({ length: 100 }, (_, i) => ({ nodeId: 'a', id: String(i), skills: [] })) as unknown as ObserverSnapshot['services'];
  assert.equal(universeNodeSize(snapshot, 'a'), radii[0], 'catalogue changes do not resize a device');
  snapshot.nodes.push({ id: 'large', storage: storage(512) } as NodeView);
  assert.equal(universeNodeSize(snapshot, 'a'), radii[0], 'adding a larger device does not renormalize existing radii');
});

test('unknown or invalid storage uses the marked 128 GB default; cached storage keeps its value', () => {
  for (const totalBytes of [undefined, null, 0, -1, NaN, Infinity, '64', Number.MAX_SAFE_INTEGER + 1]) {
    const node = { storage: { totalBytes } } as unknown as NodeView;
    assert.equal(nodeStorageRadius(node), DEFAULT_STORAGE_RADIUS);
    assert.equal(formatNodeStorage(node), '128 GB · 默认');
  }
  assert.equal(nodeStorageRadius(undefined), nodeStorageRadius({ storage: storage(128) }));
  assert.equal(nodeStorageRadius({ storage: storage(16) }), nodeStorageRadius({ storage: storage(128) }) / 2, 'real storage replaces the default without changing the volume scale');
  assert.equal(formatNodeStorage({ storage: storage(.5) }), '500 MB');
  assert.equal(formatNodeStorage({ storage: storage(2000) }), '2 TB');
  const legacyRAM = { memory: { totalBytes: 16 * GIB } } as unknown as NodeView;
  assert.equal(nodeStorageRadius(legacyRAM), DEFAULT_STORAGE_RADIUS, 'RAM observations cannot become disk capacity');
  assert.equal(formatNodeStorage(legacyRAM), '128 GB · 默认');
  const cached = { storage: { ...storage(128)!, status: 'cached' as const } };
  assert.equal(formatNodeStorage(cached), '128 GB · 缓存');
  assert.equal(nodeStorageRadius(cached), nodeStorageRadius({ storage: storage(128) }));
});

test('manifest storage accepts explicit units and ignores RAM, free and used space', () => {
  assert.equal(manifestStorage({ metadata: { hardware: { storage_total_bytes: 64 * GB } } }, at)?.totalBytes, 64 * GB);
  assert.equal(manifestStorage({ metadata: { hardware: { storage_total_gb: 128 } } }, at)?.totalBytes, 128 * GB);
  assert.equal(manifestStorage({ metadata: { storage_total_bytes: 32 * GB } }, at)?.source, 'node-manifest');
  for (const value of [0, -1, Infinity, '64 GB']) assert.equal(manifestStorage({ metadata: { hardware: { storage_total_bytes: value } } }, at), undefined);
  assert.equal(manifestStorage({ metadata: { hardware: { memory_total_bytes: 64 * GB, storage_free_bytes: 512 * GB, storage_used_bytes: 24 * GB } } }, at), undefined);
  assert.equal(manifestStorage({ metadata: { hardware: { storage_total_gib: 128 } } }, at)?.totalBytes, 128 * GIB);
  assert.equal(manifestStorage({ metadata: { hardware: { disk_total_bytes: 512 * GB, memory_total_bytes: 16 * GB } } }, at)?.totalBytes, 512 * GB);
});

test('adapter preserves storage evidence and binds local disk capacity only to the matching node', async () => {
  let nativeId = 'fixture', reported = true, fail = false;
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (fail) { res.writeHead(503); res.end('{}'); return; }
    res.end(JSON.stringify(req.url === '/manifest'
      ? { node_id: nativeId, services: [], metadata: reported ? { hardware: { storage_total_bytes: 128 * GB } } : {} }
      : { node_id: nativeId, status: 'ok' }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const target = { url: `http://127.0.0.1:${address.port}` };
  try {
    // Pin the staleness window inside the test instead of inheriting the global default:
    // the assertion below requires that a failed read 59s after the last successful
    // observation is reported as 'stale', which only holds for staleAfterMs < 59000.
    const config = parseConfig({ nodeUrls: [target.url], timeoutMs: 300, staleAfterMs: 45000 }, {});
    const adapter = new NodeAdapter(config);
    const first = await adapter.read(target, at);
    assert.equal(first.node.storage?.totalBytes, 128 * GB);
    reported = false;
    const missing = await adapter.read(target, '2026-10-22T10:00:01Z');
    assert.equal(missing.node.storage?.status, 'cached');
    assert.equal(missing.node.storage?.observedAt, at);
    fail = true;
    const failed = await adapter.read(target, '2026-10-22T10:01:00Z');
    assert.equal(failed.node.status, 'stale');
    assert.equal(failed.node.storage?.totalBytes, 128 * GB);
    assert.equal(failed.node.storage?.status, 'cached');
    fail = false; nativeId = 'replacement';
    assert.equal((await adapter.read(target, at)).node.storage, undefined, 'a replacement node cannot inherit storage from the old identity');
    let hostCapacity: number | undefined = 512 * GB;
    const bound = new NodeAdapter({ ...config, localNodeId: 'replacement' }, async () => hostCapacity);
    assert.equal((await bound.read(target, at)).node.storage?.totalBytes, 512 * GB);
    assert.equal((await bound.read(target, at)).node.storage?.source, 'observer-host');
    hostCapacity = undefined;
    const failedProbe = await bound.read(target, '2026-10-22T10:00:02Z');
    assert.equal(failedProbe.node.storage?.status, 'cached');
    assert.equal(failedProbe.node.storage?.totalBytes, 512 * GB);
    assert.equal(failedProbe.node.storage?.observedAt, at);
    let remoteProbes = 0;
    const remote = new NodeAdapter({ ...config, localNodeId: 'another-node' }, async () => { remoteProbes++; return 512 * GB; });
    assert.equal((await remote.read(target, at)).node.storage, undefined, 'loopback alone is insufficient to claim local hardware');
    assert.equal(remoteProbes, 0);
    reported = true;
    let probes = 0;
    const reportedFirst = new NodeAdapter({ ...config, localNodeId: 'replacement' }, async () => { probes++; return 512 * GB; });
    assert.equal((await reportedFirst.read(target, at)).node.storage?.totalBytes, 128 * GB);
    assert.equal(probes, 0, 'a reported device total takes precedence over fallback probing');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('internal storage inventory counts physical disks once and never adds APFS partitions or volumes', () => {
  const disk = { DeviceIdentifier: 'disk0', Size: 512 * GB,
    Partitions: [{ DeviceIdentifier: 'disk0s1', Size: 512 * GB }, { DeviceIdentifier: 'disk0s2', Size: 512 * GB }] };
  assert.equal(internalStorageTotal({ AllDisksAndPartitions: [disk] }), 512 * GB);
  assert.equal(internalStorageTotal({ AllDisksAndPartitions: [disk, disk] }), 512 * GB);
  assert.equal(internalStorageTotal({ AllDisksAndPartitions: [disk, { DeviceIdentifier: 'disk1', Size: 1000 * GB }] }), 1512 * GB);
  for (const data of [{}, { AllDisksAndPartitions: [] }, { AllDisksAndPartitions: [{ ...disk, Size: -1 }] },
    { AllDisksAndPartitions: [disk, { ...disk, Size: 256 * GB }] },
    { AllDisksAndPartitions: [disk, { DeviceIdentifier: 'disk1' }] }]) assert.equal(internalStorageTotal(data), undefined);
});

test('failed and malformed manifests cannot reuse another node identity from the same address', async () => {
  let id = 'old', manifestMode: 'valid' | 'failed' | 'malformed' = 'valid';
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/health') { res.end(JSON.stringify({ node_id: id })); return; }
    if (manifestMode === 'failed') { res.writeHead(503); res.end('{}'); return; }
    res.end(JSON.stringify({ node_id: id, services: manifestMode === 'valid' ? [] : undefined,
      metadata: { hardware: { storage_total_gb: 128 } } }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const target = { url: `http://127.0.0.1:${address.port}` };
  try {
    for (const mode of ['failed', 'malformed'] as const) {
      id = 'old'; manifestMode = 'valid';
      const adapter = new NodeAdapter(parseConfig({ nodeUrls: [target.url], timeoutMs: 300 }, {}));
      assert.equal((await adapter.read(target, at)).node.storage?.totalBytes, 128 * GB);
      id = 'new'; manifestMode = mode;
      const next = await adapter.read({ ...target, nativeId: 'new' }, at);
      assert.equal(next.node.nativeId, 'new');
      assert.equal(next.node.storage, undefined);
      assert.equal(next.node.catalogAvailable, false);
      assert.ok(next.source.diagnostics.some(d => d.includes('身份')));
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
