import { GB } from '../read-model/storage';
import type { AttemptView, EventView, JobView, NodeView, ObserverSnapshot, ProjectCategory, ProjectStorageView, ProjectView, ServiceView, VoyageView, WorkStatus } from '../read-model/types';
import { buildVoyageStops, voyageDestination, voyageProjectId, type McpCallView } from '../read-model/voyages';

/** Isolated, explicitly labeled scenario. It never reads or writes a real source. */
export function createDemoSnapshot(now: Date = new Date()): ObserverSnapshot {
  const at = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();
  const observedAt = at(0);
  const evidence = (nativeId: string, note = '演示场景内的显式记录，不代表真实运行事实') => [{ sourceId: 'demo:scenario', nativeId, locator: `demo://factory/${nativeId}`, observedAt, note }];
  const definitions = [
    ['studio', '创作工作室', 'macOS · M4 Pro', 'macos', 'running'],
    ['compute', '推理计算中心', 'Linux · GPU Server', 'linux', 'running'],
    ['workstation', '设计工作站', 'Windows · RTX 4090', 'windows', 'waiting'],
    ['mobile', '移动能力站', 'iPhone · iOS', 'ios', 'unknown'],
    ['edge', '边缘设备', 'Linux · ARM64', 'linux', 'unknown'],
  ] as const;
  const nodes: NodeView[] = definitions.map(([id, name, address, platform, agentStatus], index) => ({ id: `demo:node:${id}`, nativeId: `demo-${id}`, name, address, platform, catalogAvailable: true, storage: { totalBytes: [128, 512, 256, 64, 1024][index] * GB, observedAt, source: 'demo', status: 'observed' }, networkOnline: index !== 4, online: index !== 4, status: index === 4 ? 'offline' : 'ok', observedAt, serviceIds: [], agentStatus, evidence: evidence(`node-${id}`) }));
  const serviceDefinitions = [
    ['studio', 'orchestrator', '协作编排', 'agent', ['execution.list', 'execution.events'], ['staged-workflow']],
    ['studio', 'sessions', '会话档案', 'resource_provider', ['sessions.list', 'sessions.read'], []],
    ['compute', 'research', '研究与检索', 'agent', ['research.search', 'research.summarize'], ['research-report']],
    ['compute', 'embeddings', '语义向量', 'model_provider', ['embedding.encode', 'embedding.status'], []],
    ['workstation', 'design', '视觉设计', 'agent', ['design.render', 'design.export'], ['presentation-design']],
    ['workstation', 'artifacts', '交付产物', 'resource_provider', ['artifacts.list', 'artifacts.read'], []],
    ['mobile', 'calendar', '日程与提醒', 'generic', ['calendar.list', 'reminders.list'], []],
    ['mobile', 'sensors', '设备感知', 'generic', ['device.status', 'sensors.read'], []],
    ['edge', 'transcribe', '音频转写', 'generic', ['asr.transcribe', 'asr.info'], ['oralcut']],
    ['edge', 'media', '媒体处理', 'generic', ['media.inspect', 'media.render'], []],
  ] as const;
  const services: ServiceView[] = serviceDefinitions.map(([node, id, name, kind, methods, skills]) => ({ id: `demo:service:${id}`, nativeId: `demo-${id}`, nodeId: `demo:node:${node}`, name, description: `${name}的演示服务契约`, kind, status: node === 'edge' ? 'down' : 'up', observedAt, methods: methods.map(name => ({ name, description: '演示能力，观察端不会执行此方法' })), skills: skills.map(name => ({ id: `demo:skill:${name}`, name, description: '演示工艺指南；目录读取不等于执行', revision: 'demo-v1' })), skillsStatus: 'ok', skillsObservedAt: observedAt, sharing: 'network', evidence: evidence(`service-${id}`) }));
  for (const node of nodes) node.serviceIds = services.filter(service => service.nodeId === node.id).map(service => service.id);
  const attempt = (job: string, id: string, node: string, status: WorkStatus, seconds: number): AttemptView => ({ id: `demo:attempt:${id}`, nativeId: `demo-${id}`, nodeId: `demo:node:${node}`, agent: node === 'compute' ? '研究员' : node === 'workstation' ? '视觉设计师' : '协作协调员', status, sourceStatus: status === 'running' ? 'working' : status === 'succeeded' ? 'completed' : status, startedAt: at(seconds + 60), updatedAt: at(seconds), session: { id: `demo:session:${job}-${id}`, provider: 'demo', confirmed: true, locator: `demo://session/${id}` }, evidence: evidence(`attempt-${id}`) });
  const job = (id: string, title: string, status: WorkStatus, attempts: AttemptView[], seconds: number, acceptance = 'pending'): JobView => ({ id: `demo:job:${id}`, nativeId: `demo-${id}`, sourceId: 'demo:scenario', originSessionId: 'demo:origin:factory', title, status, sourceStatus: status === 'running' ? 'working' : status === 'succeeded' ? 'completed' : status, updatedAt: at(seconds), trigger: id === 'brief' ? 'human' : 'agent', acceptance, attempts, evidence: evidence(`job-${id}`) });
  const jobs: JobView[] = [
    job('brief', 'AI 经营观察 · 季度报告', 'running', [attempt('brief', 'brief-1', 'studio', 'running', 8)], 8),
    job('research', '检索行业数据与案例', 'running', [attempt('research', 'research-1', 'compute', 'running', 4)], 4),
    job('deck', '生成策略演示与图表', 'input_required', [attempt('deck', 'deck-1', 'workstation', 'failed', 240), attempt('deck', 'deck-2', 'workstation', 'input_required', 22)], 22),
    job('calendar', '整理访谈日程', 'succeeded', [attempt('calendar', 'calendar-1', 'mobile', 'succeeded', 95)], 95, 'accepted'),
    job('audio', '转写客户访谈录音', 'queued', [attempt('audio', 'audio-1', 'edge', 'queued', 48)], 48),
  ];
  const event = (id: string, title: string, status: WorkStatus, seconds: number, node: string, job: string, attempt: string, target?: string, service?: string): EventView => ({ id: `demo:event:${id}`, sourceId: 'demo:scenario', sequence: 100 - seconds, type: target ? 'demo.delegation.confirmed' : `demo.attempt.${status}`, title, status, occurredAt: at(seconds), observedAt, nodeId: `demo:node:${node}`, targetNodeId: target ? `demo:node:${target}` : undefined, serviceId: service ? `demo:service:${service}` : undefined, jobId: `demo:job:${job}`, attemptId: `demo:attempt:${attempt}`, protocol: target ? 'A2A' : 'MCP', causalConfirmed: Boolean(target), evidence: evidence(`event-${id}`, target ? '演示记录含显式父 Job、目标节点与委托确认；仅在演示场景内连线' : '演示场景内独立事件，不推测因果关系') });
  const events = [
    event('search', '研究员正在核对行业数据', 'running', 4, 'compute', 'research', 'research-1', undefined, 'research'),
    event('delegate-research', '协调员 → 研究员：委托数据检索', 'running', 8, 'studio', 'research', 'research-1', 'compute', 'orchestrator'),
    event('design-review', '视觉设计师等待版式确认', 'input_required', 22, 'workstation', 'deck', 'deck-2', undefined, 'design'),
    event('delegate-design', '协调员 → 设计师：交接报告结构', 'input_required', 30, 'studio', 'deck', 'deck-2', 'workstation', 'orchestrator'),
    event('audio-queue', '边缘设备离线，转写仍在排队', 'queued', 48, 'edge', 'audio', 'audio-1', undefined, 'transcribe'),
    event('brief-start', '季度报告工作单开始推进', 'running', 58, 'studio', 'brief', 'brief-1', undefined, 'orchestrator'),
    event('calendar-done', '日程整理完成，业务已接受', 'succeeded', 95, 'mobile', 'calendar', 'calendar-1', undefined, 'calendar'),
  ];
  const projectStorage = (project: string, node: string, category: ProjectCategory, gb: number): ProjectStorageView => ({ nodeId: `demo:node:${node}`, category, bytes: gb * GB, status: 'ok', observedAt, source: 'demo', metric: 'allocated-disk-bytes', path: `demo://projects/${project}/${node}` });
  const projects: ProjectView[] = [
    { id: 'demo:project:universe', name: '能力宇宙沙盘', nodeIds: ['demo:node:studio'], sessionCount: 18, providers: [{ name: 'Codex', count: 10 }, { name: 'Claude', count: 5 }, { name: 'DSH', count: 3 }], status: 'ok', observedAt, evidence: evidence('project-universe'), storage: [projectStorage('universe', 'studio', 'other', 5)] },
    { id: 'demo:project:report', name: '经营策略研究', nodeIds: ['demo:node:studio', 'demo:node:compute', 'demo:node:workstation'], sessionCount: 72, providers: [{ name: 'Codex', count: 18 }, { name: 'Claude', count: 36 }, { name: 'DSH', count: 12 }], status: 'partial', observedAt, evidence: evidence('project-report', '示例跨设备项目共用身份；有6个会话未明确归属宿主'), storage: [projectStorage('report', 'studio', 'business-agent', 28), projectStorage('report', 'compute', 'business-agent', 96), projectStorage('report', 'workstation', 'business-agent', 76)] },
    { id: 'demo:project:notes', name: '感知能力实验室', nodeIds: ['demo:node:studio', 'demo:node:mobile'], sessionCount: 3, providers: [{ name: 'Codex', count: 2 }, { name: 'Claude', count: 1 }], status: 'ok', observedAt, evidence: evidence('project-notes'), storage: [projectStorage('notes', 'studio', 'perception', 14), projectStorage('notes', 'mobile', 'perception', 20)] },
  ];
  const mcpCall = (seconds: number, toolName: string, args: Record<string, string>): McpCallView => ({
    toolName, at: at(seconds), status: 'ok', argsText: JSON.stringify(args),
    evidence: [{ sourceId: 'demo:scenario', nativeId: `demo-call-${seconds}`, locator: `demo://session/call/${seconds}`, observedAt: at(seconds),
      note: '演示会话内的工具调用；停靠点只来自参数中显式的 node / service_id，不推测未给出的目标' }],
  });
  const voyage = (definition: { id: string; provider: string; title: string; project: string; projectName: string; started: number; updated: number; calls: McpCallView[] }): VoyageView => {
    const stops = buildVoyageStops(definition.id, definition.calls, nodes, services, 'demo-studio');
    const destination = voyageDestination(stops, 'demo:node:studio', '创作工作室');
    return {
      id: definition.id, nativeId: definition.id.replace('demo:voyage:', 'demo-session-'), kind: 'session', sourceId: 'demo:scenario',
      provider: definition.provider, title: definition.title, projectId: voyageProjectId(definition.project), projectName: definition.projectName,
      originNodeId: 'demo:node:studio', startedAt: at(definition.started), updatedAt: at(definition.updated),
      status: definition.updated <= 300 ? 'active' : 'ended', stops, ...destination, mcpCalls: definition.calls.length,
      evidence: evidence(`voyage-${definition.id}`, '演示会话按 3 分钟周期起航；最后一个停靠点即终点，没有 MCP 停靠时停在项目起点'),
    };
  };
  const voyages: VoyageView[] = [
    voyage({ id: 'demo:voyage:universe', provider: 'dsh', title: '能力宇宙视觉迭代', project: 'demo:project:universe', projectName: '能力宇宙沙盘', started: 260, updated: 8, calls: [
      mcpCall(220, 'dreammate_search_tools', { query: '视觉设计 render', node: 'localhost' }),
      mcpCall(164, 'dreammate_invoke', { node: 'demo-compute', service_id: 'demo-research', method: 'research.search' }),
      mcpCall(96, 'dreammate_invoke', { node: 'demo-workstation', service_id: 'demo-design', method: 'design.render' }),
      mcpCall(42, 'dreammate_inspect', { node: 'demo-workstation', service_id: 'demo-design', method: 'design.export' }),
    ] }),
    voyage({ id: 'demo:voyage:report', provider: 'codex', title: '季度经营报告与图表', project: 'demo:project:report', projectName: '经营策略研究', started: 420, updated: 70, calls: [
      mcpCall(300, 'dreammate_invoke', { node: 'demo-compute', service_id: 'demo-research', method: 'research.summarize' }),
      mcpCall(170, 'mcp__dreammate__dreammate_invoke', { node: 'demo-mobile', service_id: 'demo-calendar', method: 'calendar.list' }),
      mcpCall(72, 'dreammate_invoke', { node: 'demo-workstation', service_id: 'demo-artifacts', method: 'artifacts.list' }),
    ] }),
    voyage({ id: 'demo:voyage:notes', provider: 'claude', title: '感知实验室排期梳理', project: 'demo:project:notes', projectName: '感知能力实验室', started: 900, updated: 340, calls: [] }),
  ];
  const acpVoyage: VoyageView = {
    id: 'demo:voyage:acp-audio', nativeId: 'demo-job-audio', kind: 'acp', sourceId: 'demo:scenario', provider: 'acp',
    title: '转写客户访谈录音', projectId: voyageProjectId('demo:project:notes'), projectName: '感知能力实验室',
    originNodeId: 'demo:node:studio', startedAt: at(120), updatedAt: at(48), status: 'ended',
    stops: [{ id: 'demo:voyage:acp-audio/stop/0', nodeId: 'demo:node:edge', nodeLabel: '边缘设备', serviceId: 'demo:service:transcribe', serviceLabel: '音频转写',
      method: 'asr.transcribe', methods: ['asr.transcribe'], toolName: 'acp.attempt', at: at(48), status: 'unknown', calls: 1, resolved: true,
      evidence: evidence('voyage-acp-audio-stop', 'ACP 执行尝试指向边缘设备；设备离线，停靠状态未知') }],
    destinationNodeId: 'demo:node:edge', destinationLabel: '边缘设备', mcpCalls: 0,
    evidence: evidence('voyage-acp-audio', 'ACP 工作单按执行尝试视为航次；起点为授权 origin 的本机网关，终点为最后一次尝试的目标设备'),
  };
  voyages.push(acpVoyage);
  return { version: 1, mode: 'demo', layoutScope: 'scenario-v1', generatedAt: observedAt, refreshIntervalMs: 180000, nodes, services, jobs, events, projects, voyages, sources: [{ id: 'demo:scenario', name: '演示 · 能力宇宙场景', kind: 'node', status: 'ok', scope: '隔离演示场景；全部节点、工作单、事件、项目与统计均为示例', observedAt, diagnostics: ['演示数据未访问真实设备；示例关系仅用于说明观察界面'] }], limitations: ['演示模式：全部数据为独立构造的示例，不计入真实来源统计。', '5 个业务工作单包含 6 次执行尝试；返工不新增业务工作单。', '每个服务一个能力卫星，每个可见 Skill ID 一个星点；球面蓝绿区域为项目存储比例，灰色为未归属容量，边缘设备未探查。', '项目建筑统一占地与高度；外观等级按示例会话数区间变化，参与占比按会话宿主记录，不代表贡献质量。', '流动连线表示场景内有显式证据的委托，不表示上下文迁移。', '4 个演示航次：3 个普通会话 + 1 个 ACP 工作单；飞船只沿有证据的 MCP 停靠点飞行，没有停靠的会话停在项目起点。'] };
}
