import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { NodeView, ServiceView, SourceView, VoyageStopStatus, VoyageView } from '../read-model/types';
import {
  buildVoyageStops, isDreamMateTool, matchProjectForWorkspace, redactWorkspacePath, sortVoyages,
  voyageDestination, voyageProjectId, voyageStatus, workspaceLabel,
  type McpCallView, type ProjectRef,
} from '../read-model/voyages';
import type { ObserverConfig } from '../observer/config';
import { array, object } from './http';

const execFileAsync = promisify(execFile);
export const SESSION_SOURCE_ID = 'sessions:1session';
const CACHE_MS = 60_000;
const MAX_BUFFER = 8 * 1024 * 1024;
const PROJECT_LIMIT = 40;

export interface SessionSourceContext { nodes: NodeView[]; services: ServiceView[]; now: string }
export type SessionCommandRunner = (command: string, args: string[], timeoutMs: number) => Promise<string>;

/** The only process boundary: execFile never goes through a shell and never writes a file. */
export const defaultSessionRunner: SessionCommandRunner = async (command, args, timeoutMs) => {
  const { stdout } = await execFileAsync(command, args, { timeout: timeoutMs, maxBuffer: MAX_BUFFER, encoding: 'utf8', windowsHide: true });
  return stdout;
};

export interface SessionRow {
  id: string; provider: string; title?: string; workspace: string; createdAt?: string; updatedAt: string;
}
export interface SessionTurnSummary {
  no: number; status?: string; toolCount: number; startedAt?: string; endedAt?: string;
}
export interface SessionToolCall { id: string; toolName: string; status?: string }
export interface SessionTurnDetail { tools: SessionToolCall[] }
export interface SessionCallItem { kind: string; content: string; timestamp?: string }
export interface SessionCallDetail { items: SessionCallItem[] }

const isoText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

function jsonValue(output: string, label: string): unknown {
  try { return JSON.parse(output) as unknown; }
  catch { throw new Error(`${label} 输出不是有效 JSON`); }
}

/** `projects` is an object with a bounded page; tolerate a bare array from older builds. */
export function parseSessionProjects(output: string): ProjectRef[] {
  const value = jsonValue(output, '1session projects');
  const list = Array.isArray(value) ? value : object(value).projects;
  if (!Array.isArray(list)) throw new Error('1session projects 输出缺少 projects 数组');
  return list.flatMap(item => {
    const row = object(item); const id = isoText(row.id);
    if (!id) return [];
    const workspace = isoText(row.workspace);
    const workspaces = array(row.workspaces).map(isoText).filter(Boolean);
    return [{ id, name: isoText(row.name) || id, ...(workspace ? { workspace } : {}), ...(workspaces.length ? { workspaces } : {}) }];
  });
}

/** Titles may be absent (some providers); absence is preserved instead of invented. */
export function parseSessionList(output: string): SessionRow[] {
  const value = jsonValue(output, '1session list');
  if (!Array.isArray(value)) throw new Error('1session list 输出不是数组');
  return value.map(item => {
    const row = object(item);
    return {
      id: isoText(row.id), provider: isoText(row.provider) || 'unknown',
      ...(isoText(row.title) ? { title: isoText(row.title) } : {}),
      workspace: isoText(row.workspace),
      ...(isoText(row.createdAt) ? { createdAt: isoText(row.createdAt) } : {}),
      updatedAt: isoText(row.updatedAt),
    };
  });
}

export function parseSessionTurns(output: string): SessionTurnSummary[] {
  const value = jsonValue(output, '1session turns');
  if (!Array.isArray(value)) throw new Error('1session turns 输出不是数组');
  return value.flatMap(item => {
    const row = object(item); const raw = row.no;
    const no = typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0 ? raw
      : typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
    if (!Number.isSafeInteger(no)) return [];
    const toolCount = typeof row.toolCount === 'number' && Number.isFinite(row.toolCount) && row.toolCount > 0 ? row.toolCount : 0;
    return [{
      no, toolCount, ...(isoText(row.status) ? { status: isoText(row.status) } : {}),
      ...(isoText(row.startedAt) ? { startedAt: isoText(row.startedAt) } : {}),
      ...(isoText(row.endedAt) ? { endedAt: isoText(row.endedAt) } : {}),
    }];
  });
}

