import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SESSION_SOURCE_ID, SessionAdapter, parseSessionList, parseSessionProjects, parseSessionTurns,
  safeSessionError, sessionCallStatus, type SessionCommandRunner,
} from '../src/adapters/sessions';
import { parseConfig } from '../src/observer/config';
import { voyageProjectId } from '../src/read-model/voyages';
import type { NodeView, ServiceView } from '../src/read-model/types';

const NOW = '2026-10-22T10:00:00.000Z';
const WORKSPACE = '/Users/scott/Documents/01-开发项目/1agents/dreammate-visualizer';
const ACP_WORKSPACE = '/Users/scott/Documents/01-开发项目/1agents/1acp';

const node = (id: string, nativeId: string, name: string): NodeView => ({
  id, nativeId, name, address: '127.0.0.1', platform: 'macos', online: true,
  status: 'ok', observedAt: NOW, serviceIds: [], agentStatus: 'unknown', evidence: [],
});
const service = (id: string, nativeId: string, nodeId: string, name: string): ServiceView => ({
  id, nativeId, nodeId, name, description: '', kind: 'generic', status: 'up', observedAt: NOW,
  methods: [], skills: [], sharing: 'network', evidence: [],
});
const nodes = [node('node-local', 'local-native', 'scott-mac'), node('node-remote', 'remote-native', 'scott-pc-1')];
const services = [
  service('node-local/service/asr', 'asr', 'node-local', '端侧语音'),
  service('node-remote/service/paint', 'paint', 'node-remote', '绘画数据'),
];
const context = { nodes, services, now: NOW };

const config = (sessions: Record<string, unknown> = {}) => parseConfig({
  localNodeId: 'local-native',
  sessions: { enabled: true, command: '1session', ...sessions },
}, {});

const projectsOutput = {
  projects: [
    { id: 'git:github.com/scottzx/dreammate-visualizer', name: 'dreammate-visualizer', workspace: WORKSPACE, workspaces: [WORKSPACE] },
    { id: 'git:github.com/scottzx/1acp', name: '1ACP', workspace: ACP_WORKSPACE, workspaces: [ACP_WORKSPACE, `${ACP_WORKSPACE}/examples/activepieces/piece`] },
  ],
  total: 2,
};

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sess-a', provider: 'dsh', title: '绘画数据任务化', workspace: WORKSPACE,
    createdAt: '2026-10-22T08:00:00.000Z', updatedAt: '2026-10-22T09:58:00.000Z',
    path: '/Users/scott/.dsh/sessions/--Users-scott--/session.v4.jsonl.zstd', sizeBytes: 1024,
    ...overrides,
  };
}

const callFixture = (args: string, at: string, result = '{"content":[{"type":"text","text":"ok"}]}') => ({
  items: [
    { kind: 'tool_call', content: args, timestamp: at },
    { kind: 'tool_result', content: result, timestamp: at },
  ],
});

function fixtureRunner(handle: (args: string[]) => unknown) {
  const calls: string[][] = [];
  const run: SessionCommandRunner = async (command, args, timeoutMs) => {
    calls.push([command, ...args]);
    assert.equal(command, '1session');
    assert.ok(timeoutMs >= 1000 && timeoutMs <= 15_000);
    return JSON.stringify(handle(args)) ?? '{}';
  };
  return { run, calls };
}

