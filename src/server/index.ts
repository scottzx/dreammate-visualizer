import { createServer, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createObserver, type Observer } from '../observer/index';
import { loadConfig } from '../observer/config';
import { redactSnapshot } from './privacy';
import { redactIpText } from '../read-model/ip-privacy';
import { readSkillDocument, SkillDocumentError } from '../adapters/skills';

const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json' };
function json(res: ServerResponse, status: number, data: unknown) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(data)); }

export function createObserverServer(observer: Observer, staticDirectory = path.resolve('dist')) {
  return createServer((req, res) => { void (async () => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('allow', 'GET, HEAD'); return json(res, 405, { error: '观察接口仅支持读取' }); }
      if (url.pathname === '/api/health') return json(res, 200, { status: 'ok', service: 'dreammate-visualizer-observer', version: '0.1.0', readOnly: true, generatedAt: observer.peek()?.generatedAt ?? null });
      if (url.pathname === '/api/snapshot') {
        const mode = url.searchParams.get('mode') ?? 'live';
        if (mode !== 'live' && mode !== 'demo') return json(res, 400, { error: 'mode 必须是 live 或 demo' });
        const snapshot = await observer.snapshot(mode, url.searchParams.get('refresh') === '1');
        return json(res, 200, redactSnapshot(snapshot));
      }
      if (url.pathname === '/api/skill') {
        const allowed = new Set(['mode', 'serviceId', 'skillId', 'revision']);
        for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1)
          return json(res, 400, { error: 'Skill 接口仅接受 mode、serviceId、skillId 与 revision。' });
        const mode = url.searchParams.get('mode') ?? 'live';
        if (mode !== 'live' && mode !== 'demo') return json(res, 400, { error: 'mode 必须是 live 或 demo' });
        const serviceId = url.searchParams.get('serviceId'), skillId = url.searchParams.get('skillId');
        const revision = url.searchParams.get('revision') ?? undefined;
        if (!serviceId || serviceId.length > 4096 || serviceId.includes('\0') || !skillId || skillId.length > 256 || skillId.includes('\0') || (revision !== undefined && (!revision || revision.length > 128 || revision.includes('\0'))))
          return json(res, 400, { error: '需要有效的 serviceId、skillId 与可选 revision。' });
        const snapshot = await observer.snapshot(mode);
        if (snapshot.mode !== mode) return json(res, 503, { error: 'Skill 数据模式不匹配，请重试。' });
        const published = redactSnapshot(snapshot);
        const serviceIndex = published.services.findIndex(service => service.id === serviceId);
        const skillIndex = published.services[serviceIndex]?.skills.findIndex(skill => skill.id === skillId) ?? -1;
        if (serviceIndex < 0 || skillIndex < 0) return json(res, 404, { error: '该 Skill 不在当前可见目录中。' });
        const publicSkill = published.services[serviceIndex].skills[skillIndex];
        if (revision !== undefined && revision !== publicSkill.revision)
          return json(res, 409, { error: 'Skill 版本已变化，请刷新能力目录后重试。' });
        const service = snapshot.services[serviceIndex], skill = service.skills[skillIndex];
        try {
          const document = await readSkillDocument(snapshot, observer.config, { serviceId: service.id, skillId: skill.id, revision: skill.revision });
          return json(res, 200, { skillId, name: redactIpText(document.name), revision: document.revision && redactIpText(document.revision), markdown: redactIpText(document.markdown) });
        } catch (error) {
          if (error instanceof SkillDocumentError) return json(res, error.status, { error: redactIpText(error.message) });
          throw error;
        }
      }
      if (url.pathname.startsWith('/api/')) return json(res, 404, { error: '观察接口不存在' });
      let filePath = path.resolve(staticDirectory, `.${decodeURIComponent(url.pathname)}`);
      if (filePath !== staticDirectory && !filePath.startsWith(`${staticDirectory}${path.sep}`)) return json(res, 403, { error: '无效路径' });
      try { if (!(await stat(filePath)).isFile()) filePath = path.join(staticDirectory, 'index.html'); }
      catch { filePath = path.join(staticDirectory, 'index.html'); }
      let content: Buffer;
      try { content = await readFile(filePath); } catch { return json(res, 404, { error: '页面尚未构建，请运行 npm run build 或使用 npm run dev' }); }
      res.writeHead(200, { 'content-type': mime[path.extname(filePath)] ?? 'application/octet-stream', 'cache-control': path.extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) { console.error('[observer]', error instanceof Error ? redactIpText(error.message) : '读取失败'); if (!res.headersSent) json(res, 503, { error: '观察快照暂时不可用，未将失败解释为空数据' }); else res.end(); }
  })(); });
}

export async function listenObserverServers(observer: Observer, hosts: string[], port: number, staticDirectory?: string): Promise<Server[]> {
  const servers: Server[] = [];
  let listenPort = port;
  try {
    for (const host of [...new Set(hosts)]) {
      const server = createObserverServer(observer, staticDirectory);
      servers.push(server);
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(listenPort, host, () => { server.off('error', reject); resolve(); });
      });
      const address = server.address();
      if (listenPort === 0 && address && typeof address !== 'string') listenPort = address.port;
    }
    return servers;
  } catch (error) {
    await Promise.all(servers.filter(server => server.listening).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    throw error;
  }
}

async function main() {
  const config = await loadConfig(); const observer = createObserver(config);
  const port = Number(process.env.OBSERVER_PORT ?? 4318);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('OBSERVER_PORT 无效');
  const servers = await listenObserverServers(observer, config.listenHosts, port);
  console.log(`DreamMate 只读观察服务已启动（端口 ${port}，${servers.length} 个监听地址）`);
  void observer.snapshot().catch(error => console.error('[observer] 首次采集失败', error instanceof Error ? redactIpText(error.message) : '采集失败'));
  const timer = setInterval(() => { void observer.snapshot('live', true).catch(error => console.error('[observer] 刷新失败', error instanceof Error ? redactIpText(error.message) : '采集失败')); }, config.refreshIntervalMs); timer.unref();
  const close = () => {
    clearInterval(timer);
    void Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve())))).then(() => process.exit(0));
  };
  process.once('SIGINT', close); process.once('SIGTERM', close);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void main().catch(error => { console.error(error instanceof Error ? redactIpText(error.message) : '启动失败'); process.exitCode = 1; });
