import type { CoverageStatus, Evidence, ObserverSnapshot } from './types';

export type NetworkPathKind = 'direct' | 'derp' | 'peer-relay' | 'offline' | 'unknown';
export interface NetworkRelayView {
  id: string; regionId: number; regionCode: string; name: string;
  host: string; port: number; nodeId?: string; evidence: Evidence[];
}
export interface NetworkConnectionView {
  fromNodeId: string; toNodeId: string; kind: NetworkPathKind;
  relayId?: string; relayRegionCode?: string; observedAt: string;
}
export interface NetworkTopologyView {
  status: CoverageStatus; observedAt: string; observerNodeId?: string; centralRelayId?: string;
  relays: NetworkRelayView[]; connections: NetworkConnectionView[]; diagnostics: string[];
}
export interface NetworkSegment { from: string; to: string }

export function centralNetworkRelay(snapshot: Pick<ObserverSnapshot, 'nodes' | 'network'>): NetworkRelayView | undefined {
  return snapshot.network?.relays.find(relay => relay.id === snapshot.network?.centralRelayId
    && relay.nodeId && snapshot.nodes.some(node => node.id === relay.nodeId));
}

/** Only the observer's paths are known. A preferred DERP region is not an active relay path. */
export function networkPathForNode(network: NetworkTopologyView | undefined, nodeId: string): NetworkPathKind | 'self' {
  if (!network || network.status !== 'ok') return 'unknown';
  if (network.observerNodeId === nodeId) return 'self';
  return network.connections.find(connection => connection.toNodeId === nodeId)?.kind ?? 'unknown';
}

/** Render a relayed connection as observer → relay → peer, never as a full peer matrix. */
export function networkSegments(network: NetworkTopologyView | undefined, visibleIds: ReadonlySet<string>) {
  const groups = { direct: [] as NetworkSegment[], derp: [] as NetworkSegment[] };
  if (!network || network.status !== 'ok') return groups;
  const seen = { direct: new Set<string>(), derp: new Set<string>() };
  const add = (kind: keyof typeof groups, from: string, to: string) => {
    if (from === to || !visibleIds.has(from) || !visibleIds.has(to)) return;
    const key = JSON.stringify([from, to].sort());
    if (!seen[kind].has(key)) { seen[kind].add(key); groups[kind].push({ from, to }); }
  };
  for (const connection of network.connections) {
    if (!visibleIds.has(connection.fromNodeId) || !visibleIds.has(connection.toNodeId)) continue;
    if (connection.kind === 'direct') add('direct', connection.fromNodeId, connection.toNodeId);
    if (connection.kind === 'derp') {
      const relay = network.relays.find(relay => relay.id === connection.relayId);
      if (relay?.nodeId) {
        add('derp', connection.fromNodeId, relay.nodeId);
        add('derp', relay.nodeId, connection.toNodeId);
      }
    }
  }
  // When two observed paths share the same drawing segment, keep the relay route visible.
  groups.direct = groups.direct.filter(segment => !seen.derp.has(JSON.stringify([segment.from, segment.to].sort())));
  return groups;
}