test('full pipeline: projects, list, turns, turn and call fixtures become one voyage with stops', async () => {
  const turnDetails: Record<string, unknown> = {
    '1': { tools: [
      { id: 'call-paint-1', toolName: 'dreammate_invoke', status: 'completed' },
      { id: 'call-bash', toolName: 'bash', status: 'completed' },
      { id: 'call-paint-2', toolName: 'mcp__dreammate__invoke', status: 'completed' },
      { id: 'call-asr', toolName: 'dreammate_invoke', status: 'completed' },
    ] },
    '2': { tools: [
      { id: 'call-ghost', toolName: 'dreammate_inspect', status: 'completed' },
      { id: 'call-nodes', toolName: 'dreammate_list_nodes', status: 'completed' },
    ] },
  };
  const callDetails: Record<string, unknown> = {
    'call-paint-1': callFixture('{"node":"scott-pc-1","service_id":"paint","method":"paint.draw"}', '2026-10-22T08:11:00.000Z'),
    'call-paint-2': callFixture('{"node":"scott-pc-1","service_id":"paint","method":"paint.draw"}', '2026-10-22T08:12:00.000Z'),
    'call-asr': callFixture('{"service_id":"asr","method":"asr.transcribe"}', '2026-10-22T08:13:00.000Z'),
    'call-ghost': callFixture('{"node":"ghost-node","service_id":"ghost-service"}', '2026-10-22T09:02:00.000Z'),
    'call-nodes': callFixture('{"online_only":false}', '2026-10-22T09:03:00.000Z'),
  };
  const { run, calls } = fixtureRunner(args => {
    if (args[0] === 'projects') return projectsOutput;
    if (args[0] === 'list') return [session()];
    if (args[0] === 'turns') return [
      { no: 1, status: 'completed', toolCount: 3, startedAt: '2026-10-22T08:10:00.000Z', endedAt: '2026-10-22T08:20:00.000Z' },
      { no: 2, status: 'completed', toolCount: 2, startedAt: '2026-10-22T09:00:00.000Z', endedAt: '2026-10-22T09:10:00.000Z' },
    ];
    if (args[0] === 'turn' && args.includes('--call')) return callDetails[args[4]];
    if (args[0] === 'turn') return turnDetails[args[2]];
    throw new Error('unexpected command');
  });

  const adapter = new SessionAdapter(config(), run);
  const result = await adapter.read(context);

  assert.deepEqual(calls[0], ['1session', 'projects', '--limit', '40', '--json']);
  assert.deepEqual(calls[1], ['1session', 'list', '--scope', '~', '--since', '24h', '--limit', '12', '--json']);
  assert.deepEqual(calls[2], ['1session', 'turns', 'sess-a', '--json']);
  assert.equal(calls.length, 10, 'projects + list + turns + 2 turns + 5 call details');
  assert.equal(result.source.status, 'ok');
  assert.equal(result.source.id, SESSION_SOURCE_ID);
  assert.equal(result.source.kind, 'sessions');
  assert.equal(result.voyages.length, 1);

  const voyage = result.voyages[0];
  assert.equal(voyage.kind, 'session');
  assert.equal(voyage.provider, 'dsh');
  assert.equal(voyage.nativeId, 'sess-a');
  assert.equal(voyage.title, '绘画数据任务化');
  assert.equal(voyage.startedAt, '2026-10-22T08:00:00.000Z');
  assert.equal(voyage.updatedAt, '2026-10-22T09:58:00.000Z');
  assert.equal(voyage.status, 'active');
  assert.equal(voyage.projectId, voyageProjectId('git:github.com/scottzx/dreammate-visualizer'));
  assert.equal(voyage.projectName, 'dreammate-visualizer');
  assert.equal(voyage.originNodeId, 'node-local');
  assert.equal(voyage.mcpCalls, 5);
  assert.equal(voyage.stops.length, 4);

  const paint = voyage.stops[0];
  assert.equal(paint.nodeId, 'node-remote');
  assert.equal(paint.serviceId, 'node-remote/service/paint');
  assert.equal(paint.method, 'paint.draw');
  assert.equal(paint.calls, 2, 'consecutive calls to the same target are one stop');
  assert.equal(paint.at, '2026-10-22T08:12:00.000Z');
  assert.equal(paint.status, 'ok');
  assert.equal(paint.resolved, true);

  const asr = voyage.stops[1];
  assert.equal(asr.nodeId, 'node-local');
  assert.equal(asr.serviceId, 'node-local/service/asr');
  assert.equal(asr.method, 'asr.transcribe');
  assert.equal(asr.calls, 1);

  const ghost = voyage.stops[2];
  assert.equal(ghost.nodeId, undefined);
  assert.equal(ghost.serviceId, undefined);
  assert.equal(ghost.nodeLabel, 'ghost-node');
  assert.equal(ghost.serviceLabel, 'ghost-service');
  assert.equal(ghost.resolved, false);

  const gateway = voyage.stops[3];
  assert.equal(gateway.toolName, 'dreammate_list_nodes');
  assert.equal(gateway.nodeId, 'node-local');
  assert.equal(voyage.destinationNodeId, 'node-local');
  assert.equal(voyage.destinationLabel, 'scott-mac');

  assert.ok(!JSON.stringify(voyage).includes('/Users/'), 'no absolute workspace path may be published');
});