export function parseSessionTurn(output: string): SessionTurnDetail {
  const value = jsonValue(output, '1session turn');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('1session turn 输出不是对象');
  return {
    tools: array(object(value).tools).flatMap(item => {
      const row = object(item); const id = isoText(row.id); const toolName = isoText(row.toolName);
      if (!id || !toolName) return [];
      return [{ id, toolName, ...(isoText(row.status) ? { status: isoText(row.status) } : {}) }];
    }),
  };
}

export function parseSessionCall(output: string): SessionCallDetail {
  const value = jsonValue(output, '1session turn --call');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('1session turn --call 输出不是对象');
  return {
    items: array(object(value).items).map(item => {
      const row = object(item);
      return {
        kind: isoText(row.kind), content: typeof row.content === 'string' ? row.content : '',
        ...(isoText(row.timestamp) ? { timestamp: isoText(row.timestamp) } : {}),
      };
    }),
  };
}

export function sessionCallArgs(items: readonly SessionCallItem[]): string | undefined {
  return items.find(item => item.kind === 'tool_call')?.content || undefined;
}

export function sessionCallResult(items: readonly SessionCallItem[]): string | undefined {
  const result = items.filter(item => item.kind === 'tool_result').map(item => item.content).filter(Boolean).join('\n');
  return result || undefined;
}

/** The call time is the call item timestamp; the result timestamp is only a fallback. */
export function sessionCallTimestamp(items: readonly SessionCallItem[], fallback: string): string {
  const item = items.find(entry => entry.kind === 'tool_call' && entry.timestamp) ?? items.find(entry => entry.timestamp);
  return item?.timestamp || fallback;
}

function looksLikeError(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (/^(?:error|mcp error|tool error|execution error)\b/i.test(trimmed)) return true;
  if (trimmed.startsWith('{')) {
    try { return object(JSON.parse(trimmed)).isError === true; } catch { /* Not a JSON envelope. */ }
  }
  return false;
}

const ERROR_TOOL_STATUS = new Set(['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled', 'timeout', 'timed_out', 'rejected']);
const OK_TOOL_STATUS = new Set(['completed', 'complete', 'succeeded', 'success', 'done', 'ok']);

/** A failed tool status or an error result is a failed docking; missing evidence stays unknown. */
export function sessionCallStatus(toolStatus: string | undefined, resultText: string | undefined): VoyageStopStatus {
  const status = (toolStatus ?? '').trim().toLowerCase();
  if (ERROR_TOOL_STATUS.has(status)) return 'error';
  if (resultText && looksLikeError(resultText)) return 'error';
  if (OK_TOOL_STATUS.has(status)) return 'ok';
  return resultText ? 'ok' : 'unknown';
}

/** Never echo stderr/messages: they can contain raw session paths. Keep the command name and code. */
export function safeSessionError(command: string, error: unknown): string {
  const name = command.split(/[\\/]/).filter(Boolean).at(-1) || '1session';
  if (typeof error === 'string') return `${name} 执行失败`;
  const record = object(error as unknown);
  const code = isoText(record.code);
  if (code === 'ENOENT') return `${name} 未安装或不在 PATH`;
  if (code === 'ETIMEDOUT' || record.killed === true || isoText(record.signal)) return `${name} 读取超时`;
  if (code === 'ENOBUFS') return `${name} 输出超过 8 MiB 上限`;
  if (code) return `${name} 执行失败（${code}）`;
  if (error instanceof Error && /JSON/.test(error.message)) return `${name} 输出格式无效`;
  return `${name} 执行失败（详细信息已省略）`;
}

const timeOf = (value: string | undefined): number => {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : 0;
};

/**
 * Read-only projection of the local 1session index into voyages: project dock → structured
 * DreamMate MCP stops → last dock. All commands are injected, so tests never touch this machine.
 */
export class SessionAdapter {
  private cached?: { at: number; voyages: VoyageView[]; source: SourceView };
  private readonly run: SessionCommandRunner;

  constructor(private readonly config: ObserverConfig, run?: SessionCommandRunner) {
    this.run = run ?? defaultSessionRunner;
  }

  private baseSource(now: string): SourceView {
    return {
      id: SESSION_SOURCE_ID, name: '本地会话与轮次', kind: 'sessions', status: 'unknown', observedAt: now,
      scope: `只读取本机 1session 覆盖的 provider 与最近 ${this.config.sessions.sinceHours} 小时时间窗；不读取原始会话文件内容`,
      diagnostics: [],
    };
  }

  private command(args: string[]): Promise<string> {
    return this.run(this.config.sessions.command, args, this.config.sessions.timeoutMs);
  }

