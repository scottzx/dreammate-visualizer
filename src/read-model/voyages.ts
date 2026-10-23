import type { Evidence, JobView, NodeView, ServiceView, VoyageStatus, VoyageStopStatus, VoyageStopView, VoyageView, WorkStatus } from './types';

/** A session that has not produced a new turn for this long is shown as ended, not executing. */
export const VOYAGE_ACTIVE_WINDOW_MS = 5 * 60_000;
export const VOYAGE_DEPART_SHARE = 0.04;
export const VOYAGE_TRAVEL_SHARE = 0.6;
export const VOYAGE_DOCK_SHARE = 0.03;

/**
 * Only direct, structured DreamMate MCP tool names count as docking evidence.
 * MCP calls embedded inside shell/exec scripts are deliberately not parsed.
 */
export function isDreamMateTool(toolName: string): boolean {
  const name = toolName.trim();
  if (!name) return false;
  return /(^|__)dreammate(?:[_-]|__|$)/i.test(name) || /^mcp__.*dreammate.*[_-](?:invoke|inspect|list|search|read|download)/i.test(name);
}

export interface McpTarget { nodeRef?: string; serviceRef?: string; method?: string; gateway: boolean }

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Parse a tool-call argument block; JSON is the source format, a bounded regex is only a fallback. */
export function parseToolArguments(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch { /* Fall through to the explicit field fallback. */ }
  const result: Record<string, unknown> = {};
  for (const key of ['node', 'node_id', 'service_id', 'serviceId', 'method', 'capability']) {
    const match = new RegExp(`"${key}"\\s*:\\s*"([^"]{1,512})"`).exec(value);
    if (match) result[key] = match[1];
  }
  return result;
}

/** Extract only explicit target fields; missing fields stay unknown instead of being guessed. */
export function mcpTarget(toolName: string, args: Record<string, unknown>): McpTarget {
  const nodeRef = text(args.node) ?? text(args.node_id) ?? text(args.nodeId) ?? text(args.target_node);
  const serviceRef = text(args.service_id) ?? text(args.serviceId) ?? text(args.service);
  const method = text(args.method) ?? text(args.capability);
  const localMarker = nodeRef?.toLowerCase();
  const gateway = !nodeRef || localMarker === 'localhost' || localMarker === '@client' || localMarker === 'all' || toolName.endsWith('_list_nodes') || toolName.endsWith('_list_services');
  return { nodeRef: gateway ? undefined : nodeRef, serviceRef, method, gateway };
}

const compare = (left: string | undefined, right: string | undefined) => Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());

export function resolveNodeRef(nodes: readonly NodeView[], ref: string | undefined): NodeView | undefined {
  if (!ref) return undefined;
  return nodes.find(node => compare(node.id, ref) || compare(node.nativeId, ref) || compare(node.name, ref));
}

export function resolveServiceRef(services: readonly ServiceView[], nodeId: string | undefined, ref: string | undefined): ServiceView | undefined {
  if (!ref) return undefined;
  return services.find(service => (!nodeId || service.nodeId === nodeId) && (compare(service.id, ref) || compare(service.nativeId, ref) || compare(service.name, ref)));
}

export interface McpCallView {
  toolName: string; at: string; status: VoyageStopStatus; argsText?: string; evidence: Evidence[];
}

function stopStatus(current: VoyageStopStatus, next: VoyageStopStatus): VoyageStopStatus {
  if (current === 'error' || next === 'error') return 'error';
  if (current === 'ok' || next === 'ok') return 'ok';
  return 'unknown';
}

/**
 * Turn ordered MCP calls into ordered docking stops. Consecutive calls to the same
 * node+service are one stop; a later return to the same target is a new stop.
 */