test('recognizes direct and mcp__dreammate__ tool names while ignoring other tools', async () => {
  const { run, calls } = fixtureRunner(args => {
    if (args[0] === 'projects') return projectsOutput;
    if (args[0] === 'list') return [session()];
    if (args[0] === 'turns') return [{ no: 1, toolCount: 4, startedAt: '2026-10-22T08:10:00.000Z' }];
    if (args[0] === 'turn' && args.includes('--call')) {
      const details: Record<string, unknown> = {
        'call-direct': callFixture('{"node":"scott-pc-1","service_id":"paint"}', '2026-10-22T08:11:00.000Z'),
        'call-mcp': callFixture('{"node":"scott-mac","service_id":"asr"}', '2026-10-22T08:12:00.000Z'),
      };
      const detail = details[args[4]];
      if (!detail) throw new Error('unexpected call detail');
      return detail;
    }
    if (args[0] === 'turn') return { tools: [
      { id: 'call-direct', toolName: 'dreammate_invoke', status: 'completed' },
      { id: 'call-bash', toolName: 'bash', status: 'completed' },
      { id: 'call-other', toolName: 'mcp__other__invoke', status: 'completed' },
      { id: 'call-mcp', toolName: 'mcp__dreammate__inspect', status: 'completed' },
    ] };
    throw new Error('unexpected command');
  });
  const result = await new SessionAdapter(config(), run).read(context);
  const voyage = result.voyages[0];
  assert.equal(voyage.mcpCalls, 2);
  assert.deepEqual(voyage.stops.map(stop => stop.toolName), ['dreammate_invoke', 'mcp__dreammate__inspect']);
  assert.equal(calls.filter(args => args.includes('--call')).length, 2, 'ignored tools are never fetched');
});

test('missing node args fall back to localNodeId; unresolved targets keep raw labels', async () => {
  const { run } = fixtureRunner(args => {
    if (args[0] === 'projects') return { projects: [] };
    if (args[0] === 'list') return [session()];
    if (args[0] === 'turns') return [{ no: 1, toolCount: 2, startedAt: '2026-10-22T08:10:00.000Z' }];
    if (args[0] === 'turn' && args.includes('--call')) {
      const details: Record<string, unknown> = {
        'call-local': callFixture('{"service_id":"asr","method":"asr.transcribe"}', '2026-10-22T08:11:00.000Z'),
        'call-ghost': callFixture('{"node":"ghost-node","service_id":"ghost-service"}', '2026-10-22T08:12:00.000Z'),
      };
      return details[args[4]];
    }
    if (args[0] === 'turn') return { tools: [
      { id: 'call-local', toolName: 'dreammate_invoke', status: 'completed' },
      { id: 'call-ghost', toolName: 'dreammate_inspect', status: 'completed' },
    ] };
    throw new Error('unexpected command');
  });
  const result = await new SessionAdapter(config(), run).read(context);
  const [local, ghost] = result.voyages[0].stops;
  assert.equal(local.nodeId, 'node-local');
  assert.equal(local.nodeLabel, 'scott-mac');
  assert.equal(local.resolved, true);
  assert.equal(ghost.nodeId, undefined);
  assert.equal(ghost.serviceId, undefined);
  assert.equal(ghost.nodeLabel, 'ghost-node');
  assert.equal(ghost.serviceLabel, 'ghost-service');
  assert.equal(ghost.resolved, false);
  assert.equal(result.source.status, 'ok', 'unresolved docking is not a read failure');
});

test('failed tool status or error result marks the stop as error', async () => {
  const { run } = fixtureRunner(args => {
    if (args[0] === 'projects') return { projects: [] };
    if (args[0] === 'list') return [session()];
    if (args[0] === 'turns') return [{ no: 1, toolCount: 3, startedAt: '2026-10-22T08:10:00.000Z' }];
    if (args[0] === 'turn' && args.includes('--call')) {
      const details: Record<string, unknown> = {
        'call-failed': callFixture('{"node":"scott-pc-1","service_id":"paint"}', '2026-10-22T08:11:00.000Z', 'Error: tool "dreammate_inspect" returned invalid output'),
        'call-error-result': callFixture('{"node":"scott-mac","service_id":"asr"}', '2026-10-22T08:12:00.000Z', '{"content":[],"isError":true}'),
        'call-ok': callFixture('{"online_only":false}', '2026-10-22T08:13:00.000Z'),
      };
      return details[args[4]];
    }
    if (args[0] === 'turn') return { tools: [
      { id: 'call-failed', toolName: 'dreammate_invoke', status: 'failed' },
      { id: 'call-error-result', toolName: 'dreammate_invoke', status: 'completed' },
      { id: 'call-ok', toolName: 'dreammate_list_nodes', status: 'completed' },
    ] };
    throw new Error('unexpected command');
  });
  const voyage = (await new SessionAdapter(config(), run).read(context)).voyages[0];
  assert.deepEqual(voyage.stops.map(stop => stop.status), ['error', 'error', 'ok']);
  assert.ok(voyage.stops.every(stop => stop.calls === 1));
});

