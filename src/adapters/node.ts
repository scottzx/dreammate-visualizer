import type { NodeView, ServiceView, SourceView } from '../read-model/types';
import type { ObserverConfig } from '../observer/config';
import { array, failure, object, readJson, string, type JsonObject } from './http';

export interface NodeTarget { url: string; nativeId?: string; name?: string; platform?: string; networkOnline?: boolean | null }
export interface NodeResult { node: NodeView; services: ServiceView[]; source: SourceView }
export async function discoverNodes(config: ObserverConfig): Promise<{ targets: NodeTarget[]; diagnostics: string[] }> {
  const targets = new Map<string, NodeTarget>(); const diagnostics: string[] = [];
  for (const url of config.nodeUrls) targets.set(url, { url });
  const directories = await Promise.allSettled(config.nodeUrls.map(url => readJson(`${url}/nodes`, config.timeoutMs)));
  directories.forEach((result, index) => {
    if (result.status === 'rejected') { diagnostics.push(`${config.nodeUrls[index]} 地址簿：${failure(result.reason).message}`); return; }
    if (!Array.isArray(result.value.nodes)) { diagnostics.push(`${config.nodeUrls[index]} 地址簿缺少 nodes，范围未知`); return; }
    for (const item of result.value.nodes) {
      const record = object(item); const host = string(record.ipv4) || string(record.dnsName);
      const url = record.is_self === true ? config.nodeUrls[index] : host && /^[a-zA-Z0-9.:-]+$/.test(host) ? `http://${host}:36908` : '';
      if (!url) { diagnostics.push(`地址簿设备 ${string(record.name, '未知')} 缺少可用地址`); continue; }
      if (!targets.has(url) && targets.size >= config.maxNodes) { diagnostics.push(`已达到 ${config.maxNodes} 个节点的扫描上限，覆盖不完整`); continue; }
      targets.set(url, { url, nativeId: string(record.node_id) || undefined, name: string(record.name) || undefined, platform: string(record.type), networkOnline: typeof record.network_online === 'boolean' ? record.network_online : null });
    }
  });
  return { targets: [...targets.values()], diagnostics: [...new Set(diagnostics)] };
}

export function projectService(value: unknown, nodeId: string, sourceId: string, observedAt: string, staleAfterMs = 45000): ServiceView | null {
  const data = object(value); const nativeId = string(data.id);
  if (!nativeId) return null;
  const metadata = object(data.metadata);
  const lastProbe = string(data.lastProbedAt) || string(metadata.last_probed_at);
  const liveness = string(data.liveness) || string(metadata.liveness);
  // A CLI declaration can be marked up without ever being probed. Keep that uncertainty visible.
  const probeTime = Date.parse(lastProbe);
  const confirmedProbe = Number.isFinite(probeTime) && Date.parse(observedAt) - probeTime <= staleAfterMs && probeTime <= Date.parse(observedAt) + 5000;
  return { id: `${nodeId}/service/${encodeURIComponent(nativeId)}`, nativeId, nodeId, name: string(data.name, nativeId), description: string(data.description) || string(metadata.description), kind: string(data.kind, 'generic'),
    status: confirmedProbe && liveness === 'down' ? 'down' : liveness === 'up' && confirmedProbe ? 'up' : 'unknown', observedAt: lastProbe || null,
    methods: Object.entries(object(data.methods)).map(([name, descriptor]) => ({ name, description: string(object(descriptor).description) })),
    skills: (Array.isArray(data.skills) ? data.skills.map((entry, index) => [String(index), entry] as const) : Object.entries(object(data.skills))).map(([id, descriptor]) => ({ id: string(object(descriptor).id, id), name: string(object(descriptor).name, id), description: string(object(descriptor).description), revision: string(object(descriptor).revision) || undefined })),
    skillsStatus: 'ok', skillsObservedAt: observedAt,
    sharing: string(data.sharing, 'network'), evidence: [{ sourceId, nativeId, observedAt, note: 'Node 申报契约；未主动执行方法，CLI 无探活证据保持未知' }] };
}

