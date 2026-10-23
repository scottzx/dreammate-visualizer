import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { NodeView, ProjectStorageView, ProjectView, SourceView } from '../read-model/types';
import type { ObserverConfig } from '../observer/config';

const runFile = promisify(execFile);
const SOURCE_ID = 'projects:observer-directories';
const CACHE_MS = 60_000;

/** Allocated blocks, including dependencies/builds. du does not follow child symlinks. */
export async function readDirectoryStorage(directory: string): Promise<number> {
  if (process.platform !== 'darwin' && process.platform !== 'linux') throw new Error('当前系统尚未接入项目目录存储统计');
  const { stdout } = await runFile('/usr/bin/du', ['-skx', directory], { timeout: 6000, maxBuffer: 64 * 1024, encoding: 'utf8' });
  const match = /^(\d+)\s/.exec(stdout);
  const bytes = match ? Number(match[1]) * 1024 : NaN;
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('目录大小结果无效');
  return bytes;
}

export class LocalProjectsAdapter {
  private cached?: { at: number; projects: ProjectView[]; source: SourceView };
  constructor(private readonly config: ObserverConfig, private readonly measure = readDirectoryStorage) {}

  async read(nodes: NodeView[], now = new Date().toISOString()): Promise<{ projects: ProjectView[]; source: SourceView }> {
    const definitions = this.config.localProjects ?? [];
    const local = nodes.find(node => node.nativeId === this.config.localNodeId);
    const source: SourceView = { id: SOURCE_ID, name: '项目存储占用', kind: 'projects', status: 'unknown', observedAt: null,
      scope: '仅显式绑定本机 Node 的项目目录；不代表全设备项目清单或当前执行状态', diagnostics: [] };
    if (!local || !definitions.length) {
      source.diagnostics.push(!local ? '未取得与 localNodeId 匹配的设备身份，未扫描本机目录' : '没有配置项目目录；各星球的项目占比保持未知灰色');
      return { projects: [], source };
    }
    if (this.cached && Date.parse(now) - this.cached.at < CACHE_MS) return structuredClone(this.cached);
    const cwdDevice = await stat(process.cwd()).then(info => info.dev).catch(() => undefined);
    const roots = await Promise.all(definitions.map(async definition => {
      try {
        const resolved = await realpath(definition.path), info = await stat(resolved);
        if (!info.isDirectory()) throw new Error('配置路径不是目录');
        if (info.dev !== cwdDevice) throw new Error('目录位于另一文件系统，未与本机存储口径混算');
        return { ...definition, resolved, error: '' };
      } catch (error) { return { ...definition, resolved: '', error: error instanceof Error && !('code' in error) ? error.message : '目录不可读取或不存在' }; }
    }));
    for (const root of roots) if (root.resolved && roots.some(other => other !== root && other.resolved &&
      (root.resolved === other.resolved || root.resolved.startsWith(`${other.resolved}${path.sep}`) || other.resolved.startsWith(`${root.resolved}${path.sep}`)))) {
      root.error = '配置目录存在重复或父子重叠，未计入占比';
    }
    const projects: ProjectView[] = [];
    // Bound traversal concurrency; every command has its own six-second deadline.
    for (let index = 0; index < roots.length; index += 2) {
      projects.push(...await Promise.all(roots.slice(index, index + 2).map(async root => {
        let bytes: number | null = null, note = root.error;
        if (!note) try { bytes = await this.measure(root.resolved); }
        catch { note = '目录占用读取失败、无权限或超时；不使用部分结果'; }
        if (bytes !== null && (!Number.isSafeInteger(bytes) || bytes < 0)) { bytes = null; note = '目录大小无效，未计入占比'; }
        const storage: ProjectStorageView = { nodeId: local.id, category: root.category, bytes,
          status: bytes === null ? 'unavailable' : 'ok', observedAt: bytes === null ? null : now,
          source: 'observer-directory', metric: 'allocated-disk-bytes', path: root.resolved || root.path, note };
        if (note) source.diagnostics.push(`${root.name}：${note}`);
        return { id: `local:project:${root.id}`, name: root.name, nodeIds: [local.id], sessionCount: null, providers: [],
          status: storage.status, observedAt: storage.observedAt, storage: [storage],
          evidence: [{ sourceId: SOURCE_ID, observedAt: now, locator: `observer://project/${encodeURIComponent(root.id)}`,
            note: note || '只读统计配置目录的已分配磁盘块，含依赖、构建和隐藏文件；未读取文件内容，未据此判断项目正在执行' }] } satisfies ProjectView;
      })));
    }
    source.status = projects.every(project => project.status === 'ok') ? 'ok' : 'partial';
    source.observedAt = now;
    source.diagnostics.push('目录统计每60秒更新；APFS 克隆及跨目录硬链接可能共享块，不代表可回收的物理空间。其余容量保持未归属灰色，不等同于空闲空间。');
    this.cached = { at: Date.parse(now), projects, source };
    return { projects, source };
  }
}
