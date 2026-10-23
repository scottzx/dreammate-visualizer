import type { ObserverSnapshot } from './types';
import { centralNetworkRelay } from './network';
import { displayServiceAuthority } from './ip-privacy';

export interface ServiceEntry {
  authority: string; nodeId?: string; binding: 'configured-host' | 'address-match' | 'observer-host' | 'unknown';
}
export interface ServiceSystemView {
  id: string; kind: 'entry' | 'remote'; centerNodeId: string; authority: string;
  nodeIds: string[]; status: 'observed' | 'cached' | 'unknown';
}

const authority = displayServiceAuthority;
const hostname = (value: string) => { try { return new URL(value).hostname.toLowerCase(); } catch { return ''; } };

/** The opened service's hostname labels its host device, regardless of public egress IP. */
export function serviceEntry(snapshot: Pick<ObserverSnapshot, 'nodes' | 'network' | 'serviceNodeId'>, entryUrl: string): ServiceEntry {
  const domain = authority(entryUrl);
  const configured = snapshot.nodes.find(node => node.id === snapshot.serviceNodeId || node.nativeId === snapshot.serviceNodeId);
  if (configured) return { authority: domain || authority(configured.address), nodeId: configured.id, binding: 'configured-host' };
  const host = hostname(entryUrl);
  const matches = snapshot.nodes.filter(node => host && hostname(node.address) === host);
  if (matches.length === 1) return { authority: domain, nodeId: matches[0].id, binding: 'address-match' };
  // The bundled page and API are served by the observer process on the same host.
  const observer = snapshot.nodes.find(node => node.id === snapshot.network?.observerNodeId);
  return observer ? { authority: domain || authority(observer.address), nodeId: observer.id, binding: 'observer-host' }
    : { authority: domain, binding: 'unknown' };
}

/** Only observed paths from the service host can place planets in its local solar system. */
export function serviceSystems(snapshot: Pick<ObserverSnapshot, 'nodes' | 'network'>, entry: ServiceEntry,
  previous: readonly ServiceSystemView[] = []): ServiceSystemView[] {
  const relayId = centralNetworkRelay(snapshot)?.nodeId;
  const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
  const available = new Set(nodes.keys());
  const systems: ServiceSystemView[] = [];
  if (entry.nodeId && nodes.has(entry.nodeId)) {
    const ids = new Set([entry.nodeId]);
    const old = previous.find(system => system.kind === 'entry' && system.centerNodeId === entry.nodeId);
    const healthy = snapshot.network?.status === 'ok' && snapshot.network.observerNodeId === entry.nodeId;
    for (const connection of healthy ? snapshot.network?.connections ?? [] : []) {
      if (connection.fromNodeId !== entry.nodeId || connection.toNodeId === relayId || !nodes.has(connection.toNodeId)) continue;
      if (connection.kind === 'direct' || (connection.kind === 'offline' || connection.kind === 'unknown') && old?.nodeIds.includes(connection.toNodeId)) ids.add(connection.toNodeId);
    }
    if (!healthy && old) for (const id of old.nodeIds) if (nodes.has(id) && id !== relayId) ids.add(id);
    const nodeIds = [...ids].sort(); nodeIds.forEach(id => available.delete(id));
    systems.push({ id: `system:entry:${entry.nodeId}`, kind: 'entry', centerNodeId: entry.nodeId, authority: entry.authority,
      nodeIds, status: healthy ? 'observed' : old ? 'cached' : 'unknown' });
  }
  available.delete(relayId ?? '');
  for (const id of [...available].sort()) {
    const node = nodes.get(id)!;
    systems.push({ id: `system:remote:${id}`, kind: 'remote', centerNodeId: id, authority: authority(node.address), nodeIds: [id],
      status: snapshot.network?.status === 'ok' ? 'observed' : 'unknown' });
  }
  return systems;
}