test('a failed call detail keeps the stop with the turn status and marks the source partial', async () => {
  const { run } = fixtureRunner(args => {
    if (args[0] === 'projects') return { projects: [] };
    if (args[0] === 'list') return [session()];
    if (args[0] === 'turns') return [{ no: 1, toolCount: 1, startedAt: '2026-10-22T08:10:00.000Z' }];
    if (args[0] === 'turn' && args.includes('--call')) {
      throw Object.assign(new Error('Command failed: /Users/scott/.dsh/sessions/session.v4.jsonl.zstd'), { code: 'ENOENT' });
    }
    if (args[0] === 'turn') return { tools: [{ id: 'call-ok', toolName: 'dreammate_invoke', status: 'completed' }] };
    throw new Error('unexpected command');
  });
  const result = await new SessionAdapter(config(), run).read(context);
  assert.equal(result.source.status, 'partial');
  assert.equal(result.voyages[0].stops.length, 1);
  assert.equal(result.voyages[0].stops[0].status, 'ok');
  assert.ok(result.source.diagnostics.some(diagnostic => diagnostic.includes('参数与结果缺失')));
  assert.ok(!JSON.stringify(result.source.diagnostics).includes('/Users/'));
});

test('command failure is unavailable, never throws and is not cached; disabled reads no command', async () => {
  let fail = true;
  const calls: string[][] = [];
  const run: SessionCommandRunner = async (command, args) => {
    calls.push([command, ...args]);
    if (fail) throw Object.assign(new Error('spawn /Users/scott/.dsh/sessions ENOENT'), { code: 'ENOENT' });
    if (args[0] === 'projects') return JSON.stringify({ projects: [] });
    if (args[0] === 'list') return JSON.stringify([session()]);
    if (args[0] === 'turns') return JSON.stringify([]);
    throw new Error('unexpected command');
  };
  const adapter = new SessionAdapter(config(), run);
  const failed = await adapter.read(context);
  assert.equal(failed.source.status, 'unavailable');
  assert.deepEqual(failed.voyages, []);
  assert.ok(failed.source.diagnostics.some(diagnostic => diagnostic.includes('未安装')));
  assert.ok(!JSON.stringify(failed.source.diagnostics).includes('/Users/'));

  fail = false;
  const recovered = await adapter.read(context);
  assert.equal(recovered.source.status, 'ok');
  assert.equal(recovered.voyages.length, 1, 'a failed read must not populate the cache');

  let invoked = false;
  const disabled = new SessionAdapter(config({ enabled: false }), async () => { invoked = true; return '[]'; });
  const result = await disabled.read(context);
  assert.equal(result.source.status, 'unsupported');
  assert.deepEqual(result.voyages, []);
  assert.equal(invoked, false, 'disabled sessions must not execute the CLI');
  assert.ok(result.source.diagnostics.some(diagnostic => diagnostic.includes('未启用')));
});