export function buildVoyageStops(voyageId: string, calls: readonly McpCallView[], nodes: readonly NodeView[], services: readonly ServiceView[], localNodeId?: string): VoyageStopView[] {
  const stops: VoyageStopView[] = [];
  const keys: string[] = [];
  const local = resolveNodeRef(nodes, localNodeId);
  for (const call of calls) {
    const target = mcpTarget(call.toolName, parseToolArguments(call.argsText));
    const node = resolveNodeRef(nodes, target.nodeRef) ?? (target.nodeRef ? undefined : local);
    const service = resolveServiceRef(services, node?.id, target.serviceRef);
    const nodeLabel = node?.name ?? target.nodeRef ?? (target.gateway ? '本地 MCP 网关' : undefined);
    const serviceLabel = service?.name ?? target.serviceRef;
    const key = `${node?.id ?? `node:${nodeLabel ?? 'unknown'}`}|${service?.id ?? `service:${serviceLabel ?? 'gateway'}`}`;
    const previous = keys.at(-1) === key ? stops.at(-1) : undefined;
    if (previous) {
      previous.calls += 1;
      previous.at = call.at;
      previous.status = stopStatus(previous.status, call.status);
      if (target.method && !previous.methods?.includes(target.method)) previous.methods = [...(previous.methods ?? []), target.method].slice(0, 8);
      if (previous.evidence.length < 4) previous.evidence.push(...call.evidence);
      continue;
    }
    keys.push(key);
    const resolved = Boolean(node) && (!target.serviceRef || Boolean(service));
    stops.push({
      id: `${voyageId}/stop/${stops.length}:${key}`,
      ...(node ? { nodeId: node.id } : {}),
      ...(nodeLabel ? { nodeLabel } : {}),
      ...(service ? { serviceId: service.id } : {}),
      ...(serviceLabel ? { serviceLabel } : {}),
      ...(target.method ? { method: target.method } : {}),
      ...(target.method ? { methods: [target.method] } : {}),
      toolName: call.toolName,
      at: call.at,
      status: call.status,
      calls: 1,
      resolved,
      evidence: [...call.evidence],
    });
  }
  return stops;
}

/** The last docking point is the destination; a voyage without MCP stops stays at its origin. */
export function voyageDestination(stops: readonly VoyageStopView[], originNodeId: string | undefined, originLabel: string): { destinationNodeId?: string; destinationLabel: string } {
  const last = stops.at(-1);
  if (!last) return { ...(originNodeId ? { destinationNodeId: originNodeId } : {}), destinationLabel: originLabel };
  return {
    ...(last.nodeId ? { destinationNodeId: last.nodeId } : {}),
    destinationLabel: last.nodeLabel ?? last.serviceLabel ?? '未确认停靠点',
  };
}

export type VoyageMotionPhase = 'origin' | 'depart' | 'travel' | 'dock' | 'arrived';
export interface VoyageMotionState { phase: VoyageMotionPhase; leg: number; t: number; progress: number }

/** The fleet repeats one refresh cycle: depart, travel, dock, and remain at the last stop. */
export function voyageMotion(stopCount: number, elapsedMs: number, cycleMs: number): VoyageMotionState {
  const legs = Number.isSafeInteger(stopCount) && stopCount > 0 ? stopCount : 0;
  const cycle = Number.isFinite(cycleMs) && cycleMs > 0 ? cycleMs : 180_000;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const progress = Math.min(1, elapsed / cycle);
  if (legs === 0) return { phase: 'origin', leg: 0, t: 0, progress: 0 };
  if (progress < VOYAGE_DEPART_SHARE) return { phase: 'depart', leg: 0, t: 0, progress };
  const legDuration = VOYAGE_TRAVEL_SHARE / legs;
  let rest = progress - VOYAGE_DEPART_SHARE;
  for (let leg = 0; leg < legs; leg += 1) {
    if (rest < legDuration) return { phase: 'travel', leg, t: Math.max(0, rest / legDuration), progress };
    rest -= legDuration;
    if (leg < legs - 1) {
      if (rest < VOYAGE_DOCK_SHARE) return { phase: 'dock', leg: leg + 1, t: 1, progress };
      rest -= VOYAGE_DOCK_SHARE;
    }
  }
  return { phase: 'arrived', leg: legs, t: 1, progress };
}

export interface ProjectRef { id: string; name: string; workspace?: string; workspaces?: string[] }

const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '');
const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

/** Match a session workspace to the longest published project directory. */
export function matchProjectForWorkspace(workspace: string, projects: readonly ProjectRef[]): ProjectRef | undefined {
  const path = normalizePath(workspace.trim());
  if (!path) return undefined;
  let best: { project: ProjectRef; length: number } | undefined;
  for (const project of projects) {
    for (const root of [project.workspace, ...(project.workspaces ?? [])].filter((value): value is string => Boolean(value))) {
      const normalized = normalizePath(root.trim());
      if (!normalized || !under(path, normalized)) continue;
      if (!best || normalized.length > best.length) best = { project, length: normalized.length };
    }
  }
  return best?.project;
}

/** A path-free, stable project identity for the snapshot payload. */
export function voyageProjectId(projectId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < projectId.length; index += 1) { hash ^= projectId.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `voyage-project:${(hash >>> 0).toString(36)}`;
}

/** Never publish an absolute workspace path; the last directory name identifies the origin. */
export function workspaceLabel(workspace: string): string {
  const segments = normalizePath(workspace).split('/').filter(Boolean);
  return segments.at(-1) ?? '未归属项目';
}

