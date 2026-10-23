import type { CoverageStatus, ObserverSnapshot, ProjectCategory, ProjectStorageView, ServiceView, SkillView } from './types';
import { nodeStorageBytes } from './storage';

export const PROJECT_COLORS = { 'business-agent': '#679bff', perception: '#59d7ab', other: '#a9a1c7', unknown: '#737c89' } as const;
export const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = { 'business-agent': '业务智能体', perception: '感知能力', other: '其他已测项目' };
export interface PlanetSkill extends SkillView { serviceId: string; cached: boolean }
export interface PlanetContents { services: ServiceView[]; skills: PlanetSkill[]; skillsStatus: CoverageStatus; catalogKnown: boolean }

/** One visible catalogue identity = one point. Names alone never merge packages. */
export function planetContents(snapshot: ObserverSnapshot, nodeId: string): PlanetContents {
  const services = snapshot.services.filter(service => service.nodeId === nodeId).sort((a, b) => a.id.localeCompare(b.id));
  const skills = new Map<string, PlanetSkill>();
  for (const service of services) for (const skill of service.skills) {
    if (!skill.id) continue;
    const cached = service.skillsStatus === 'stale';
    const previous = skills.get(skill.id);
    if (!previous || (previous.cached && !cached)) skills.set(skill.id, { ...skill, serviceId: service.id, cached });
  }
  const catalogKnown = Boolean(snapshot.nodes.find(node => node.id === nodeId)?.catalogAvailable || services.length);
  const observed = services.some(service => service.skillsObservedAt || service.skillsStatus === 'ok' || service.skills.length);
  const skillsStatus = !catalogKnown || !observed ? 'unknown' : services.some(service => service.skillsStatus !== 'ok') ? 'partial' : 'ok';
  return { services, skills: [...skills.values()].sort((a, b) => a.id.localeCompare(b.id)), skillsStatus, catalogKnown };
}

export interface ProjectStorageRow extends ProjectStorageView { id: string; name: string }
export interface PlanetStorageComposition {
  totalBytes: number | null; measuredBytes: number; remainderBytes: number | null; status: CoverageStatus;
  rows: ProjectStorageRow[]; segments: { category: ProjectCategory; bytes: number; share: number | null }[];
}

/** Fractions use measured disk capacity only. A 128 GB display default is never a denominator. */
export function planetStorageComposition(snapshot: ObserverSnapshot, nodeId: string): PlanetStorageComposition {
  const totalBytes = nodeStorageBytes(snapshot.nodes.find(node => node.id === nodeId));
  const seen = new Map<string, ProjectStorageRow>();
  const rows: ProjectStorageRow[] = [];
  for (const project of snapshot.projects ?? []) for (const storage of project.storage ?? []) {
    if (storage.nodeId !== nodeId) continue;
    const identity = `${storage.nodeId}:${storage.path}`;
    const previous = seen.get(identity);
    if (previous) {
      if (previous.bytes !== storage.bytes || previous.category !== storage.category || previous.status !== storage.status) {
        previous.bytes = null; previous.status = 'partial'; previous.note = '同一目录的项目存储记录冲突，未计入占比';
      }
      continue;
    }
    const row = { ...storage, id: project.id, name: project.name };
    seen.set(identity, row); rows.push(row);
  }
  const valid = rows.filter(row => row.metric === 'allocated-disk-bytes' && row.status === 'ok' && row.bytes !== null && Number.isSafeInteger(row.bytes) && row.bytes >= 0);
  const measuredBytes = valid.reduce((sum, row) => sum + row.bytes!, 0);
  const canDivide = valid.length > 0 && totalBytes !== null && measuredBytes <= totalBytes && Number.isSafeInteger(measuredBytes);
  const segments = (['business-agent', 'perception', 'other'] as const).map(category => {
    const bytes = valid.filter(row => row.category === category).reduce((sum, row) => sum + row.bytes!, 0);
    return { category, bytes, share: canDivide ? bytes / totalBytes : null };
  });
  return { totalBytes, measuredBytes, remainderBytes: canDivide ? totalBytes - measuredBytes : null,
    status: !rows.length ? 'unknown' : !canDivide || valid.length !== rows.length ? 'partial' : 'ok', rows, segments };
}

export function formatStorageBytes(bytes: number): string {
  if (bytes >= 1e12) return `${Number((bytes / 1e12).toFixed(2))} TB`;
  if (bytes >= 1e9) return `${Number((bytes / 1e9).toFixed(2))} GB`;
  if (bytes >= 1e6) return `${Number((bytes / 1e6).toFixed(1))} MB`;
  if (bytes >= 1e3) return `${Number((bytes / 1e3).toFixed(1))} KB`;
  return `${bytes} B`;
}
export function formatStorageShare(share: number | null): string {
  return share === null ? '比例未知' : share > 0 && share < .0001 ? '<0.01%' : `${Number((share * 100).toFixed(2))}%`;
}
