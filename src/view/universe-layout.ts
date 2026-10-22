import type { ObserverSnapshot } from '../read-model/types';
import { nodeStorageRadius } from '../read-model/storage';
import { stableNodeHash, type LayoutAssignment } from './layout';

export const UNIVERSE_LAYOUT_STORAGE_KEY = 'dreammate.universe-layout.v2';
export const UNIVERSE_NEIGHBOR_ARC_LENGTH = 16;
export interface UniversePlot {
  id: string; slot: number; x: number; y: number; z: number;
  orbitRadius: number;
}
export interface UniverseLayout { assignments: LayoutAssignment[]; plots: Map<string, UniversePlot>; rings: number[]; radius: number }
export interface UniversePeerConnection { from: string; to: string }
export interface UniverseLabelAnchor { id: string; x: number; y: number; width: number; height: number; priority: number }
export interface UniverseScreenObstacle { x: number; y: number; radius: number }
export interface UniverseLabelPlacement { x: number; y: number; visible: boolean }

/** Keep text clear of every planet as well as other text. */
export function placeUniverseLabels(anchors: UniverseLabelAnchor[], planets: UniverseScreenObstacle[], width: number, height: number): Map<string, UniverseLabelPlacement> {
  const result = new Map<string, UniverseLabelPlacement>();
  const placed: { left: number; right: number; top: number; bottom: number }[] = [];
  const shifts = [0, -62, 62, -124, 124, -186, 186, -248, 248, -310, 310]
    .flatMap((dy) => [0, -160, 160, -320, 320, -480, 480].map((dx) => ({ dx, dy })))
    .sort((a, b) => a.dx ** 2 + a.dy ** 2 - b.dx ** 2 - b.dy ** 2);
  for (const anchor of [...anchors].sort((a, b) => a.priority - b.priority || a.y - b.y || a.id.localeCompare(b.id))) {
    let found = false;
    for (const shift of shifts) {
      const x = Math.max(anchor.width / 2 + 15, Math.min(width - anchor.width / 2 - 15, anchor.x + shift.dx));
      const y = anchor.y + shift.dy;
      if (y < anchor.height + 45 || y > height - 65) continue;
      // The last 17 px is a thin leader; allow it to point towards a planet.
      const rect = { left: x - anchor.width / 2 - 6, right: x + anchor.width / 2 + 6, top: y - anchor.height - 6, bottom: y - 17 + 6 };
      if (placed.some((other) => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top)) continue;
      if (planets.some((planet) => rect.left < planet.x + planet.radius && rect.right > planet.x - planet.radius
        && rect.top < planet.y + planet.radius && rect.bottom > planet.y - planet.radius)) continue;
      placed.push(rect); result.set(anchor.id, { x, y, visible: true }); found = true; break;
    }
    if (!found) result.set(anchor.id, { x: anchor.x, y: anchor.y, visible: false });
  }
  return result;
}

/** Circumference = device count × fixed neighbouring arc length. */
export function universeRingRadius(deviceCount: number): number {
  return Number.isSafeInteger(deviceCount) && deviceCount > 0 ? deviceCount * (UNIVERSE_NEIGHBOR_ARC_LENGTH / (2 * Math.PI)) : 0;
}

/**
 * Persist circular order, then evenly distribute the current identities. Offline
 * nodes remain in the ring; search/state filters are applied only when rendering.
 * Membership changes re-space the circle, without leaving empty orbit slots.
 */
export function createUniverseLayout(nodeIds: readonly string[], saved: readonly LayoutAssignment[] = []): UniverseLayout {
  const identities = [...new Set(nodeIds)];
  const slots = new Map<string, number>();
  const occupied = new Set<number>();
  for (const assignment of saved) {
    if (!assignment || typeof assignment.id !== 'string' || slots.has(assignment.id)
      || !Number.isSafeInteger(assignment.slot) || assignment.slot < 0 || assignment.slot > 100_000 || occupied.has(assignment.slot)) continue;
    slots.set(assignment.id, assignment.slot);
    occupied.add(assignment.slot);
  }
  const additions = identities.filter((id) => !slots.has(id))
    .sort((a, b) => stableNodeHash(a) - stableNodeHash(b) || a.localeCompare(b));
  let nextSlot = 0;
  for (const slot of slots.values()) nextSlot = Math.max(nextSlot, slot + 1);
  for (const id of additions) {
    if (nextSlot > 100_000) nextSlot = 0;
    while (occupied.has(nextSlot)) nextSlot += 1;
    slots.set(id, nextSlot); occupied.add(nextSlot); nextSlot += 1;
  }
  const plots = new Map<string, UniversePlot>();
  const radius = universeRingRadius(identities.length);
  identities.sort((a, b) => slots.get(a)! - slots.get(b)!);
  identities.forEach((id, index) => {
    const angle = index / identities.length * Math.PI * 2 + Math.PI / 12;
    plots.set(id, { id, slot: slots.get(id)!, orbitRadius: radius,
      x: Math.cos(angle) * radius, y: 0.3, z: Math.sin(angle) * radius });
  });
  return { assignments: [...slots].map(([id, slot]) => ({ id, slot })), plots,
    rings: identities.length ? [radius] : [], radius };
}

/** An undirected complete graph models peer relationships, not measured reachability or traffic. */
export function universePeerConnections(nodeIds: readonly string[]): UniversePeerConnection[] {
  const ids = [...new Set(nodeIds)].sort();
  return ids.flatMap((from, index) => ids.slice(index + 1).map(to => ({ from, to })));
}

/** Centre identity and catalogue size never change the total storage scale. */
export function universeNodeSize(snapshot: ObserverSnapshot, nodeId: string): number {
  return nodeStorageRadius(snapshot.nodes.find(node => node.id === nodeId));
}

/** Ships are bounded catalogue samples, never a count of currently executing agents or jobs. */
export function universeFleetSample(snapshot: ObserverSnapshot, nodeId: string): number {
  const count = snapshot.services.filter((service) => service.nodeId === nodeId).length;
  return count === 0 ? 0 : Math.min(7, 1 + Math.floor(Math.log2(count)));
}