  private originNode(nodes: readonly NodeView[]): NodeView | undefined {
    const localNodeId = this.config.localNodeId;
    return (localNodeId ? nodes.find(node => node.nativeId === localNodeId) : undefined) ?? nodes[0];
  }

  async read(context: SessionSourceContext): Promise<{ voyages: VoyageView[]; source: SourceView }> {
    const settings = this.config.sessions;
    const now = context.now;
    const nowMs = Date.parse(now);
    const reference = Number.isFinite(nowMs) ? nowMs : Date.now();
    const source = this.baseSource(now);
    if (!settings.enabled) {
      source.status = 'unsupported';
      source.diagnostics.push('本地会话来源未启用；不执行 1session 命令，也不读取原始会话文件。');
      return { voyages: [], source };
    }
    if (this.cached && Number.isFinite(nowMs) && nowMs >= this.cached.at && nowMs - this.cached.at < CACHE_MS) {
      return structuredClone({ voyages: this.cached.voyages, source: this.cached.source });
    }

    let projectRefs: ProjectRef[];
    try {
      projectRefs = parseSessionProjects(await this.command(['projects', '--limit', String(PROJECT_LIMIT), '--json']));
    } catch (error) {
      source.status = 'unavailable';
      source.diagnostics.push(`项目目录映射：${safeSessionError(settings.command, error)}；未读取会话，避免给出错误的项目归属。`);
      return { voyages: [], source };
    }

    let rows: SessionRow[];
    try {
      rows = parseSessionList(await this.command(['list', '--scope', settings.scope, '--since', `${settings.sinceHours}h`, '--limit', String(settings.maxSessions), '--json']));
    } catch (error) {
      source.status = 'unavailable';
      source.diagnostics.push(`会话列表：${safeSessionError(settings.command, error)}；未返回任何航次，也不把失败当作空结果。`);
      return { voyages: [], source };
    }

    const diagnostics: string[] = [];
    let partial = false;
    let callsUsed = 0;
    let budgetExhausted = false;
    const voyages: VoyageView[] = [];
    const origin = this.originNode(context.nodes);

    const sessions: SessionRow[] = [];
    for (const session of rows) {
      if (!session.id) { partial = true; diagnostics.push('会话列表存在缺少 id 的记录，已跳过'); continue; }
      sessions.push(session);
    }
    sessions.sort((left, right) => timeOf(right.updatedAt) - timeOf(left.updatedAt) || left.id.localeCompare(right.id));
    if (sessions.length >= settings.maxSessions) {
      partial = true;
      diagnostics.push(`会话列表达到上限 ${settings.maxSessions} 条，可能未覆盖时间窗内更早的会话`);
    }
    const selected = sessions.slice(0, settings.maxSessions);

    try {
      for (const session of selected) {
        const idLabel = session.id.slice(0, 8);
        const calls: McpCallView[] = [];
        try {
          const summaries = parseSessionTurns(await this.command(['turns', session.id, '--json']));
          const eligible = summaries.filter(summary => summary.toolCount > 0)
            .sort((left, right) => right.no - left.no || timeOf(right.startedAt) - timeOf(left.startedAt));
          if (eligible.length > settings.maxTurns) {
            partial = true;
            diagnostics.push(`会话 ${idLabel} 达到轮次上限 ${settings.maxTurns}，只读取最近轮次`);
          }
          const turns = eligible.slice(0, settings.maxTurns).sort((left, right) => left.no - right.no || timeOf(left.startedAt) - timeOf(right.startedAt));
          for (const turn of turns) {
            if (budgetExhausted) break;
            let detail: SessionTurnDetail;
            try {
              detail = parseSessionTurn(await this.command(['turn', session.id, String(turn.no), '--json']));
            } catch (error) {
              partial = true;
              diagnostics.push(`会话 ${idLabel} 轮次 ${turn.no}：${safeSessionError(settings.command, error)}，该轮停靠点缺失`);
              continue;
            }
            const dreamMateTools = detail.tools.filter(tool => isDreamMateTool(tool.toolName));
            for (const tool of dreamMateTools) {
              if (callsUsed >= settings.maxCalls) {
                budgetExhausted = true;
                partial = true;
                diagnostics.push(`DreamMate MCP 调用达到全局上限 ${settings.maxCalls} 次，后续调用未读取`);
                break;
              }
              callsUsed += 1;
              const fallbackAt = session.updatedAt || now;
              let items: SessionCallItem[] = [];
              try { items = parseSessionCall(await this.command(['turn', session.id, String(turn.no), '--call', tool.id, '--json'])).items; }
              catch (error) {
                partial = true;
                diagnostics.push(`会话 ${idLabel} 轮次 ${turn.no} 调用 ${tool.id.slice(0, 12)}：${safeSessionError(settings.command, error)}，保留工具名但参数与结果缺失`);
              }
              const argsText = sessionCallArgs(items);
              calls.push({
                toolName: tool.toolName,
                at: items.length ? sessionCallTimestamp(items, fallbackAt) : fallbackAt,
                status: sessionCallStatus(tool.status, sessionCallResult(items)),
                ...(argsText ? { argsText } : {}),
                evidence: [{
                  sourceId: SESSION_SOURCE_ID, nativeId: `${session.id}/${turn.no}/${tool.id}`,
                  locator: `1session://session/${encodeURIComponent(session.id)}/turn/${turn.no}/call/${encodeURIComponent(tool.id)}`,
                  observedAt: now,
                  note: `结构化 DreamMate MCP 工具调用；状态来自 ${session.provider} 会话轮次摘要`,
                }],
              });
            }
          }
        } catch (error) {
          partial = true;
          diagnostics.push(`会话 ${idLabel} 的轮次：${safeSessionError(settings.command, error)}，该航次无停靠点`);
        }

        const matched = matchProjectForWorkspace(session.workspace, projectRefs);
        const projectName = matched?.name ?? (session.workspace ? workspaceLabel(session.workspace) : '未归属项目');
        const voyageId = `${SESSION_SOURCE_ID}/voyage/${encodeURIComponent(session.id)}`;
        const stops = buildVoyageStops(voyageId, calls, context.nodes, context.services, this.config.localNodeId);
        const destination = voyageDestination(stops, origin?.id, projectName);
        const updatedAt = session.updatedAt || now;
        const title = redactWorkspacePath(session.title?.trim() || (session.workspace ? workspaceLabel(session.workspace) : '未命名会话'));
        voyages.push({
          id: voyageId, nativeId: session.id, kind: 'session', sourceId: SESSION_SOURCE_ID,
          provider: session.provider, title,
          projectId: voyageProjectId(matched?.id ?? (session.workspace || session.id)),
          projectName,
          ...(origin ? { originNodeId: origin.id } : {}),
          startedAt: session.createdAt || updatedAt,
          updatedAt,
          status: voyageStatus(updatedAt, reference),
          stops,
          ...(destination.destinationNodeId ? { destinationNodeId: destination.destinationNodeId } : {}),
          destinationLabel: destination.destinationLabel,
          mcpCalls: calls.length,
          evidence: [{
            sourceId: SESSION_SOURCE_ID, nativeId: session.id,
            locator: `1session://session/${encodeURIComponent(session.id)}`, observedAt: now,
            note: `${session.provider} 会话摘要；workspace 仅用于匹配项目，不写入快照。未读取原始会话文件内容`,
          }],
        });
      }
    } catch (error) {
      partial = true;
      diagnostics.push(`会话处理中断：${safeSessionError(settings.command, error)}；已保留成功读取的航次`);
    }

    let result = sortVoyages(voyages);
    if (result.length > settings.maxSessions) {
      partial = true;
      result = result.slice(0, settings.maxSessions);
      diagnostics.push(`航次达到上限 ${settings.maxSessions} 条，已截断`);
    }
    const unique = [...new Set(diagnostics)];
    source.diagnostics.push(...unique.slice(0, 24));
    if (unique.length > 24) source.diagnostics.push(`另有 ${unique.length - 24} 条覆盖缺口诊断未展开`);
    if (!result.length) source.diagnostics.push('时间窗内没有列出会话；不代表本机没有更早会话或其他 provider 记录');
    source.diagnostics.push('只识别结构化 DreamMate MCP 工具名（含 mcp__ 前缀），不解析 exec/bash 脚本中嵌入的调用。');
    source.diagnostics.push('会话、轮次与调用来自本机 1session 只读 CLI；缓存 60 秒，不写文件、不启动服务。');
    source.status = partial ? 'partial' : 'ok';
    source.observedAt = now;

    const response = { voyages: result, source };
    this.cached = { at: Number.isFinite(nowMs) ? nowMs : Date.now(), voyages: structuredClone(result), source: structuredClone(source) };
    return response;
  }
}
