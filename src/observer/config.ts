import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isIP } from 'node:net';
import { array, object, string } from '../adapters/http';
import type { ProjectCategory } from '../read-model/types';

export interface AcpSourceConfig {
  id: string; name?: string; originSessionId: string; url?: string; nodeUrl?: string; serviceId?: string; jobId?: string;
}
export interface LocalProjectConfig { id: string; name: string; path: string; category: ProjectCategory }
export interface TailscaleConfig { binary: string; centralRelayRegion?: string; centralRelayNodeId?: string }
export interface SessionSourceConfig {
  enabled: boolean; command: string; scope: string; sinceHours: number;
  maxSessions: number; maxTurns: number; maxCalls: number; timeoutMs: number;
}
export const DEFAULT_SESSION_SOURCE: SessionSourceConfig = {
  enabled: false, command: '1session', scope: '~', sinceHours: 24, maxSessions: 12, maxTurns: 8, maxCalls: 24, timeoutMs: 6000,
};
export interface ObserverConfig {
  listenHosts: string[];
  nodeUrls: string[]; timeoutMs: number; refreshIntervalMs: number; staleAfterMs: number;
  localNodeId?: string;
  localProjects: LocalProjectConfig[];
  sessions: SessionSourceConfig;
  tailscale?: TailscaleConfig;
  maxNodes: number; maxPages: number; acpSources: AcpSourceConfig[]; diagnostics: string[];
}
const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function baseUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('来源地址必须是无凭据、无路径的 HTTP(S) 网关地址');
  return url.origin;
}

export function parseConfig(value: unknown, env: NodeJS.ProcessEnv = process.env): ObserverConfig {
  const input = object(value); const diagnostics: string[] = [];
  const rawHosts: unknown = env.OBSERVER_HOST !== undefined ? [env.OBSERVER_HOST] : input.listenHosts ?? ['127.0.0.1'];
  if (!Array.isArray(rawHosts) || rawHosts.length === 0 || rawHosts.length > 8) throw new Error('listenHosts 必须包含 1–8 个监听地址');
  const listenHosts = [...new Set(rawHosts.map(host => {
    if (typeof host !== 'string' || (!isIP(host.trim()) && host.trim() !== 'localhost')) throw new Error('listenHosts 必须是有效 IP 地址或 localhost');
    return host.trim();
  }))];
  const candidates = env.DREAMMATE_NODE_URL ? [env.DREAMMATE_NODE_URL] : array(input.nodeUrls).length ? array(input.nodeUrls) : ['http://127.0.0.1:36908'];
  const nodeUrls = candidates.flatMap(candidate => { try { return [baseUrl(string(candidate))]; } catch { diagnostics.push('已跳过格式无效的 Node 来源地址'); return []; } });
  const acpSources = array(input.acpSources).flatMap((value, index): AcpSourceConfig[] => {
    const source = object(value); const originSessionId = string(source.originSessionId).trim();
    if (!originSessionId) { diagnostics.push(`ACP 来源 ${index + 1} 未配置明确 originSessionId，未读取`); return []; }
    try {
      const url = source.url ? baseUrl(string(source.url)) : undefined;
      const nodeUrl = source.nodeUrl ? baseUrl(string(source.nodeUrl)) : undefined;
      if (!url && (!nodeUrl || !string(source.serviceId))) throw new Error('缺少来源入口');
      return [{ id: string(source.id, `acp-${index + 1}`), name: string(source.name) || undefined, originSessionId, url, nodeUrl, serviceId: string(source.serviceId) || undefined, jobId: string(source.jobId) || undefined }];
    } catch { diagnostics.push(`ACP 来源 ${index + 1} 地址无效或入口不完整，未读取`); return []; }
  });
  const unique = new Set<string>();
  for (const source of acpSources) { if (unique.has(source.id)) throw new Error(`ACP 配置 id 重复：${source.id}`); unique.add(source.id); }
  const localProjects = array(input.localProjects).slice(0, 24).flatMap((value, index): LocalProjectConfig[] => {
    const project = object(value), id = string(project.id).trim(), directory = string(project.path).trim();
    if (!id || !path.isAbsolute(directory) || path.resolve(directory) === path.parse(directory).root) {
      diagnostics.push(`本机项目 ${index + 1} 缺少 id 或明确的项目绝对目录，未扫描`); return [];
    }
    if (unique.has(`project:${id}`)) throw new Error(`本机项目配置 id 重复：${id}`);
    unique.add(`project:${id}`);
    const category = project.category === 'business-agent' || project.category === 'perception' ? project.category : 'other';
    return [{ id, name: string(project.name, id), path: path.resolve(directory), category }];
  });
  if (localProjects.length && !string(input.localNodeId).trim()) diagnostics.push('本机项目未绑定 localNodeId，不读取目录大小');
  const sessions = parseSessionSource(input.sessions, diagnostics);
  const network = object(input.tailscale);
  const tailscale = input.tailscale ? { binary: string(network.binary, 'tailscale'), centralRelayRegion: string(network.centralRelayRegion) || undefined,
    centralRelayNodeId: string(network.centralRelayNodeId) || undefined } : undefined;
  return { localNodeId: string(input.localNodeId).trim() || undefined, localProjects, sessions, tailscale, listenHosts, nodeUrls: [...new Set(nodeUrls)], timeoutMs: bounded(input.timeoutMs, 3000, 300, 10000), refreshIntervalMs: bounded(input.refreshIntervalMs, 180000, 3000, 600000), staleAfterMs: bounded(input.staleAfterMs, 540000, 5000, 600000), maxNodes: bounded(input.maxNodes, 24, 1, 100), maxPages: bounded(input.maxPages, 5, 1, 20), acpSources, diagnostics };
}

