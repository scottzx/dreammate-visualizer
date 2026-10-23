import test from 'node:test';
import assert from 'node:assert/strict';
import type { JobView, NodeView, ServiceView } from '../src/read-model/types';
import {
  acpVoyages, buildVoyageStops, isDreamMateTool, matchProjectForWorkspace, mcpTarget, parseToolArguments, redactWorkspacePath,
  sortVoyages, voyageCounts, voyageDestination, voyageMotion, voyageNodeIds, voyageProjectId, voyageStatus, workspaceLabel,
  type McpCallView,
} from '../src/read-model/voyages';
import { parseConfig } from '../src/observer/config';

const node = (id: string, nativeId: string, name: string): NodeView => ({
  id, nativeId, name, address: '', platform: '', online: true, status: 'ok', observedAt: null, serviceIds: [], agentStatus: 'unknown', evidence: [],
});
const service = (id: string, nativeId: string, nodeId: string, name: string): ServiceView => ({
  id, nativeId, nodeId, name, description: '', kind: 'generic', status: 'up', observedAt: null, methods: [], skills: [], sharing: 'network', evidence: [],
});
const nodes = [node('node:local', 'mac', '本机'), node('node:pc', 'pc', '计算节点'), node('node:phone', 'phone', '手机')];
const services = [
  service('service:research', 'research', 'node:pc', '研究检索'),
  service('service:design', 'design', 'node:pc', '视觉设计'),
  service('service:calendar', 'calendar', 'node:phone', '日程'),
];
const call = (seconds: number, toolName: string, args: Record<string, unknown> | string, status: 'ok' | 'error' | 'unknown' = 'ok'): McpCallView => ({
  toolName, at: new Date(Date.UTC(2026, 9, 23, 0, 0, seconds)).toISOString(), status,
  argsText: typeof args === 'string' ? args : JSON.stringify(args),
  evidence: [{ sourceId: 'sessions:test', nativeId: `call-${seconds}`, observedAt: new Date().toISOString() }],
});

test('only structured DreamMate MCP tool names count as docking evidence', () => {
  for (const name of ['dreammate_invoke', 'dreammate_search_tools', 'mcp__dreammate__dreammate_inspect', 'mcp__codex_apps__dreammate_mcp_dreammate_invoke']) {
    assert.equal(isDreamMateTool(name), true, name);
  }
  for (const name of ['bash', 'exec', 'read', 'universe-notes', 'mcp__codex_apps__unrelated']) {
    assert.equal(isDreamMateTool(name), false, name);
  }
});

test('tool arguments keep explicit target fields and local gateway markers stay unresolved', () => {
  assert.deepEqual(mcpTarget('dreammate_invoke', parseToolArguments('{"node":"pc","service_id":"research","method":"search"}')),
    { nodeRef: 'pc', serviceRef: 'research', method: 'search', gateway: false });
  const local = mcpTarget('dreammate_search_tools', parseToolArguments('{"node":"localhost","query":"x"}'));
  assert.equal(local.gateway, true);
  assert.equal(local.nodeRef, undefined);
  assert.deepEqual(parseToolArguments('{"node":"pc","service_id":"research"}'), { node: 'pc', service_id: 'research' });
  assert.deepEqual(parseToolArguments('not-json {"node":"pc","service_id":"research"}'), { node: 'pc', service_id: 'research' });
});

test('voyage stops merge consecutive calls to one target and keep later returns separate', () => {
  const stops = buildVoyageStops('voyage:1', [
    call(1, 'dreammate_invoke', { node: 'pc', service_id: 'research', method: 'search' }),
    call(2, 'dreammate_inspect', { node: 'pc', service_id: 'research', method: 'read' }),
    call(3, 'dreammate_invoke', { node: 'pc', service_id: 'design', method: 'render' }, 'error'),
    call(4, 'dreammate_invoke', { node: 'pc', service_id: 'research', method: 'search' }),
  ], nodes, services, 'mac');
  assert.equal(stops.length, 3);
  assert.equal(stops[0].nodeId, 'node:pc');
  assert.equal(stops[0].serviceId, 'service:research');
  assert.equal(stops[0].calls, 2);
  assert.deepEqual(stops[0].methods, ['search', 'read']);
  assert.equal(stops[0].status, 'ok');
  assert.equal(stops[1].status, 'error');
  assert.equal(stops[2].calls, 1);
  assert.equal(stops[2].nodeLabel, '计算节点');
  assert.equal(stops[0].resolved, true);
});

