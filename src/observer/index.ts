import type { ObserverSnapshot } from '../read-model/types';
import { AcpAdapter } from '../adapters/acp';
import { NodeAdapter, discoverNodes, type NodeResult } from '../adapters/node';
import type { ObserverConfig } from './config';
import { createDemoSnapshot } from './demo';

async function mapConcurrent<T, R>(items: T[], concurrency: number, read: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await read(items[index]); }
  }));
  return results;
}

export function createObserver(config: ObserverConfig) {
  const nodes = new NodeAdapter(config); const acp = config.acpSources.map(source => new AcpAdapter(source, config));
  let latest: ObserverSnapshot | undefined; let collecting: Promise<ObserverSnapshot> | undefined;
  async function collectSnapshot(): Promise<ObserverSnapshot> {
    const now = new Date().toISOString();
    const [discovery, executions] = await Promise.all([discoverNodes(config), Promise.all(acp.map(adapter => adapter.read(now)))]);
    const nodeResults = await mapConcurrent(discovery.targets, 6, target => nodes.read(target, now));
    const byNode = new Map<string, NodeResult>();
    for (const result of nodeResults) { const existing = byNode.get(result.node.id); if (!existing || result.source.status === 'ok') byNode.set(result.node.id, result); }
    const results = [...byNode.values()];
    // A temporary address-book failure must not erase previously observed devices.
    if (latest && discovery.diagnostics.length) {
      const observedIds = new Set(results.map(result => result.node.id));
      for (const node of latest.nodes) if (!observedIds.has(node.id)) {
        const services = latest.services.filter(service => service.nodeId === node.id).map(service => ({ ...service, status: 'unknown' as const, skillsStatus: 'stale' as const }));
        const source = latest.sources.find(source => node.evidence.some(evidence => evidence.sourceId === source.id));
        if (source) results.push({ node: { ...node, storage: node.storage && { ...node.storage, status: 'cached' }, status: 'stale', online: null }, services, source: { ...source, status: 'stale', diagnostics: [...source.diagnostics, '本轮发现不完整，保留旧设备快照'] } });
      }
    }
    const snapshot: ObserverSnapshot = { version: 1, mode: 'live', layoutScope: JSON.stringify([...config.nodeUrls].sort()), generatedAt: new Date().toISOString(), refreshIntervalMs: config.refreshIntervalMs,
      nodes: results.map(result => result.node), services: results.flatMap(result => result.services), jobs: executions.flatMap(result => result.jobs), events: executions.flatMap(result => result.events).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
      sources: [...results.map(result => result.source), ...executions.map(result => result.source), ...(acp.length ? [] : [{ id: 'acp:unconfigured', name: 'ACP 工作单与执行事件', kind: 'acp' as const, status: 'unknown' as const, scope: '尚未配置授权 source/origin，范围未知', observedAt: null, diagnostics: ['未枚举或猜测 originSessionId；工作单数量未知'] }]), { id: 'sessions:unconfigured', name: '历史会话与轮次', kind: 'sessions', status: 'unsupported', scope: 'M3 增强接口尚未接入', observedAt: null, diagnostics: ['会话引用仅保留来源明确给出的 ID，不读取原始会话内容'] }, { id: 'artifacts:unconfigured', name: '产物定位', kind: 'artifacts', status: 'unsupported', scope: 'M3 增强接口尚未接入', observedAt: null, diagnostics: ['未根据文件时间推测工作单归属'] }],
      limitations: ['仅观察明确配置的种子及其地址簿设备；网络在线不等于 Node 网关或服务可用。', '星球体积与已采集的设备存储成正比；存储未知的设备统一按128G显示并标记默认值，不能按主机名或服务数量推测。', '当前无全网通用调用台账；不从服务目录推算调用量、角色忙闲或技能执行次数。', 'ACP 只读取显式 origin 范围；最终触发者及跨 Node 因果关系缺少证据时保持未知。', '游标与缓存保存在观察进程中；重启后从 0 重建事件，稳定 ID 保证单次快照不重复计数。', ...config.diagnostics, ...discovery.diagnostics] };
    latest = snapshot; return snapshot;
  }
  return {
    config,
    async snapshot(mode: 'live' | 'demo' = 'live', refresh = false): Promise<ObserverSnapshot> {
      if (mode === 'demo') return createDemoSnapshot();
      if (!refresh && latest && Date.now() - Date.parse(latest.generatedAt) < config.refreshIntervalMs) return latest;
      if (!collecting) collecting = collectSnapshot().finally(() => { collecting = undefined; });
      return collecting;
    },
    peek: () => latest,
  };
}
export type Observer = ReturnType<typeof createObserver>;
