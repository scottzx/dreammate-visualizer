import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { NodeView } from '../read-model/types';
import type { NetworkConnectionView, NetworkRelayView, NetworkTopologyView } from '../read-model/network';
import type { TailscaleConfig } from '../observer/config';
import { array, object, string } from './http';

const runFile = promisify(execFile);
const nodeHost = (node: NodeView) => { try { return new URL(node.address).hostname; } catch { return ''; } };
const endpointHost = (value: unknown) => {
  try { return new URL(`http://${string(value)}`).hostname.replace(/^\[|\]$/g, ''); } catch { return ''; }
};

/** Projection of two local, read-only CLI responses; no pings or settings changes. */
export function projectTailscaleTopology(statusValue: unknown, mapValue: unknown, nodes: NodeView[], config: TailscaleConfig, observedAt: string): NetworkTopologyView {
  const status = object(statusValue), self = object(status.Self), regions = object(object(mapValue).Regions);
  if (status.BackendState !== 'Running' || !string(self.ID) || !Object.keys(regions).length) throw new Error('Tailscale 状态或 DERP 地图不完整');
  const peers = Object.values(object(status.Peer)).map(object);
  const matchNode = (peer: ReturnType<typeof object>) => nodes.find(node => node.nativeId === peer.ID)
    ?? nodes.find(node => array(peer.TailscaleIPs).includes(nodeHost(node)));
  const observerNodeId = matchNode(self)?.id;
  const preferredRegion = config.centralRelayRegion || string(self.Relay);
  const relays: NetworkRelayView[] = [];
  for (const value of Object.values(regions)) {
    const region = object(value);
    if (!Number.isSafeInteger(region.RegionID) || Number(region.RegionID) <= 0) continue;
    for (const entry of array(region.Nodes)) {
      const relay = object(entry), host = string(relay.HostName) || string(relay.IPv4);
      if (!host || relay.STUNOnly === true) continue;
      const regionCode = string(region.RegionCode);
      const candidates = peers.filter(peer => endpointHost(peer.CurAddr) === (string(relay.IPv4) || host));
      const bound = regionCode === preferredRegion && config.centralRelayNodeId
        ? nodes.find(node => node.nativeId === config.centralRelayNodeId || node.id === config.centralRelayNodeId) : undefined;
      // A shared NAT endpoint cannot identify which device hosts a relay.
      const node = bound ?? (candidates.length === 1 ? matchNode(candidates[0]) : undefined);
      const port = Number.isInteger(relay.DERPPort) && Number(relay.DERPPort) > 0 && Number(relay.DERPPort) <= 65535 ? Number(relay.DERPPort) : 443;
      relays.push({ id: `tailscale:derp:${region.RegionID}:${string(relay.Name, host)}`, regionId: Number(region.RegionID), regionCode,
        name: string(region.RegionName, regionCode), host, port, nodeId: node?.id,
        evidence: [{ sourceId: 'tailscale:local', observedAt, locator: 'tailscale://debug/derp-map',
          note: bound ? '本机 DERP 地图；服务器设备身份已显式绑定' : '本机 DERP 地图；仅唯一公网端点匹配可关联设备' }] });
    }
  }
  const preferred = relays.filter(relay => relay.regionCode === preferredRegion && relay.nodeId);
  const centralRelayId = preferred.length === 1 ? preferred[0].id : undefined;
  const connections: NetworkConnectionView[] = observerNodeId ? peers.flatMap(peer => {
    const node = matchNode(peer);
    if (!node || node.id === observerNodeId) return [];
    const regionCode = string(peer.Relay);
    const candidates = relays.filter(relay => relay.regionCode === regionCode);
    const kind: NetworkConnectionView['kind'] = peer.Online === false ? 'offline' : peer.Active !== true ? 'unknown'
      : string(peer.CurAddr) ? 'direct' : string(peer.PeerRelay) ? 'peer-relay' : regionCode ? 'derp' : 'unknown';
    return [{ fromNodeId: observerNodeId, toNodeId: node.id, kind, observedAt,
      relayRegionCode: kind === 'derp' ? regionCode : undefined,
      relayId: kind === 'derp' && candidates.length === 1 ? candidates[0].id : undefined }];
  }) : [];
  return { status: observerNodeId ? 'ok' : 'partial', observedAt, observerNodeId, centralRelayId, relays, connections,
    diagnostics: ['连接类型仅表示观察机到各设备的路径；未测量其他设备之间的路径，也不代表物理局域网关系。',
      ...(!observerNodeId ? ['未在设备目录中匹配到 Tailscale 本机身份。'] : []),
      ...(!centralRelayId ? ['未唯一关联中继服务器与设备，未猜测圆心设备。'] : [])] };
}

export type ReadTailscaleCommand = (args: string[]) => Promise<unknown>;
export class TailscaleAdapter {
  private previous?: NetworkTopologyView;
  constructor(private readonly config?: TailscaleConfig, private readonly timeoutMs = 3000, private readonly readCommand?: ReadTailscaleCommand) {}
  async read(nodes: NodeView[], observedAt: string): Promise<NetworkTopologyView | undefined> {
    if (!this.config) return undefined;
    try {
      const read = this.readCommand ?? (async (args: string[]) => {
        const { stdout } = await runFile(this.config!.binary, args, { timeout: this.timeoutMs, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', windowsHide: true });
        return JSON.parse(stdout);
      });
      const [status, map] = await Promise.all([read(['status', '--json']), read(['debug', 'derp-map'])]);
      this.previous = projectTailscaleTopology(status, map, nodes, this.config, observedAt);
      return this.previous;
    } catch {
      return { status: this.previous ? 'stale' : 'unavailable', observedAt: this.previous?.observedAt ?? observedAt,
        observerNodeId: this.previous?.observerNodeId, centralRelayId: this.previous?.centralRelayId,
        relays: this.previous?.relays ?? [], connections: [], diagnostics: ['本轮 Tailscale 拓扑未读取成功；保留已知中继身份，连接路径保持未知。'] };
    }
  }
}