test('a call without a target docks at the local gateway; unknown targets remain unresolved labels', () => {
  const gateway = buildVoyageStops('voyage:1', [call(1, 'dreammate_list_nodes', { online_only: false })], nodes, services, 'mac');
  assert.equal(gateway.length, 1);
  assert.equal(gateway[0].nodeId, 'node:local');
  assert.equal(gateway[0].nodeLabel, '本机');
  assert.equal(gateway[0].resolved, true);
  const unknown = buildVoyageStops('voyage:2', [call(1, 'dreammate_invoke', { node: 'ghost', service_id: 'missing' })], nodes, services, 'mac');
  assert.equal(unknown.length, 1);
  assert.equal(unknown[0].nodeId, undefined);
  assert.equal(unknown[0].nodeLabel, 'ghost');
  assert.equal(unknown[0].serviceLabel, 'missing');
  assert.equal(unknown[0].resolved, false);
});

test('the last stop is the destination; a voyage without stops ends at its origin', () => {
  const stops = buildVoyageStops('voyage:1', [
    call(1, 'dreammate_invoke', { node: 'pc', service_id: 'research', method: 'search' }),
    call(2, 'dreammate_invoke', { node: 'phone', service_id: 'calendar', method: 'list' }),
  ], nodes, services, 'mac');
  assert.deepEqual(voyageDestination(stops, 'node:local', '本机'), { destinationNodeId: 'node:phone', destinationLabel: '手机' });
  assert.deepEqual(voyageDestination([], 'node:local', '本机'), { destinationNodeId: 'node:local', destinationLabel: '本机' });
});

test('the 3-minute voyage cycle departs, travels, docks and stays at the last stop', () => {
  const cycle = 180_000;
  assert.deepEqual(voyageMotion(0, 0, cycle), { phase: 'origin', leg: 0, t: 0, progress: 0 });
  assert.equal(voyageMotion(2, 0, cycle).phase, 'depart');
  assert.equal(voyageMotion(2, cycle * 0.04, cycle).phase, 'travel');
  assert.equal(voyageMotion(2, cycle * 0.04, cycle).leg, 0);
  const firstLeg = cycle * (0.04 + 0.3 * 0.5);
  assert.equal(voyageMotion(2, firstLeg, cycle).leg, 0);
  assert.equal(voyageMotion(2, firstLeg, cycle).phase, 'travel');
  const firstDock = cycle * (0.04 + 0.3 + 0.015);
  const dockState = voyageMotion(2, firstDock, cycle);
  assert.equal(dockState.phase, 'dock');
  assert.equal(dockState.leg, 1);
  assert.equal(dockState.t, 1);
  assert.ok(Math.abs(dockState.progress - 0.355) < 1e-9);
  assert.deepEqual(voyageMotion(2, cycle, cycle), { phase: 'arrived', leg: 2, t: 1, progress: 1 });
  assert.equal(voyageMotion(2, -500, cycle).phase, 'depart');
  assert.equal(voyageMotion(2, Number.NaN, cycle).phase, 'depart');
});

test('workspace matching prefers the longest project directory and never publishes the path', () => {
  const projects = [
    { id: 'git:a/root', name: 'root', workspace: '/Users/scott/projects' },
    { id: 'git:a/child', name: 'child', workspace: '/Users/scott/projects/dreammate' },
  ];
  assert.equal(matchProjectForWorkspace('/Users/scott/projects/dreammate/session', projects)?.name, 'child');
  assert.equal(matchProjectForWorkspace('/Users/scott/projects/other', projects)?.name, 'root');
  assert.equal(matchProjectForWorkspace('/Users/scott/projects-other', projects), undefined);
  assert.equal(matchProjectForWorkspace('/Users/scott/projects/dreammate/session', []), undefined);
  assert.equal(workspaceLabel('/Users/scott/projects/dreammate/'), 'dreammate');
  assert.equal(workspaceLabel('C:\\work\\demo'), 'demo');
  assert.equal(redactWorkspacePath('修复 /Users/scott/projects/dreammate 的航次'), '修复 ~/projects/dreammate 的航次');
  assert.equal(redactWorkspacePath('C:\\Users\\scott\\work'), '~\\work');
  const id = voyageProjectId('/Users/scott/projects/dreammate');
  assert.match(id, /^voyage-project:[a-z0-9]+$/);
  assert.equal(id.includes('/'), false);
  assert.equal(id, voyageProjectId('/Users/scott/projects/dreammate'));
});

