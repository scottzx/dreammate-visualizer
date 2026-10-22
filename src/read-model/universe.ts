import type { ObserverSnapshot, ProjectView } from './types';
export type { ProjectView } from './types';

export interface NodeSummary {
  services: number | null; methods: number | null; skills: number | null;
  projects: number | null; agentRuntimes: number | null; catalogKnown: boolean; partial: boolean;
}
export interface BaseLot {
  id: string; type: 'service' | 'academy' | 'agents' | 'project'; name: string; nodeId: string;
  grade: 1 | 2 | 3; serviceId?: string; projectId?: string; count: number | null; status: string; placeholder?: boolean;
}
export const PROJECT_GRADE_THRESHOLDS = [0, 10, 50] as const;
export function projectGrade(sessionCount: number | null): 1 | 2 | 3 {
  return sessionCount !== null && sessionCount >= PROJECT_GRADE_THRESHOLDS[2] ? 3
    : sessionCount !== null && sessionCount >= PROJECT_GRADE_THRESHOLDS[1] ? 2 : 1;
}

export function summarizeNode(snapshot: ObserverSnapshot, nodeId: string): NodeSummary {
  const node = snapshot.nodes.find(item => item.id === nodeId);
  const services = snapshot.services.filter(item => item.nodeId === nodeId);
  const catalogKnown = Boolean(node?.catalogAvailable || services.length);
  const hasSkillObservation = services.some(service => service.skillsStatus === 'ok' || service.skillsStatus === 'partial' || Boolean(service.skillsObservedAt) || service.skills.length > 0);
  return {
    services: catalogKnown ? services.length : null,
    methods: catalogKnown ? services.reduce((sum, service) => sum + service.methods.length, 0) : null,
    skills: catalogKnown && hasSkillObservation ? services.reduce((sum, service) => sum + service.skills.length, 0) : null,
    projects: snapshot.projects === undefined ? null : new Set(snapshot.projects.filter(project => project.nodeIds.includes(nodeId)).map(project => project.id)).size,
    agentRuntimes: catalogKnown ? services.filter(service => ['agent_runtime', 'agent'].includes(service.kind)).length : null,
    catalogKnown,
    partial: Boolean(node && node.status !== 'ok') || services.some(service => service.skillsStatus !== undefined && service.skillsStatus !== 'ok'),
  };
}

export function buildBaseLots(snapshot: ObserverSnapshot, nodeId: string): BaseLot[] {
  const summary = summarizeNode(snapshot, nodeId);
  const services = snapshot.services.filter(service => service.nodeId === nodeId).sort((a, b) => a.id.localeCompare(b.id));
  const lots: BaseLot[] = services.map(service => ({
    id: `lot:${service.id}`, type: 'service', name: service.name, nodeId, serviceId: service.id,
    grade: service.methods.length >= 30 ? 3 : service.methods.length >= 10 ? 2 : 1,
    count: service.methods.length, status: service.status,
  }));
  if (summary.agentRuntimes !== null && summary.agentRuntimes > 0) lots.unshift({ id: `lot:agents:${nodeId}`, type: 'agents', name: '智能体驻地', nodeId, grade: summary.agentRuntimes >= 3 ? 3 : 2, count: summary.agentRuntimes, status: 'declared' });
  lots.push({ id: `lot:academy:${nodeId}`, type: 'academy', name: '技能学院', nodeId, grade: summary.skills !== null && summary.skills >= 100 ? 3 : summary.skills !== null && summary.skills >= 10 ? 2 : 1, count: summary.skills, status: summary.partial ? 'partial' : summary.skills === null ? 'unknown' : 'ok' });
  if (snapshot.projects === undefined) lots.push({ id: `lot:projects:unconnected:${nodeId}`, type: 'project', name: '项目目录待接入', nodeId, grade: 1, count: null, status: 'unknown', placeholder: true });
  else for (const project of snapshot.projects.filter(project => project.nodeIds.includes(nodeId)).sort((a, b) => a.id.localeCompare(b.id))) lots.push({ id: `lot:${project.id}`, type: 'project', name: project.name, nodeId, projectId: project.id, grade: projectGrade(project.sessionCount), count: project.sessionCount, status: project.status });
  return lots;
}

/** Host-attributed sessions, not work quality, execution time, or a unique agent identity. */
export function projectProviderShares(project: ProjectView): { name: string; count: number; share: number; percent: number }[] {
  const counts = new Map<string, number>();
  for (const provider of project.providers) if (Number.isFinite(provider.count) && provider.count > 0) {
    const name = provider.name.trim() || '未归属'; counts.set(name, (counts.get(name) ?? 0) + Math.floor(provider.count));
  }
  const observed = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const total = Math.max(observed, project.sessionCount ?? 0);
  if (!total) return [];
  if (total > observed) counts.set('未归属', (counts.get('未归属') ?? 0) + total - observed);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count, share: count / total, percent: 100 * count / total }));
}