export function voyageStatus(updatedAt: string, now = Date.now(), activeWindowMs = VOYAGE_ACTIVE_WINDOW_MS): VoyageStatus {
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(updated)) return 'unknown';
  const age = now - updated;
  return age >= -60_000 && age <= activeWindowMs ? 'active' : 'ended';
}

/** Raw session titles can quote a workspace; the snapshot only publishes a home-relative label. */
export function redactWorkspacePath(value: string): string {
  return value
    .replace(/\/Users\/[^/\s]+/g, '~')
    .replace(/\/home\/[^/\s]+/g, '~')
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/gi, '~');
}

export function sortVoyages(voyages: readonly VoyageView[]): VoyageView[] {
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return [...voyages].sort((a, b) => time(b.updatedAt) - time(a.updatedAt) || a.id.localeCompare(b.id));
}

/** Devices that a voyage search must keep on screen: origin, every stop and destination. */
export function voyageNodeIds(voyages: readonly VoyageView[]): string[] {
  return [...new Set(voyages.flatMap(voyage => [voyage.originNodeId, voyage.destinationNodeId, ...voyage.stops.map(stop => stop.nodeId)])
    .filter((id): id is string => Boolean(id)))];
}

export interface VoyageCounts { sessions: number; acp: number; withStops: number; stops: number; mcpCalls: number; active: number }
export function voyageCounts(voyages: readonly VoyageView[]): VoyageCounts {
  return voyages.reduce<VoyageCounts>((counts, voyage) => ({
    sessions: counts.sessions + (voyage.kind === 'session' ? 1 : 0),
    acp: counts.acp + (voyage.kind === 'acp' ? 1 : 0),
    withStops: counts.withStops + (voyage.stops.length ? 1 : 0),
    stops: counts.stops + voyage.stops.length,
    mcpCalls: counts.mcpCalls + voyage.mcpCalls,
    active: counts.active + (voyage.status === 'active' ? 1 : 0),
  }), { sessions: 0, acp: 0, withStops: 0, stops: 0, mcpCalls: 0, active: 0 });
}

export function voyageKindLabel(kind: VoyageView['kind']): string {
  return kind === 'acp' ? 'ACP 工作单' : '普通会话';
}

const attemptStopStatus = (status: WorkStatus): VoyageStopStatus => status === 'succeeded' ? 'ok'
  : status === 'failed' || status === 'rejected' || status === 'canceled' ? 'error' : 'unknown';
const acpVoyageStatus = (status: WorkStatus): VoyageStatus => status === 'running' || status === 'queued' || status === 'input_required' ? 'active'
  : status === 'succeeded' || status === 'failed' || status === 'rejected' || status === 'canceled' ? 'ended' : 'unknown';

/**
 * ACP work orders become voyages bounded by their own execution attempts. They have no
 * session-level MCP call log here, so no tool-call docking is invented.
 */
export function acpVoyages(jobs: readonly JobView[], nodes: readonly NodeView[], localNodeId: string | undefined, now: string): VoyageView[] {
  const local = resolveNodeRef(nodes, localNodeId);
  return jobs.map(job => {
    const stops: VoyageStopView[] = job.attempts.flatMap((attempt, index) => {
      if (!attempt.nodeId) return [];
      const node = nodes.find(item => item.id === attempt.nodeId);
      return [{
        id: `${job.id}/stop/${index}`, nodeId: attempt.nodeId, nodeLabel: node?.name ?? '未确认设备',
        serviceLabel: attempt.agent, toolName: 'acp.attempt', at: attempt.updatedAt,
        status: attemptStopStatus(attempt.status), calls: 1, resolved: Boolean(node), evidence: attempt.evidence,
      }];
    });
    const destination = voyageDestination(stops, local?.id, 'ACP 授权 origin');
    return {
      id: `acp-voyage:${job.id}`, nativeId: job.nativeId, kind: 'acp' as const, sourceId: job.sourceId, provider: 'acp', title: job.title,
      projectName: 'ACP 授权 origin', ...(local ? { originNodeId: local.id } : {}), startedAt: job.attempts[0]?.startedAt ?? job.updatedAt,
      updatedAt: job.updatedAt, status: acpVoyageStatus(job.status), stops, ...destination, mcpCalls: 0,
      evidence: [...job.evidence, { sourceId: job.sourceId, nativeId: job.nativeId, observedAt: now,
        note: 'ACP 工作单没有会话内 MCP 工具调用明细；航次停靠只来自执行尝试的明确目标设备' }],
    };
  });
}
