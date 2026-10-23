import type { ObserverSnapshot } from '../read-model/types';
import { AcpAdapter } from '../adapters/acp';
import { NodeAdapter, discoverNodes, type NodeResult, type NodeTarget } from '../adapters/node';
import type { ObserverConfig } from './config';
import { createDemoSnapshot } from './demo';
import { LocalProjectsAdapter } from '../adapters/projects';
import { TailscaleAdapter } from '../adapters/tailscale';

async function mapConcurrent<T, R>(items: T[], concurrency: number, read: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await read(items[index]); }
  }));
  return results;
}

export function createObserver(config: ObserverConfig) {
  const nodes = new NodeAdapter(config); const acp = config.acpSources.map(source => new AcpAdapter(source, config));
  const projects = new LocalProjectsAdapter(config);
  const tailscale = new TailscaleAdapter(config.tailscale, config.timeoutMs);
  let latest: ObserverSnapshot | undefined;
  let collecting: { scope: string; promise: Promise<ObserverSnapshot> } | undefined;
  let targetScope = JSON.stringify([...config.nodeUrls].sort());
  let knownTargets = new Map<string, NodeTarget>();
  async function collectSnapshot(scope: string, previousTargets: ReadonlyMap<string, NodeTarget>): Promise<ObserverSnapshot> {
    const now = new Date().toISOString();
    const [discovery, executions] = await Promise.all([discoverNodes(config), Promise.all(acp.map(adapter => adapter.read(now)))]);
    const targets = new Map(discovery.targets.slice(0, config.maxNodes).map(target => [target.url, target]));
    let retained = 0, omitted = discovery.targets.length > targets.size;
    // An empty or temporarily smaller address book is not evidence that a device
    // was removed. Recheck known addresses, without reusing old network presence.
    for (const [url, target] of previousTargets) if (!targets.has(url)) {
      if (targets.size >= config.maxNodes) { omitted = true; continue; }
      targets.set(url, { ...target, networkOnline: null }); retained += 1;
    }
    if (retained) discovery.diagnostics.push(`本轮地址簿未列出 ${retained} 个已知地址，已继续探查；未沿用旧网络在线状态`);
    if (omitted) discovery.diagnostics.push(`已达到 ${config.maxNodes} 个节点的扫描上限，部分已知地址未探查`);
    if (targetScope === scope) knownTargets = targets;
    const nodeResults = await mapConcurrent([...targets.values()], 6, target => nodes.read(target, now));
    const byNode = new Map<string, NodeResult>();
    for (const result of nodeResults) { const existing = byNode.get(result.node.id); if (!existing || result.source.status === 'ok') byNode.set(result.node.id, result); }
    const results = [...byNode.values()];
    const observedNodes = results.map(result => result.node);
    const [projectResult, network] = await Promise.all([projects.read(observedNodes, now), tailscale.read(observedNodes, now)]);
    const snapshot: ObserverSnapshot = { version: 1, mode: 'live', layoutScope: scope, serviceNodeId: observedNodes.find(node => node.nativeId === config.localNodeId)?.id,
      generatedAt: new Date().toISOString(), refreshIntervalMs: config.refreshIntervalMs,
      nodes: results.map(result => result.node), services: results.flatMap(result => result.services), jobs: executions.flatMap(result => result.jobs), events: executions.flatMap(result => result.events).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
      projects: projectResult.projects.length ? projectResult.projects : undefined,
      network,
      sources: [...results.map(result => result.source), projectResult.source, ...executions.map(result => result.source), ...(acp.length ? [] : [{ id: 'acp:unconfigured', name: 'ACP 工作单与执行事件', kind: 'acp' as const, status: 'unknown' as const, scope: '尚未配置授权 source/origin，范围未知', observedAt: null, diagnostics: ['未枚举或猜测 originSessionId；工作单数量未知'] }]), { id: 'sessions:unconfigured', name: '历史会话与轮次', kind: 'sessions', status: 'unsupported', scope: 'M3 增强接口尚未接入', observedAt: null, diagnostics: ['会话引用仅保留来源明确给出的 ID，不读取原始会话内容'] }, { id: 'artifacts:unconfigured', name: '产物定位', kind: 'artifacts', status: 'unsupported', scope: 'M3 增强接口尚未接入', observedAt: null, diagnostics: ['未根据文件时间推测工作单归属'] }],
      limitations: ['仅观察明确配置的种子及其地址簿设备；网络在线不等于 Node 网关或服务可用。', '星球体积与已采集的设备存储成正比；存储未知的设备统一按128G显示并标记默认值，不能按主机名或服务数量推测。', '粗星环的每颗卫星对应一个可见服务；每个目录 Skill ID 对应一个星点，目录部分覆盖时只展示可见条目。', '球面色块按已测项目目录占用÷真实设备存储着色；默认128G不参与占比，灰色包含未探查、未归属及其他容量，并非空闲空间。项目目录存在不证明项目正在执行。', '当前无全网通用调用台账；不从服务目录推算调用量、角色忙闲或技能执行次数。', 'ACP 只读取显式 origin 范围；最终触发者及跨 Node 因果关系缺少证据时保持未知。', '游标与缓存保存在观察进程中；重启后从 0 重建事件，稳定 ID 保证单次快照不重复计数。', ...config.diagnostics, ...discovery.diagnostics] };
    if (targetScope === scope) latest = snapshot;
    return snapshot;
  }
  return {
    config,
    async snapshot(mode: 'live' | 'demo' = 'live', refresh = false): Promise<ObserverSnapshot> {
      if (mode === 'demo') return createDemoSnapshot();
      const scope = JSON.stringify([...config.nodeUrls].sort());
      if (scope !== targetScope) { targetScope = scope; knownTargets = new Map(); latest = undefined; }
      if (!refresh && latest && Date.now() - Date.parse(latest.generatedAt) < config.refreshIntervalMs) return latest;
      if (!collecting || collecting.scope !== scope) {
        const pending = { scope, promise: collectSnapshot(scope, knownTargets) };
        collecting = pending;
        pending.promise = pending.promise.finally(() => { if (collecting === pending) collecting = undefined; });
      }
      return collecting.promise;
    },
    peek: () => latest,
  };
}
export type Observer = ReturnType<typeof createObserver>;