export class NodeAdapter {
  private previous = new Map<string, NodeResult>();
  constructor(private readonly config: ObserverConfig) {}
  async read(target: NodeTarget, now = new Date().toISOString()): Promise<NodeResult> {
    const sourceId = `node:${target.url}`;
    const [manifestResult, healthResult] = await Promise.allSettled([readJson(`${target.url}/manifest`, this.config.timeoutMs), readJson(`${target.url}/health`, this.config.timeoutMs)]);
    if (manifestResult.status === 'rejected') {
      const error = failure(manifestResult.reason); const cached = this.previous.get(target.url);
      if (cached) {
        const stale = Date.parse(now) - Date.parse(cached.node.observedAt ?? '') > this.config.staleAfterMs;
        return { node: { ...cached.node, online: healthResult.status === 'fulfilled' ? true : null, status: stale ? 'stale' : 'partial' }, services: cached.services.map(service => ({ ...service, status: 'unknown', skillsStatus: 'stale' })), source: { ...cached.source, status: stale ? 'stale' : error.status, diagnostics: [error.message, `保留 ${cached.node.observedAt} 的旧快照；当前服务可用性未知`] } };
      }
      const id = `node:${target.nativeId || target.url}`;
      return { node: { id, nativeId: target.nativeId || target.url, name: target.name || new URL(target.url).hostname, address: target.url, platform: target.platform || 'unknown', catalogAvailable: false, networkOnline: target.networkOnline ?? null, online: healthResult.status === 'fulfilled' ? true : null, status: target.networkOnline === false ? 'offline' : error.status, observedAt: null, serviceIds: [], agentStatus: 'unknown', evidence: [{ sourceId, observedAt: now, note: target.networkOnline === false ? '地址簿显示网络离线；未取得 Node manifest' : '仅地址簿记录；不证明 Node 已安装或网关在线' }] }, services: [], source: { id: sourceId, name: target.name || target.url, kind: 'node', url: target.url, scope: '已配置种子或其地址簿发现的设备；当前目录未读取成功', status: target.networkOnline === false ? 'offline' : error.status, observedAt: null, diagnostics: [error.message] } };
    }
    const manifest = manifestResult.value;
    const nativeId = string(manifest.node_id);
    if (!nativeId || !Array.isArray(manifest.services)) {
      // Treat malformed manifests as failures without silently producing an empty catalog.
      const cached = this.previous.get(target.url);
      if (cached) {
        const stale = Date.parse(now) - Date.parse(cached.node.observedAt ?? '') > this.config.staleAfterMs;
        return { node: { ...cached.node, online: null, status: stale ? 'stale' : 'partial' }, services: cached.services.map(service => ({ ...service, status: 'unknown', skillsStatus: 'stale' })), source: { ...cached.source, status: stale ? 'stale' : 'partial', diagnostics: ['manifest 缺少 node_id 或 services 数组；保留上次成功目录，当前可用性未知'] } };
      }
      return { node: { id: `node:${target.nativeId || target.url}`, nativeId: target.nativeId || target.url, name: target.name || target.url, address: target.url, platform: target.platform || 'unknown', catalogAvailable: false, networkOnline: target.networkOnline ?? null, online: null, status: 'partial', observedAt: now, serviceIds: [], agentStatus: 'unknown', evidence: [{ sourceId, observedAt: now, note: '来源 manifest 字段不完整' }] }, services: [], source: { id: sourceId, name: target.name || target.url, kind: 'node', status: 'partial', scope: 'manifest 格式不完整，未统计能力', observedAt: now, url: target.url, diagnostics: ['manifest 缺少 node_id 或 services 数组'] } };
    }
    const nodeId = `node:${nativeId}`; const diagnostics: string[] = [];
    if (healthResult.status === 'rejected') diagnostics.push(`网关探活：${failure(healthResult.reason).message}`);
    const services = manifest.services.map(value => projectService(value, nodeId, sourceId, now, this.config.staleAfterMs)).filter((value): value is ServiceView => Boolean(value));
    if (services.length !== manifest.services.length) diagnostics.push('部分服务缺少身份字段，已跳过');
    if (services.some(service => service.observedAt && (!Number.isFinite(Date.parse(service.observedAt)) || Date.parse(now) - Date.parse(service.observedAt) > this.config.staleAfterMs))) diagnostics.push('部分服务探活证据过期或时间无效，可用性显示未知');
    const skillService = services.find(service => service.nativeId === 'dreammate-skill-manager');
    if (skillService) {
      const skills = new Map<string, { id: string; name: string; description: string; revision?: string }>();
      let complete = true; let pageObserved = false; let skillDiagnostics = false;
      skillService.skillsStatus = 'unknown'; skillService.skillsObservedAt = null;
      try {
        let offset = 0;
        for (let page = 0; page < this.config.maxPages; page++) {
          const data = await readJson(`${target.url}/skills?limit=200&offset=${offset}`, this.config.timeoutMs);
          if (!Array.isArray(data.skills)) throw new Error('技能目录缺少 skills 数组');
          pageObserved = true;
          for (const skill of data.skills) { const row = object(skill); const id = string(row.id); if (id) skills.set(id, { id, name: string(row.name, id), description: string(row.description), revision: string(row.revision) || undefined }); }
          for (const diagnostic of array(data.diagnostics)) { skillDiagnostics = true; diagnostics.push(`技能目录：${string(object(diagnostic).message, '存在扫描诊断，目录可能不完整')}`); }
          if (data.has_more !== true) break;
          if (page === this.config.maxPages - 1) { diagnostics.push('技能目录达到分页上限，部分覆盖'); complete = false; break; }
          if (typeof data.next_offset !== 'number' || data.next_offset <= offset) throw new Error('技能目录分页未前进');
          offset = data.next_offset;
        }
        skillService.skillsStatus = complete && !skillDiagnostics ? 'ok' : 'partial';
      } catch (error) {
        complete = false; skillService.skillsStatus = pageObserved ? 'partial' : failure(error).status;
        diagnostics.push(`技能目录：${failure(error).message}；已读部分保留，不能视为零技能`);
      }
      if (!complete) {
        const cached = this.previous.get(target.url)?.services.find(service => service.nativeId === skillService.nativeId);
        if (cached && cached.skillsObservedAt) {
          for (const skill of cached.skills) if (!skills.has(skill.id)) skills.set(skill.id, skill);
          if (!pageObserved) { skillService.skillsStatus = 'stale'; skillService.skillsObservedAt = cached.skillsObservedAt; }
          diagnostics.push(`技能目录含 ${cached.skillsObservedAt} 的缓存条目，未完整核验`);
        }
      }
      if (pageObserved) skillService.skillsObservedAt = now;
      skillService.skills = [...skills.values()];
    }
    const metadata = object(manifest.metadata);
    const result: NodeResult = { node: { id: nodeId, nativeId, name: string(manifest.name, nativeId), address: target.url, platform: string(manifest.type, 'unknown'), catalogAvailable: true, networkOnline: target.networkOnline ?? null, online: healthResult.status === 'fulfilled' && string(healthResult.value.node_id, nativeId) === nativeId ? true : null, status: diagnostics.length ? 'partial' : 'ok', observedAt: now, serviceIds: services.map(service => service.id), agentStatus: 'unknown', evidence: [{ sourceId, nativeId, observedAt: now, locator: `${target.url}/manifest`, note: '直接读取该 Node 的公开目录；角色忙闲未接入' }] }, services, source: { id: sourceId, name: string(manifest.name, nativeId), kind: 'node', status: diagnostics.length ? 'partial' : 'ok', scope: '该网关当前可见申报服务与技能目录；不含全网调用台账', observedAt: now, url: target.url, version: string(metadata.protocol_version) || undefined, diagnostics } };
    this.previous.set(target.url, structuredClone(result)); return result;
  }
}