test('voyage status and ordering are based on recorded timestamps', () => {
  const now = Date.parse('2026-10-23T08:00:00Z');
  assert.equal(voyageStatus('2026-10-23T07:59:00Z', now), 'active');
  assert.equal(voyageStatus('2026-10-23T07:50:00Z', now), 'ended');
  assert.equal(voyageStatus('not-a-time', now), 'unknown');
  const at = (value: string, id: string) => ({ id, updatedAt: value }) as never;
  assert.deepEqual(sortVoyages([at('2026-10-23T07:00:00Z', 'a'), at('2026-10-23T07:05:00Z', 'b')]).map(voyage => voyage.id), ['b', 'a']);
});

test('ACP work orders become voyages bounded by attempt targets without inventing MCP calls', () => {
  const job: JobView = {
    id: 'acp:job/1', nativeId: 'job-1', sourceId: 'acp:source', originSessionId: 'origin', title: '转写访谈', status: 'running',
    sourceStatus: 'working', updatedAt: '2026-10-23T07:59:00Z', trigger: 'unknown', acceptance: 'unknown',
    attempts: [
      { id: 'attempt-1', nativeId: 'a1', status: 'succeeded', sourceStatus: 'completed', nodeId: 'node:pc', updatedAt: '2026-10-23T07:58:00Z', evidence: [] },
      { id: 'attempt-2', nativeId: 'a2', status: 'failed', sourceStatus: 'failed', nodeId: 'node:phone', startedAt: '2026-10-23T07:58:30Z', updatedAt: '2026-10-23T07:59:00Z', evidence: [] },
    ], evidence: [],
  };
  const [voyage] = acpVoyages([job], nodes, 'mac', '2026-10-23T08:00:00Z');
  assert.equal(voyage.kind, 'acp');
  assert.equal(voyage.originNodeId, 'node:local');
  assert.equal(voyage.stops.length, 2);
  assert.equal(voyage.stops[0].status, 'ok');
  assert.equal(voyage.stops[1].status, 'error');
  assert.equal(voyage.destinationNodeId, 'node:phone');
  assert.equal(voyage.mcpCalls, 0);
  assert.equal(voyage.status, 'active');
});

test('voyage scene nodes keep origin, every stop and destination, deduplicated', () => {
  const voyages = [
    { originNodeId: 'node:a', destinationNodeId: 'node:b', stops: [{ nodeId: 'node:c' }, { nodeId: undefined }, { nodeId: 'node:b' }] },
    { originNodeId: 'node:a', destinationNodeId: undefined, stops: [] },
  ] as never;
  assert.deepEqual(voyageNodeIds(voyages), ['node:a', 'node:b', 'node:c']);
});

test('voyage counts separate session, ACP, stops and MCP calls', () => {
  const voyages = [
    { id: 's1', kind: 'session', status: 'active', stops: [{}, {}], mcpCalls: 3 },
    { id: 'a1', kind: 'acp', status: 'ended', stops: [{}], mcpCalls: 0 },
  ] as never;
  assert.deepEqual(voyageCounts(voyages), { sessions: 1, acp: 1, withStops: 2, stops: 3, mcpCalls: 3, active: 1 });
});

test('session reading is opt-in, bounded and never shell-expanded', () => {
  assert.equal(parseConfig({}, {}).sessions.enabled, false);
  assert.equal(parseConfig({ sessions: true }, {}).sessions.enabled, true);
  const configured = parseConfig({ sessions: { enabled: true, command: '/opt/bin/1session', scope: '/tmp', sinceHours: 1000, maxSessions: 999, maxTurns: 0, maxCalls: 9999, timeoutMs: 1 } }, {});
  assert.equal(configured.sessions.enabled, true);
  assert.equal(configured.sessions.command, '/opt/bin/1session');
  assert.equal(configured.sessions.sinceHours, 168);
  assert.equal(configured.sessions.maxSessions, 50);
  assert.equal(configured.sessions.maxTurns, 1);
  assert.equal(configured.sessions.maxCalls, 200);
  assert.equal(configured.sessions.timeoutMs, 1000);
  const invalid = parseConfig({ sessions: { enabled: true, command: '' } }, {});
  assert.equal(invalid.sessions.enabled, false);
});
