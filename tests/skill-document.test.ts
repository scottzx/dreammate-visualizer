import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { readSkillDocument, SkillDocumentError } from '../src/adapters/skills';
import { createDemoSnapshot } from '../src/observer/demo';
import { parseConfig } from '../src/observer/config';
import type { Observer } from '../src/observer/index';
import type { ObserverSnapshot, SkillDocumentView } from '../src/read-model/types';
import { createObserverServer } from '../src/server/index';
import { containsIpAddress } from '../src/read-model/ip-privacy';

const revision = 'a'.repeat(64), changedRevision = 'b'.repeat(64);
const skillId = 'fixture:skill';
const markdown = '---\nname: fixture\ndescription: Full guide\n---\n\n# 完整指南\n\n## 工作流程\n\n1. 整理资料。\n2. 完成交付。\n\n```sh\necho "127.0.0.1"\n```\n\n最后一行完整保留。\n';
async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
function liveSnapshot(origin: string): ObserverSnapshot {
  const data = createDemoSnapshot(); data.mode = 'live';
  const node = { ...data.nodes[0], id: 'node:127.0.0.1', nativeId: 'fixture-node', address: origin };
  const service = { ...data.services[0], id: `${node.id}/service/dreammate-skill-manager`, nativeId: 'dreammate-skill-manager', nodeId: node.id,
    skills: [{ id: skillId, name: 'Fixture skill', description: '目录摘要', revision }] };
  data.nodes = [node]; data.services = [service];
  return data;
}
function observer(data: ObserverSnapshot): Observer {
  return { config: parseConfig({ timeoutMs: 2000 }, {}), peek: () => data, snapshot: async () => data };
}
function fixtureGateway() {
  const requests: string[] = [];
  let responseStatus = 200, nodeId = 'fixture-node';
  let document: Record<string, unknown> = { id: skillId, name: 'Fixture skill', revision, resource: 'SKILL.md', encoding: 'utf8', content: markdown, resources: [{ path: 'scripts/unsafe.sh', bytes: 100 }] };
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`); res.setHeader('content-type', 'application/json');
    if (req.url === '/manifest') res.end(JSON.stringify({ node_id: nodeId, services: [{ id: 'dreammate-skill-manager' }] }));
    else if (req.url?.startsWith('/skills/')) { res.writeHead(responseStatus); res.end(JSON.stringify(document)); }
    else { res.writeHead(404); res.end('{}'); }
  });
  return { server, requests, setDocument(value: Record<string, unknown>) { document = { ...document, ...value }; }, setStatus(value: number) { responseStatus = value; }, setNodeId(value: string) { nodeId = value; } };
}
function query(service: { id: string; skills: { id: string; revision?: string }[] }, mode = 'live') {
  const params = new URLSearchParams({ mode, serviceId: service.id, skillId: service.skills[0].id });
  if (service.skills[0].revision) params.set('revision', service.skills[0].revision);
  return params;
}

test('Skill document API maps published service IDs back to the observed node and returns the whole guide with IP privacy', async () => {
  const gateway = fixtureGateway(), origin = await listen(gateway.server);
  const data = liveSnapshot(origin), server = createObserverServer(observer(data)), base = await listen(server);
  try {
    const published = await (await fetch(`${base}/api/snapshot`)).json() as ObserverSnapshot;
    assert.notEqual(published.services[0].id, data.services[0].id, 'an IP-bearing service identity is opaque in the browser');
    const response = await fetch(`${base}/api/skill?${query(published.services[0])}`);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const document = await response.json() as SkillDocumentView;
    assert.equal(document.skillId, skillId); assert.equal(document.name, 'Fixture skill');
    assert.equal(document.revision, revision);
    assert.ok(document.markdown.startsWith('---\nname: fixture'));
    assert.ok(document.markdown.endsWith('最后一行完整保留。\n'));
    assert.ok(document.markdown.includes('```sh\necho "[IP 已隐藏]"\n```'));
    assert.equal(containsIpAddress(JSON.stringify(document)), false);
    assert.deepEqual(Object.keys(document).sort(), ['markdown', 'name', 'revision', 'skillId']);
    assert.deepEqual(gateway.requests, ['GET /manifest', `GET /skills/${encodeURIComponent(skillId)}?revision=${revision}`]);

    const rawReference = await fetch(`${base}/api/skill?${query(data.services[0])}`);
    assert.equal(rawReference.status, 404, 'only the published reference can select a source');
    assert.equal(gateway.requests.length, 2, 'unknown references never issue an upstream read');
  } finally { await close(server); await close(gateway.server); }
});

test('same-ID Skill documents on different devices keep their selected source across snapshot reordering', async () => {
  const firstGateway = fixtureGateway(), secondGateway = fixtureGateway();
  secondGateway.setNodeId('second-node');
  secondGateway.setDocument({ name: 'Second owner', content: '# 第二台设备的完整指南\n\n只属于第二台设备。\n' });
  const firstOrigin = await listen(firstGateway.server), secondOrigin = await listen(secondGateway.server);
  const data = liveSnapshot(firstOrigin);
  const node = { ...data.nodes[0], id: 'node:127.0.0.2', nativeId: 'second-node', address: secondOrigin };
  data.nodes.push(node);
  data.services.push({ ...data.services[0], id: `${node.id}/service/dreammate-skill-manager`, nodeId: node.id });
  const server = createObserverServer(observer(data)), base = await listen(server);
  try {
    const published = await (await fetch(`${base}/api/snapshot`)).json() as ObserverSnapshot;
    const params = query(published.services[1]);
    data.services.reverse(); data.nodes.reverse();
    const response = await fetch(`${base}/api/skill?${params}`);
    assert.equal(response.status, 200);
    const document = await response.json() as SkillDocumentView;
    assert.equal(document.name, 'Second owner');
    assert.equal(document.markdown, '# 第二台设备的完整指南\n\n只属于第二台设备。\n');
    assert.equal(firstGateway.requests.length, 0);
    assert.deepEqual(secondGateway.requests, ['GET /manifest', `GET /skills/${encodeURIComponent(skillId)}?revision=${revision}`]);
  } finally { await close(server); await close(firstGateway.server); await close(secondGateway.server); }
});

test('Skill document requests cannot supply paths, resources, URLs or methods, or mutate services', async () => {
  const data = createDemoSnapshot(); let snapshots = 0;
  const mock = observer(data); mock.snapshot = async () => { snapshots++; return data; };
  const server = createObserverServer(mock), base = await listen(server);
  const params = query(data.services.find(service => service.skills.length)!, 'demo');
  try {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal((await fetch(`${base}/api/skill?${params}`, { method })).status, 405);
    for (const extra of ['url=http://127.0.0.1:1234', 'path=/etc/passwd', 'resource=scripts/run.sh', 'method=execute', 'mode=demo'])
      assert.equal((await fetch(`${base}/api/skill?${params}&${extra}`)).status, 400);
    for (const suffix of ['', '?mode=unknown', '?mode=live&serviceId=x&skillId=', '?serviceId=x&skillId=%00'])
      assert.equal((await fetch(`${base}/api/skill${suffix}`)).status, 400);
    assert.equal(snapshots, 0, 'invalid requests are rejected before collecting or reading');
  } finally { await close(server); }
});

test('demo Skill documents are complete labeled examples and never need a real node endpoint', async () => {
  const data = createDemoSnapshot(), service = data.services.find(item => item.skills.length)!;
  const document = await readSkillDocument(data, { timeoutMs: 2000 }, { serviceId: service.id, skillId: service.skills[0].id, revision: service.skills[0].revision });
  assert.ok(document.markdown.startsWith('---\nname: '));
  assert.ok(document.markdown.includes('演示 SKILL.md'));
  assert.ok(document.markdown.includes('## 工作流程'));
  assert.ok(document.markdown.endsWith('此示例只用于观察界面，不会执行技能或访问真实设备。\n'));
  const server = createObserverServer(observer(data)), base = await listen(server);
  try {
    const response = await fetch(`${base}/api/skill?${query(service, 'demo')}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), document);
  } finally { await close(server); }
});

