import test from 'node:test';
import assert from 'node:assert/strict';
import { projectTailscaleTopology, TailscaleAdapter } from '../src/adapters/tailscale';
import { centralNetworkRelay, networkPathForNode, networkSegments } from '../src/read-model/network';
import type { NodeView } from '../src/read-model/types';

const observedAt = '2026-10-23T01:00:00.000Z';
const config = { binary: 'tailscale', centralRelayRegion: 'private', centralRelayNodeId: 'relay' };
const nodes = ['mac', 'relay', 'direct', 'relayed', 'idle', 'offline', 'peer'].map((nativeId, index): NodeView => ({
  id: `node:${nativeId}`, nativeId, name: nativeId, address: `http://100.64.0.${index + 1}:36908`,
  platform: 'unknown', online: null, status: 'unknown', observedAt: null, serviceIds: [], agentStatus: 'unknown', evidence: [],
}));
const status = () => ({ BackendState: 'Running', Self: { ID: 'mac', Relay: 'private' }, Peer: {
  relay: { ID: 'relay', Online: true, Active: true, CurAddr: '203.0.113.10:41641', Relay: 'private' },
  direct: { ID: 'direct', Online: true, Active: true, CurAddr: '192.168.1.2:41641', Relay: 'private' },
  relayed: { ID: 'relayed', Online: true, Active: true, CurAddr: '', Relay: 'private' },
  idle: { ID: 'idle', Online: true, Active: false, CurAddr: '', Relay: 'private' },
  offline: { ID: 'offline', Online: false, Active: true, CurAddr: '', Relay: 'private' },
  peer: { ID: 'peer', Online: true, Active: true, CurAddr: '', Relay: 'private', PeerRelay: '100.64.0.2:40000' },
} });
const derpMap = { Regions: { 901: { RegionID: 901, RegionCode: 'private', RegionName: 'Private DERP', Nodes: [
  { Name: '901a', HostName: 'derp.example.test', IPv4: '203.0.113.10', DERPPort: 8443 },
] } } };

test('DERP identity comes from the observed map and binds an existing device without duplicating it', () => {
  const network = projectTailscaleTopology(status(), derpMap, nodes, config, observedAt);
  assert.equal(network.status, 'ok');
  assert.equal(network.observerNodeId, 'node:mac');
  const relay = centralNetworkRelay({ nodes, network });
  assert.equal(relay?.nodeId, 'node:relay');
  assert.equal(relay?.host, 'derp.example.test');
  assert.equal(relay?.port, 8443);
  assert.equal(relay?.evidence[0].observedAt, observedAt);
});

test('preferred DERP is not confused with current direct, idle, offline or peer-relay paths', () => {
  const network = projectTailscaleTopology(status(), derpMap, nodes, config, observedAt);
  assert.deepEqual(nodes.map(node => networkPathForNode(network, node.id)),
    ['self', 'direct', 'direct', 'derp', 'unknown', 'offline', 'peer-relay']);
  assert.equal(network.connections.find(connection => connection.toNodeId === 'node:direct')?.relayId, undefined);
  assert.equal(network.connections.find(connection => connection.toNodeId === 'node:relayed')?.relayId, network.centralRelayId);
  assert.ok(network.connections.every(connection => connection.fromNodeId === 'node:mac'));
});

test('observed relay routes pass through the actual hub and filters never expose paths through hidden devices', () => {
  const network = projectTailscaleTopology(status(), derpMap, nodes, config, observedAt);
  const paths = networkSegments(network, new Set(nodes.map(node => node.id)));
  assert.deepEqual(paths.derp, [{ from: 'node:mac', to: 'node:relay' }, { from: 'node:relay', to: 'node:relayed' }]);
  assert.deepEqual(paths.direct, [{ from: 'node:mac', to: 'node:direct' }]);
  assert.deepEqual(networkSegments(network, new Set(['node:mac', 'node:relayed'])).derp, []);
  assert.deepEqual(networkSegments({ ...network, status: 'stale' }, new Set(nodes.map(node => node.id))), { direct: [], derp: [] });
});

test('ambiguous public NAT endpoints and multiple DERP nodes do not guess a centre server', () => {
  const shared = status(); shared.Peer.direct.CurAddr = shared.Peer.relay.CurAddr;
  const unbound = projectTailscaleTopology(shared, derpMap, nodes, { binary: 'tailscale' }, observedAt);
  assert.equal(unbound.centralRelayId, undefined);
  const multiple = structuredClone(derpMap);
  multiple.Regions[901].Nodes.push({ Name: '901b', HostName: 'other.example.test', IPv4: '203.0.113.11', DERPPort: 443 });
  const network = projectTailscaleTopology(status(), multiple, nodes, config, observedAt);
  assert.equal(network.centralRelayId, undefined);
  assert.equal(network.connections.find(connection => connection.kind === 'derp')?.relayId, undefined);
});

test('CLI failure retains known relay identity while clearing current connection claims', async () => {
  let fail = false;
  const commands: string[][] = [];
  const adapter = new TailscaleAdapter(config, 300, async args => {
    commands.push(args);
    if (fail) throw new Error('unavailable');
    return args[0] === 'status' ? status() : derpMap;
  });
  const live = await adapter.read(nodes, observedAt);
  fail = true;
  const stale = await adapter.read(nodes, '2026-10-23T01:00:15.000Z');
  assert.equal(stale?.status, 'stale');
  assert.equal(stale?.centralRelayId, live?.centralRelayId);
  assert.equal(stale?.observedAt, observedAt);
  assert.deepEqual(stale?.connections, []);
  assert.equal(networkPathForNode(stale, 'node:direct'), 'unknown');
  assert.deepEqual(commands.slice(0, 2), [['status', '--json'], ['debug', 'derp-map']]);
  assert.equal((await new TailscaleAdapter(config, 300, async () => { throw new Error('missing'); }).read(nodes, observedAt))?.status, 'unavailable');
  assert.equal(await new TailscaleAdapter().read(nodes, observedAt), undefined);
});
