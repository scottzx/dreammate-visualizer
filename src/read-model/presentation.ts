import type { CoverageStatus, ObserverSnapshot, WorkStatus } from './types';

export const workStatusLabels: Record<WorkStatus, string> = {
  queued: '排队', running: '执行中', input_required: '等待用户', succeeded: '已完成',
  failed: '失败', canceled: '已取消', rejected: '已拒绝', unknown: '未知',
};
export const coverageLabels: Record<CoverageStatus, string> = {
  ok: '已采集', offline: '离线', unavailable: '不可用', forbidden: '无权限',
  unsupported: '不支持', partial: '部分覆盖', stale: '已过期', unknown: '范围未知',
};

/** Counts only facts explicitly available in this snapshot; no inferred busy state. */
export function snapshotFacts(snapshot: ObserverSnapshot) {
  return {
    discoveredNodes: snapshot.nodes.length,
    verifiedOnlineNodes: snapshot.nodes.filter(n => n.online === true && n.status !== 'stale').length,
    unknownNodes: snapshot.nodes.filter(n => n.online === null || n.status === 'unknown').length,
    serviceInstances: snapshot.services.length,
    healthyServices: snapshot.services.filter(s => s.status === 'up' && s.observedAt !== null).length,
    methodInstances: snapshot.services.reduce((total, s) => total + s.methods.length, 0),
    skillDeclarations: snapshot.services.reduce((total, s) => total + s.skills.length, 0),
    jobs: snapshot.jobs.length,
    attempts: snapshot.jobs.reduce((total, j) => total + j.attempts.length, 0),
    jobStatusCoverageKnown: snapshot.jobs.length > 0 || snapshot.sources.some(s => s.kind === 'acp' && Boolean(s.jobsObservedAt)),
    totalProtocolCalls: null,
    totalSessions: null,
    totalTurns: null,
  };
}