test('Skill document reading checks catalogue revision, node identity and returned guide identity', async () => {
  const gateway = fixtureGateway(), origin = await listen(gateway.server), data = liveSnapshot(origin);
  const request = { serviceId: data.services[0].id, skillId, revision };
  const expectStatus = async (status: number) => assert.rejects(readSkillDocument(data, { timeoutMs: 2000 }, request), error => error instanceof SkillDocumentError && error.status === status);
  try {
    await assert.rejects(readSkillDocument(data, { timeoutMs: 2000 }, { ...request, revision: changedRevision }), error => error instanceof SkillDocumentError && error.status === 409);
    assert.equal(gateway.requests.length, 0, 'stale catalogue versions are rejected before contacting any node');
    gateway.setNodeId('replacement-node');
    await expectStatus(409);
    assert.deepEqual(gateway.requests, ['GET /manifest'], 'replaced devices cannot receive a document read');
    gateway.setNodeId('fixture-node'); gateway.setDocument({ id: 'another-skill' });
    await expectStatus(409);
    gateway.setDocument({ id: skillId, revision: changedRevision }); await expectStatus(409);
    gateway.setDocument({ revision, resource: 'scripts/run.sh' }); await expectStatus(503);
    gateway.setDocument({ resource: 'references/details.md' }); await expectStatus(503);
    gateway.setDocument({ resource: 'SKILL.remote.md', content: markdown });
    assert.equal((await readSkillDocument(data, { timeoutMs: 2000 }, request)).markdown, markdown, 'the provider-selected remote guide is a valid full entry');
    gateway.setDocument({ encoding: 'base64' }); await expectStatus(503);
    gateway.setDocument({ encoding: 'utf8', truncated: true }); await expectStatus(503);
  } finally { await close(gateway.server); }
});

test('Skill document failures preserve not-found, changed-source and unavailable states', async () => {
  const gateway = fixtureGateway(), origin = await listen(gateway.server), data = liveSnapshot(origin);
  const server = createObserverServer(observer(data)), base = await listen(server);
  try {
    const published = await (await fetch(`${base}/api/snapshot`)).json() as ObserverSnapshot;
    const params = query(published.services[0]);
    for (const status of [404, 409, 503]) {
      gateway.setStatus(status);
      const response = await fetch(`${base}/api/skill?${params}`);
      assert.equal(response.status, status);
      const error = await response.json() as { error: string };
      assert.ok(error.error); assert.equal(containsIpAddress(JSON.stringify(error)), false);
    }
    const previousRequests = gateway.requests.length;
    params.set('revision', changedRevision);
    assert.equal((await fetch(`${base}/api/skill?${params}`)).status, 409);
    assert.equal(gateway.requests.length, previousRequests);
    data.services[0].nativeId = 'other-service'; params.set('revision', revision);
    assert.equal((await fetch(`${base}/api/skill?${params}`)).status, 503, 'embedded declarations cannot select an unrelated provider');
    assert.equal(gateway.requests.length, previousRequests);
  } finally { await close(server); await close(gateway.server); }
});