test('missing titles, session/turn/call caps produce partial coverage diagnostics', async () => {
  const { run } = fixtureRunner(args => {
    if (args[0] === 'projects') return { projects: [] };
    if (args[0] === 'list') return [
      session({ id: 'sess-a', workspace: '/Users/scott/Projects/lonely-repo', title: undefined, createdAt: undefined, updatedAt: '2026-10-22T09:59:00.000Z' }),
      session({ id: 'sess-b', provider: 'codex', workspace: '', title: undefined, updatedAt: '2026-10-22T09:00:00.000Z' }),
    ];
    if (args[0] === 'turns') {
      if (args[1] === 'sess-a') return [
        { no: 1, toolCount: 2, startedAt: '2026-10-22T08:10:00.000Z' },
        { no: 2, toolCount: 2, startedAt: '2026-10-22T09:00:00.000Z' },
      ];
      return [];
    }
    if (args[0] === 'turn' && args.includes('--call')) return callFixture('{"online_only":false}', '2026-10-22T09:01:00.000Z');
    if (args[0] === 'turn') return { tools: [
      { id: 'call-first', toolName: 'dreammate_list_nodes', status: 'completed' },
      { id: 'call-second', toolName: 'dreammate_list_services', status: 'completed' },
    ] };
    throw new Error('unexpected command');
  });
  const result = await new SessionAdapter(config({ maxSessions: 2, maxTurns: 1, maxCalls: 1 }), run).read(context);

  assert.equal(result.source.status, 'partial');
  assert.equal(result.voyages.length, 2);
  assert.equal(result.voyages.reduce((total, voyage) => total + voyage.mcpCalls, 0), 1);
  assert.ok(result.source.diagnostics.some(diagnostic => diagnostic.includes('会话列表达到上限')));
  assert.ok(result.source.diagnostics.some(diagnostic => diagnostic.includes('轮次上限')));
  assert.ok(result.source.diagnostics.some(diagnostic => diagnostic.includes('全局上限')));

  const [first, second] = result.voyages;
  assert.equal(first.title, 'lonely-repo', 'missing title falls back to the workspace basename');
  assert.equal(first.projectName, 'lonely-repo');
  assert.equal(first.projectId, voyageProjectId('/Users/scott/Projects/lonely-repo'));
  assert.equal(first.status, 'active');
  assert.equal(second.title, '未命名会话');
  assert.equal(second.projectName, '未归属项目');
  assert.equal(second.status, 'ended');
  assert.equal(second.provider, 'codex');
  assert.ok(!JSON.stringify(result.voyages).includes('/Users/'));
});

test('60-second cache returns a deep copy and expires without refetching on a hit', async () => {
  const { run, calls } = fixtureRunner(args => {
    if (args[0] === 'projects') return { projects: [] };
    if (args[0] === 'list') return [session()];
    if (args[0] === 'turns') return [];
    throw new Error('unexpected command');
  });
  const adapter = new SessionAdapter(config(), run);
  const first = await adapter.read(context);
  assert.equal(first.source.status, 'ok');
  assert.equal(calls.length, 3);

  const second = await adapter.read({ ...context, now: '2026-10-22T10:00:30.000Z' });
  assert.equal(calls.length, 3, 'a cache hit must not run any command');
  assert.notEqual(second.source, first.source);
  assert.equal(second.source.observedAt, NOW);
  assert.deepEqual(second.voyages, first.voyages);

  const third = await adapter.read({ ...context, now: '2026-10-22T10:01:01.000Z' });
  assert.equal(calls.length, 6, 'the cache expires after 60 seconds');
  assert.equal(third.source.observedAt, '2026-10-22T10:01:01.000Z');
});

test('parsers reject malformed output instead of reporting empty data, and error summaries stay path-free', () => {
  assert.throws(() => parseSessionProjects('{"projects":{}}'), /projects/);
  assert.throws(() => parseSessionProjects('not json'), /JSON/);
  assert.throws(() => parseSessionList('{"items":[]}'), /数组/);
  assert.throws(() => parseSessionTurns('not json'), /JSON/);
  assert.deepEqual(parseSessionTurns(JSON.stringify([{ no: 1, toolCount: 2 }, { no: 'x' }, { no: 2, toolCount: 0 }])).map(turn => [turn.no, turn.toolCount]), [[1, 2], [2, 0]]);
  assert.equal(sessionCallStatus('failed', undefined), 'error');
  assert.equal(sessionCallStatus('completed', 'Error: invalid output'), 'error');
  assert.equal(sessionCallStatus('completed', '{"content":[],"isError":true}'), 'error');
  assert.equal(sessionCallStatus('completed', '{"content":[]}'), 'ok');
  assert.equal(sessionCallStatus(undefined, undefined), 'unknown');

  const message = safeSessionError('/opt/homebrew/bin/1session', Object.assign(new Error('spawn /Users/scott/.dsh/sessions ENOENT'), { code: 'ENOENT' }));
  assert.ok(!message.includes('/Users/'));
  assert.ok(!message.includes('/opt/homebrew'));
  assert.equal(safeSessionError('1session', Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), '1session 读取超时');
});
