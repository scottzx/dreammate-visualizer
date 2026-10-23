import type { ObserverSnapshot } from '../read-model/types';
import type { ServiceSystemView } from '../read-model/service-systems';
import { stableNodeHash, type LayoutAssignment } from './layout';
import { createUniverseLayout, universeNodeSize, universeRingRadius, type UniverseLayout, type UniversePlot } from './universe-layout';
import { motionSeed, orbitPlane, spatialOrbitExtent, type OrbitPlane } from './spatial-motion';

export interface HierarchicalOrbit {
  systemId: string; majorRadius: number; majorPhase: number;
  minorRadius: number; minorPhase: number; minorInclination: number;
  majorPlane?: OrbitPlane; minorPlane?: OrbitPlane; minorSpeed?: number;
}
export interface GalaxySystemLayout extends ServiceSystemView {
  majorRadius: number; majorPhase: number; minorRadius: number; minorInclination: number;
  envelope: number; maxPlanetRadius: number;
  majorPlane: OrbitPlane; minorPlane: OrbitPlane; minorSpeed: number;
}
export interface GalaxyLayout extends UniverseLayout {
  systems: GalaxySystemLayout[]; majorRadius: number; localSystemId?: string;
}

/** Full device identity is retained. System centres and planets have separate orbit radii. */
export function createGalaxyLayout(snapshot: Pick<ObserverSnapshot, 'nodes'>, systems: readonly ServiceSystemView[],
  relayNodeId?: string, saved: readonly LayoutAssignment[] = []): GalaxyLayout {
  const nodeIds = new Set(snapshot.nodes.map(node => node.id));
  const accepted = new Set<string>();
  const sizes = new Map(snapshot.nodes.map(node => [node.id, universeNodeSize(snapshot, node.id)]));
  const groups: GalaxySystemLayout[] = systems.flatMap(system => {
    if (!nodeIds.has(system.centerNodeId) || accepted.has(system.centerNodeId)) return [];
    const ids = [...new Set(system.nodeIds)].filter(id => nodeIds.has(id) && !accepted.has(id) && (id !== relayNodeId || id === system.centerNodeId));
    if (!ids.includes(system.centerNodeId)) ids.unshift(system.centerNodeId);
    ids.forEach(id => accepted.add(id));
    const orbiting = ids.filter(id => id !== system.centerNodeId);
    const centerSize = sizes.get(system.centerNodeId)!;
    const maxOrbiter = Math.max(0, ...orbiting.map(id => sizes.get(id)!));
    const minorPlane = orbitPlane(`local:${system.id}`, 0.9 + motionSeed(system.id, 'local-aspect') * 0.08);
    let minorRadius = orbiting.length ? Math.max(universeRingRadius(orbiting.length), 12, (centerSize + maxOrbiter) * 1.9 + 4) / minorPlane.aspect : 0;
    const sorted = [...orbiting].sort((a, b) => stableNodeHash(a) - stableNodeHash(b) || a.localeCompare(b));
    for (let a = 0; a < sorted.length; a++) for (let b = a + 1; b < sorted.length; b++) {
      const angle = Math.min(b - a, sorted.length - (b - a)) * Math.PI * 2 / sorted.length;
      minorRadius = Math.max(minorRadius, ((sizes.get(sorted[a])! + sizes.get(sorted[b])!) * 1.9 + 2) / (2 * minorPlane.aspect * Math.sin(angle / 2)));
    }
    const orbitExtent = Math.max(0, ...orbiting.map(id => spatialOrbitExtent(minorRadius, orbitPlane(`planet:${id}`, minorPlane.aspect))));
    const envelope = Math.max(centerSize * 1.9 + 2, orbitExtent + maxOrbiter * 1.9 + 2);
    return [{ ...system, nodeIds: ids, majorRadius: 0, majorPhase: 0, minorRadius,
      minorInclination: minorPlane.inclination,
      majorPlane: orbitPlane(`galactic:${system.id}`), minorPlane, minorSpeed: 0.035 * (0.85 + motionSeed(system.id, 'local-speed') * 0.3),
      envelope, maxPlanetRadius: Math.max(centerSize, maxOrbiter) }];
  });
  // A partial/stale catalogue must not silently erase an unclassified device.
  for (const id of nodeIds) if (!accepted.has(id) && id !== relayNodeId) {
    const size = sizes.get(id)!;
    groups.push({ id: `system:remote:${id}`, kind: 'remote', centerNodeId: id, authority: '', nodeIds: [id], status: 'unknown',
      majorRadius: 0, majorPhase: 0, minorRadius: 0, minorInclination: 0, envelope: size * 1.9 + 2, maxPlanetRadius: size,
      majorPlane: orbitPlane(`galactic:system:remote:${id}`), minorPlane: orbitPlane(`local:${id}`), minorSpeed: 0.035 });
  }
  const revolving = groups.filter(system => system.centerNodeId !== relayNodeId);
  const order = createUniverseLayout(revolving.map(system => system.id), saved);
  revolving.sort((a, b) => order.plots.get(a.id)!.slot - order.plots.get(b.id)!.slot);
  const centerEnvelope = groups.find(system => system.centerNodeId === relayNodeId)?.envelope
    ?? (relayNodeId && sizes.has(relayNodeId) ? sizes.get(relayNodeId)! * 1.9 + 2 : 0);
  const largest = Math.max(0, ...revolving.map(system => system.envelope));
  const majorAspect = 0.94;
  let majorRadius = revolving.length ? (centerEnvelope + largest + 10) / majorAspect : 0;
  if (revolving.length > 1) {
    // The shortest projected ellipse separation still clears both full 3D envelopes.
    for (let a = 0; a < revolving.length; a++) for (let b = a + 1; b < revolving.length; b++) {
      const angle = Math.min(b - a, revolving.length - (b - a)) * Math.PI * 2 / revolving.length;
      majorRadius = Math.max(majorRadius, (revolving[a].envelope + revolving[b].envelope + 8) / (2 * majorAspect * Math.sin(angle / 2)));
    }
  }
  revolving.forEach((system, index) => { system.majorRadius = majorRadius; system.majorPhase = index / revolving.length * Math.PI * 2 + Math.PI / 12; });
  const plots = new Map<string, UniversePlot>();
  for (const system of groups) {
    const orbiting = system.nodeIds.filter(id => id !== system.centerNodeId).sort((a, b) => stableNodeHash(a) - stableNodeHash(b) || a.localeCompare(b));
    for (const id of system.nodeIds) {
      const index = orbiting.indexOf(id), minorPhase = index < 0 ? 0 : index / orbiting.length * Math.PI * 2 + motionSeed(system.id, 'local-phase') * Math.PI * 2;
      const galaxy: HierarchicalOrbit = { systemId: system.id, majorRadius: system.majorRadius, majorPhase: system.majorPhase,
        minorRadius: index < 0 ? 0 : system.minorRadius, minorPhase, minorInclination: system.minorInclination,
        majorPlane: system.majorPlane, minorPlane: orbitPlane(`planet:${id}`, system.minorPlane.aspect), minorSpeed: system.minorSpeed };
      plots.set(id, { id, slot: Math.max(0, index), x: 0, y: 0.3, z: 0, orbitRadius: galaxy.minorRadius,
        role: id === relayNodeId ? 'relay-center' : id === system.centerNodeId ? system.kind === 'entry' ? 'service-center' : 'system-center' : undefined, galaxy });
    }
  }
  if (relayNodeId && nodeIds.has(relayNodeId) && !plots.has(relayNodeId)) plots.set(relayNodeId,
    { id: relayNodeId, slot: 0, x: 0, y: 0.3, z: 0, orbitRadius: 0, role: 'relay-center' });
  return { assignments: order.assignments, plots, rings: majorRadius ? [majorRadius] : [],
    radius: Math.max(centerEnvelope, ...groups.map(system => spatialOrbitExtent(system.majorRadius, system.majorPlane) + system.envelope)), systems: groups, majorRadius,
    localSystemId: groups.find(system => system.kind === 'entry')?.id };
}
