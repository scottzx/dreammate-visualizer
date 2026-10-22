import type { AttemptView, EventView, JobView, SourceView, WorkStatus } from '../read-model/types';
import type { AcpSourceConfig, ObserverConfig } from '../observer/config';
import { array, failure, object, readJson, SourceError, string, type JsonObject } from './http';

export function workStatus(value: unknown): WorkStatus {
  switch (value) {
    case 'not_started': case 'submitted': case 'queued': return 'queued';
    case 'working': case 'running': return 'running';
    case 'input_required': case 'auth_required': return 'input_required';
    case 'completed': case 'succeeded': return 'succeeded';
    case 'failed': case 'canceled': case 'rejected': return value;
    default: return 'unknown';
  }
}

export interface AcpResult { jobs: JobView[]; events: EventView[]; source: SourceView }
export type AcpInvoke = (method: 'execution_list' | 'execution_events', params: JsonObject) => Promise<JsonObject>;
const idPart = (value: string) => encodeURIComponent(value);

/** One adapter is one immutable configured origin/filter scope. No discovery of origins. */
export class AcpAdapter {
  private nativeSourceId: string | null = null;
  private cursor = 0;
  private events = new Map<string, EventView>();
  private previous?: AcpResult;
  private readonly invoke: AcpInvoke;
  constructor(readonly config: AcpSourceConfig, private readonly options: Pick<ObserverConfig, 'timeoutMs' | 'maxPages' | 'staleAfterMs'>, invoke?: AcpInvoke) {
    if (!config.originSessionId.trim()) throw new Error('ACP 观察必须配置明确 originSessionId');
    this.invoke = invoke ?? ((method, params) => {
      const url = config.url ? `${config.url}/invoke` : `${config.nodeUrl}/services/${idPart(config.serviceId ?? '')}/invoke`;
      return readJson(url, options.timeoutMs, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, params }) });
    });
  }
  private get sourceId(): string { return `acp:${idPart(this.config.id)}:${idPart(this.nativeSourceId ?? 'unknown')}:${idPart(this.config.originSessionId)}:${idPart(this.config.jobId ?? '*')}`; }
  private jobId(nativeId: string): string { return `${this.sourceId}/job/${idPart(nativeId)}`; }
  private attemptId(nativeId: string): string { return `${this.sourceId}/attempt/${idPart(nativeId)}`; }

  private normalizeJob(value: unknown, now: string): JobView | null {
    const row = object(value); const nativeId = string(row.jobId);
    if (!nativeId || string(row.originSessionId) !== this.config.originSessionId || string(row.sourceId) !== this.nativeSourceId) return null;
    const attempts: AttemptView[] = array(row.attempts).flatMap(value => {
      const attempt = object(value); const nativeId = string(attempt.attemptId);
      if (!nativeId || string(attempt.jobId) !== row.jobId) return [];
      const sessionId = string(object(attempt.backendRunRef).sessionId);
      return [{ id: this.attemptId(nativeId), nativeId, status: workStatus(attempt.executionStatus), sourceStatus: string(attempt.executionStatus, 'unknown'), agent: string(object(attempt.targetSnapshot).roleId) || string(attempt.targetId) || undefined, startedAt: string(attempt.createdAt) || undefined, updatedAt: string(attempt.updatedAt, now), session: sessionId ? { id: sessionId, provider: string(attempt.provider) || undefined, confirmed: true } : undefined, evidence: [{ sourceId: this.sourceId, nativeId, observedAt: now, note: attempt.stale === true ? '来源标记此执行尝试 stale，业务状态保留原值' : 'ACP origin 范围内执行尝试；目标未显式绑定设备' }] }];
    });
    return { id: this.jobId(nativeId), nativeId, sourceId: this.sourceId, originSessionId: this.config.originSessionId, title: string(row.title, `工作单 ${nativeId.slice(0, 8)}`), status: workStatus(row.executionStatus), sourceStatus: string(row.executionStatus, 'unknown'), updatedAt: string(row.updatedAt, now), trigger: 'unknown', acceptance: string(object(row.businessAcceptance).reviewStatus, 'unknown'), attempts, evidence: [{ sourceId: this.sourceId, nativeId, observedAt: now, note: '来源 execution_list；Session origin 不能证明最终触发者是人' }] };
  }

  private normalizeEvent(value: unknown, now: string, jobs: Map<string, JobView>): EventView | null {
    const row = object(value); const nativeId = string(row.eventId); const nativeJobId = string(row.jobId); const sequence = row.sequence;
    if (!nativeId || string(row.sourceId) !== this.nativeSourceId || !Number.isSafeInteger(sequence) || (sequence as number) < 1 || !nativeJobId) return null;
    if (this.config.jobId && nativeJobId !== this.config.jobId) return null;
    const job = jobs.get(nativeJobId); const attempt = job?.attempts.find(attempt => attempt.nativeId === row.attemptId);
    const data = object(row.data); const type = string(row.type, 'unknown');
    const status = workStatus(data.executionStatus ?? (type.endsWith('prepared') ? 'submitted' : 'unknown'));
    return { id: `${this.sourceId}/event/${idPart(nativeId)}`, sourceId: this.sourceId, sequence: sequence as number, type, title: `${job?.title ?? `工作单 ${nativeJobId.slice(0, 8)}`} · ${type}`, status, occurredAt: string(row.observedAt, now), observedAt: now, jobId: this.jobId(nativeJobId), attemptId: string(row.attemptId) ? this.attemptId(string(row.attemptId)) : undefined, sessionId: attempt?.session?.id, protocol: 'A2A', causalConfirmed: false, evidence: [{ sourceId: this.sourceId, nativeId, observedAt: now, note: '持久 LedgerEvent；没有标准跨 Node 父调用字段，不推测设备连线' }] };
  }

  async read(now = new Date().toISOString()): Promise<AcpResult> {
    const diagnostics: string[] = []; let rawJobs: unknown[] = []; let listComplete = true;
    try {
      let offset = 0;
      for (let page = 0; page < this.options.maxPages; page++) {
        const result = await this.invoke('execution_list', { originSessionId: this.config.originSessionId, limit: 200, offset });
        if (!Array.isArray(result.jobs) || typeof result.total !== 'number' || result.total < 0) throw new SourceError('execution_list 缺少 jobs/total，范围未知', 'partial');
        rawJobs.push(...result.jobs);
        offset += result.jobs.length;
        if (offset >= result.total) break;
        if (!result.jobs.length) throw new SourceError('工作单分页未前进', 'partial');
        if (page === this.options.maxPages - 1) { diagnostics.push('工作单达到分页上限，仅部分覆盖'); listComplete = false; }
      }
    } catch (error) { diagnostics.push(`工作单：${failure(error).message}`); listComplete = false; }

    const listSourceIds = [...new Set(rawJobs.map(value => string(object(value).sourceId)).filter(Boolean))];
    if (listSourceIds.length > 1) { diagnostics.push('工作单页混入多个 ledger source，未合并身份'); rawJobs = []; listComplete = false; }
    const listSource = listSourceIds.length === 1 ? listSourceIds[0] : null;
    if (listSource && listSource !== this.nativeSourceId) { this.nativeSourceId = listSource; this.cursor = 0; this.events.clear(); this.previous = undefined; }

    // Stage every page with its cursor. A failed page leaves the last fully read page committed.
    let eventFailure: ReturnType<typeof failure> | undefined;
    const pendingEvents: unknown[] = [];
    try {
      let resets = 0;
      for (let page = 0; page < this.options.maxPages; page++) {
        const previousCursor = this.cursor;
        const result = await this.invoke('execution_events', { originSessionId: this.config.originSessionId, ...(this.config.jobId ? { jobId: this.config.jobId } : {}), afterSequence: previousCursor, limit: 500 });
        const source = string(result.sourceId);
        if (!source || !Array.isArray(result.events)) throw new SourceError('execution_events 缺少 sourceId/events，游标未推进', 'partial');
        if (this.nativeSourceId && source !== this.nativeSourceId) {
          if (++resets > 1) throw new SourceError('ledger 身份持续变化，暂停本轮增量', 'partial');
          this.nativeSourceId = source; this.cursor = 0; this.events.clear(); this.previous = undefined; pendingEvents.length = 0; rawJobs = []; listComplete = false;
          diagnostics.push('ledger source 已变化，旧游标已隔离并从 0 重建；工作单待下轮对账'); page--; continue;
        }
        this.nativeSourceId = source;
        const rows = result.events.map(object);
        if (rows.some(event => string(event.sourceId) !== source || !string(event.eventId) || !Number.isSafeInteger(event.sequence) || (event.sequence as number) < 1 || !string(event.jobId))) throw new SourceError('事件页身份或 sequence 格式不完整，游标未推进', 'partial');
        const maxSequence = Math.max(previousCursor, ...rows.map(row => row.sequence as number));
        const next = typeof result.nextSequence === 'number' && Number.isSafeInteger(result.nextSequence) ? result.nextSequence : maxSequence;
        if (next < maxSequence || next < previousCursor || (result.hasMore === true && next <= previousCursor)) throw new SourceError('事件分页游标未前进或落后于页面，未提交该页', 'partial');
        pendingEvents.push(...rows);
        this.cursor = next;
        if (result.hasMore !== true) break;
        if (page === this.options.maxPages - 1) diagnostics.push('事件达到分页上限，下一轮从已提交游标继续补齐');
      }
    } catch (error) { eventFailure = failure(error); diagnostics.push(`事件：${eventFailure.message}；保留旧事件及最后完整页游标`); }

    const jobsByNativeId = new Map<string, JobView>();
    if (!listComplete && this.previous) for (const job of this.previous.jobs) jobsByNativeId.set(job.nativeId, job);
    for (const value of rawJobs) {
      if (this.config.jobId && string(object(value).jobId) !== this.config.jobId) continue;
      const job = this.normalizeJob(value, now);
      if (job) jobsByNativeId.set(job.nativeId, job); else { diagnostics.push('已跳过 origin/source/身份不匹配的工作单'); listComplete = false; }
    }
    for (const value of pendingEvents) {
      const event = this.normalizeEvent(value, now, jobsByNativeId);
      if (event) this.events.set(event.id, event);
    }
    // Keep a bounded display history; source-native IDs ensure replays never add duplicates.
    const events = [...this.events.values()].sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0)).slice(0, 300);
    this.events = new Map(events.map(event => [event.id, event]));
    const success = listComplete && !eventFailure;
    const previousAt = this.previous?.source.observedAt ?? null;
    const stale = !success && previousAt !== null && Date.parse(now) - Date.parse(previousAt) > this.options.staleAfterMs;
    const result: AcpResult = { jobs: [...jobsByNativeId.values()], events, source: { id: this.sourceId, name: this.config.name || this.config.id, kind: 'acp', status: stale ? 'stale' : diagnostics.length ? (eventFailure && !this.previous && !rawJobs.length ? eventFailure.status : 'partial') : 'ok', jobsObservedAt: listComplete || (rawJobs.length > 0 && jobsByNativeId.size > 0) ? now : this.previous?.source.jobsObservedAt ?? null, scope: `显式授权 origin=${this.config.originSessionId}${this.config.jobId ? ` / job=${this.config.jobId}` : ''}；ledger=${this.nativeSourceId ?? 'unknown'}；事件游标=${this.cursor}`, observedAt: success ? now : previousAt, url: this.config.url || this.config.nodeUrl, diagnostics } };
    if (success || rawJobs.length || pendingEvents.length) this.previous = structuredClone(result);
    return result;
  }
}