/** Session reading is opt-in; every field is bounded and the command is never shell-expanded. */
function parseSessionSource(value: unknown, diagnostics: string[]): SessionSourceConfig {
  if (value === undefined) return { ...DEFAULT_SESSION_SOURCE };
  if (value === true) return { ...DEFAULT_SESSION_SOURCE, enabled: true };
  const input = object(value);
  const enabled = input.enabled === true;
  const command = string(input.command, DEFAULT_SESSION_SOURCE.command).trim();
  const scope = string(input.scope, DEFAULT_SESSION_SOURCE.scope).trim();
  const commandValid = command.length > 0 && command.length <= 512 && !command.includes('\0');
  const scopeValid = scope.length > 0 && scope.length <= 1024 && !scope.includes('\0');
  if (!commandValid) diagnostics.push('会话来源命令无效，未启用本地会话读取');
  if (!scopeValid) diagnostics.push('会话来源 scope 无效，已回退到 ~');
  return {
    enabled: enabled && commandValid,
    command: commandValid ? command : DEFAULT_SESSION_SOURCE.command,
    scope: scopeValid ? scope : DEFAULT_SESSION_SOURCE.scope,
    sinceHours: bounded(input.sinceHours, DEFAULT_SESSION_SOURCE.sinceHours, 1, 168),
    maxSessions: bounded(input.maxSessions, DEFAULT_SESSION_SOURCE.maxSessions, 1, 50),
    maxTurns: bounded(input.maxTurns, DEFAULT_SESSION_SOURCE.maxTurns, 1, 30),
    maxCalls: bounded(input.maxCalls, DEFAULT_SESSION_SOURCE.maxCalls, 1, 200),
    timeoutMs: bounded(input.timeoutMs, DEFAULT_SESSION_SOURCE.timeoutMs, 1000, 15_000),
  };
}

export async function loadConfig(): Promise<ObserverConfig> {
  const configPath = path.resolve(process.env.OBSERVER_CONFIG ?? 'observer.config.json');
  try { return parseConfig(JSON.parse(await readFile(configPath, 'utf8'))); }
  catch (error) {
    if (object(error).code === 'ENOENT') return parseConfig({});
    throw new Error(`无法读取观察配置 ${configPath}：${error instanceof Error ? error.message : '格式无效'}`);
  }
}
