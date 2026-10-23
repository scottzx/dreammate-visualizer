import type { EventView, ObserverSnapshot, Selection, ServiceView, SkillView } from '../read-model/types';

export interface LayoutAssignment { id: string; slot: number }
export interface FactoryPlot extends LayoutAssignment { x: number; z: number; variant: number }
export interface FactoryLayout {
  assignments: LayoutAssignment[];
  plots: Map<string, FactoryPlot>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export const EVENT_PULSE_WINDOW_MS = 90_000;
export const FACTORY_LAYOUT_STORAGE_KEY = 'dreammate.factory-layout.v1';
const SPACING_X = 10.2;
const SPACING_Z = 10.4;

/** Hash the complete, namespaced identity, never a display name or array index. */
export function stableNodeHash(identity: string): number {
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Six central plots form the first workshop block. Additional plots grow outwards.
const PLOT_CELLS: [number, number][] = [
  [-1, -0.5], [0, -0.5], [1, -0.5], [-1, 0.5], [0, 0.5], [1, 0.5],
  [-2, -0.5], [-2, 0.5], [2, -0.5], [2, 0.5],
  [-1, -1.5], [0, -1.5], [1, -1.5], [-1, 1.5], [0, 1.5], [1, 1.5],
  [-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5],
  [-1, -2.5], [0, -2.5], [1, -2.5], [-1, 2.5], [0, 2.5], [1, 2.5],
  [-2, -2.5], [2, -2.5], [-2, 2.5], [2, 2.5],
];

function slotCell(slot: number): [number, number] {
  const known = PLOT_CELLS[slot];
  if (known) return known;
  // No overlapping positions if a configured source exceeds the 30-plot overview.
  return [3 + Math.floor((slot - PLOT_CELLS.length) / 6), (slot - PLOT_CELLS.length) % 6 - 2.5];
}

/**
 * Persist assignments across snapshots, including temporarily missing identities.
 * The hash chooses a home plot; collisions reserve a distinct plot. Registration
 * order is canonical so a new browser also reproduces a reordered first snapshot.
 * Filtering is deliberately a rendering concern: pass all snapshot identities.
 */
export function createFactoryLayout(nodeIds: readonly string[], saved: readonly LayoutAssignment[] = []): FactoryLayout {
  const slots = new Map<string, number>();
  const occupied = new Set<number>();
  for (const assignment of saved) {
    if (!assignment || typeof assignment.id !== 'string' || !Number.isSafeInteger(assignment.slot)
      || assignment.slot < 0 || assignment.slot > 100_000 || occupied.has(assignment.slot) || slots.has(assignment.id)) continue;
    slots.set(assignment.id, assignment.slot);
    occupied.add(assignment.slot);
  }
  const identities = [...new Set(nodeIds)];
  const additions = identities.filter((id) => !slots.has(id))
    .sort((a, b) => stableNodeHash(a) - stableNodeHash(b) || a.localeCompare(b));
  for (const id of additions) {
    let slot = stableNodeHash(id) % 6;
    while (occupied.has(slot)) slot += 1;
    slots.set(id, slot);
    occupied.add(slot);
  }
  const plots = new Map<string, FactoryPlot>();
  for (const id of identities) {
    const slot = slots.get(id)!;
    const [column, row] = slotCell(slot);
    plots.set(id, { id, slot, x: column * SPACING_X, z: row * SPACING_Z, variant: stableNodeHash(id) % 3 });
  }
  const positions = [...plots.values()];
  return {
    assignments: [...slots].map(([id, slot]) => ({ id, slot })),
    plots,
    bounds: {
      minX: Math.min(-9, ...positions.map((plot) => plot.x - 5)),
      maxX: Math.max(9, ...positions.map((plot) => plot.x + 5)),
      minZ: Math.min(-9, ...positions.map((plot) => plot.z - 5)),
      maxZ: Math.max(9, ...positions.map((plot) => plot.z + 5)),
    },
  };
}

export function isRecentFactoryEvent(event: EventView, referenceTime: number): boolean {
  const age = referenceTime - Date.parse(event.occurredAt);
  return Number.isFinite(age) && age >= 0 && age <= EVENT_PULSE_WINDOW_MS;
}

export function resolveSkillSelection(snapshot: ObserverSnapshot, selection: Selection | null): { service: ServiceView; skill: SkillView } | undefined {
  if (selection?.type !== 'skill') return undefined;
  const service = snapshot.services.find(item => item.id === selection.serviceId);
  const skill = service?.skills.find(item => item.id === selection.id);
  return service && skill ? { service, skill } : undefined;
}

export function selectionNodeIds(snapshot: ObserverSnapshot, selection: Selection | null): Set<string> {
  if (!selection) return new Set();
  if (selection.type === 'node') return new Set([selection.id]);
  if (selection.type === 'service') {
    const service = snapshot.services.find((item) => item.id === selection.id);
    return new Set(service ? [service.nodeId] : []);
  }
  if (selection.type === 'skill') {
    const selected = resolveSkillSelection(snapshot, selection);
    return new Set(selected ? [selected.service.nodeId] : []);
  }
  if (selection.type === 'event') {
    const event = snapshot.events.find((item) => item.id === selection.id);
    return new Set(event ? [event.nodeId, event.targetNodeId].filter((id): id is string => Boolean(id)) : []);
  }
  const job = snapshot.jobs.find((item) => item.id === selection.id);
  return new Set(job?.attempts.map((attempt) => attempt.nodeId).filter((id): id is string => Boolean(id)) ?? []);
}

export function factoryConnections(snapshot: ObserverSnapshot, selection: Selection | null, visibleIds: Set<string>, referenceTime: number): EventView[] {
  const selectedNodes = selectionNodeIds(snapshot, selection);
  const connections = new Map<string, EventView>();
  for (const event of snapshot.events) {
    if (!event.causalConfirmed || !event.nodeId || !event.targetNodeId || event.nodeId === event.targetNodeId
      || !visibleIds.has(event.nodeId) || !visibleIds.has(event.targetNodeId)) continue;
    const selected = (selection?.type === 'event' && selection.id === event.id)
      || (selection?.type === 'job' && selection.id === event.jobId)
      || ((selection?.type === 'node' || selection?.type === 'service')
        && (selectedNodes.has(event.nodeId) || selectedNodes.has(event.targetNodeId)));
    if (!selected && !isRecentFactoryEvent(event, referenceTime)) continue;
    const pair = `${event.nodeId.length}:${event.nodeId}${event.targetNodeId}`;
    const previous = connections.get(pair);
    if (!previous || Date.parse(event.occurredAt) > Date.parse(previous.occurredAt)) connections.set(pair, event);
  }
  return [...connections.values()];
}
