import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Group, LineSegments, PerspectiveCamera, Points, PointsMaterial, Vector3 } from 'three';
import type { Line2 } from 'three-stdlib';
import type { EventView, FactorySceneProps, NodeView, ObserverSnapshot } from '../read-model/types';
import AssetModel from '../visual-assets/AssetModel';
import { formatNodeStorage, nodeStorageBytes } from '../read-model/storage';
import { centralNetworkRelay, networkPathForNode, networkSegments, type NetworkPathKind, type NetworkRelayView } from '../read-model/network';
import { serviceEntry as resolveServiceEntry, serviceSystems, type ServiceEntry, type ServiceSystemView } from '../read-model/service-systems';
import { displayNetworkEndpoint } from '../read-model/ip-privacy';
import { createGalaxyLayout, type GalaxySystemLayout } from './galaxy-layout';
import GalaxyOrbits from './GalaxyOrbits';
import RelayBeacon from './RelayBeacon';
import { nodeIsNetworkOnline } from '../read-model/presentation';
import { planetContents, planetStorageComposition, type PlanetContents, type PlanetStorageComposition } from '../read-model/planet-contents';
import { CapabilityOrbit, ProjectStorageSurface, type SatelliteHover } from './PlanetContents';
import { PlanetHologram, UniverseBackdrop, UniverseStars, UNIVERSE_VISUALS } from './UniverseEffects';
import { factoryConnections, selectionNodeIds, stableNodeHash, type LayoutAssignment } from './layout';
import { placeUniverseLabels, universeNodeSize, universePeerConnections, UNIVERSE_LAYOUT_STORAGE_KEY,
  type UniverseLayout, type UniversePlot, type UniversePeerConnection } from './universe-layout';
import { advanceOrbitTime, orbitPosition } from './universe-motion';
import { planetSpin, spinQuaternion } from './spatial-motion';
import UniverseNavigation, { projectedRadiusPx, UNIVERSE_CAMERA, type UniverseNavigationAction } from './UniverseNavigation';
import './universe-space.css';
import './relay-topology.css';
import './service-galaxies.css';

export type { UniverseNavigationAction } from './UniverseNavigation';

export interface UniverseSceneProps extends FactorySceneProps {
  onEnterNode?: (id: string) => void;
  paused?: boolean;
  navAction?: UniverseNavigationAction;
}

const cyan = '#81e7ed';
const font = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif';
const mono = '"SFMono-Regular", Consolas, monospace';

function deviceState(node: NodeView) {
  if (node.networkOnline === false) return { label: '网络离线', color: '#8b98ac' };
  if (nodeIsNetworkOnline(node)) return { label: node.online === true ? '网关在线' : '网络在线', color: '#8ee0bb' };
  if (node.status === 'stale') return { label: '资料过期', color: '#8b98ac' };
  if (node.online === false) return { label: '网关离线', color: '#8b98ac' };
  if (node.status === 'offline') return { label: '离线待核验', color: '#8b98ac' };
  if (node.online === null || node.status === 'unknown' || node.status === 'unavailable') return { label: '待观测', color: '#e4b87b' };
  return { label: '网关在线', color: '#8ee0bb' };
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function useUniverseLayout(snapshot: ObserverSnapshot, entry: ServiceEntry, centerNodeId?: string) {
  const scope = stableNodeHash(snapshot.layoutScope ?? 'default');
  const storageKey = `${UNIVERSE_LAYOUT_STORAGE_KEY}.service-systems.${snapshot.mode}.${scope}`;
  const registry = useRef<{ key: string; saved: LayoutAssignment[]; systems: ServiceSystemView[] } | null>(null);
  if (registry.current?.key !== storageKey) {
    let saved: LayoutAssignment[] = [];
    try { const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); if (Array.isArray(stored)) saved = stored; } catch { /* Stable in-memory placement remains available. */ }
    registry.current = { key: storageKey, saved, systems: [] };
  }
  const layout = useMemo(() => createGalaxyLayout(snapshot, serviceSystems(snapshot, entry, registry.current?.systems), centerNodeId, registry.current?.saved),
    [snapshot, entry.nodeId, entry.authority, storageKey, centerNodeId]);
  useEffect(() => {
    registry.current = { key: storageKey, saved: layout.assignments, systems: layout.systems };
    try { localStorage.setItem(storageKey, JSON.stringify(layout.assignments)); } catch { /* Storage can be unavailable in private browsers. */ }
  }, [layout, storageKey]);
  return layout;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function OrbitClock({ layout, animate, time, positions }: {
  layout: UniverseLayout; animate: boolean; time: RefObject<number>; positions: RefObject<Map<string, Vector3>>;
}) {
  useFrame((_, delta) => {
    time.current = advanceOrbitTime(time.current, delta, animate);
    for (const [id, plot] of layout.plots) {
      let position = positions.current.get(id);
      if (!position) { position = new Vector3(); positions.current.set(id, position); }
      position.set(...orbitPosition(plot, time.current));
    }
  }, -100);
  return null;
}

function CanvasHealth({ onFailure }: { onFailure: () => void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    const failed = (event: Event) => { event.preventDefault(); onFailure(); };
    canvas.addEventListener('webglcontextlost', failed);
    return () => canvas.removeEventListener('webglcontextlost', failed);
  }, [canvas, onFailure]);
  return null;
}

function PlanetLoading({ illuminated }: { illuminated: boolean }) {
  return <mesh><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color={illuminated ? '#465b70' : '#1b2634'} metalness={0.5} roughness={0.72} /></mesh>;
}

function Planet({ node, plot, radius, selected, contents, composition, selectedServiceId, animate, time, positions, gestureMoved, onSelect, onEnter, onHover }: {
  node: NodeView; plot: UniversePlot; radius: number; selected: boolean; contents: PlanetContents; composition: PlanetStorageComposition; selectedServiceId?: string; animate: boolean;
  time: RefObject<number>; positions: RefObject<Map<string, Vector3>>; gestureMoved: RefObject<boolean>;
  onSelect: FactorySceneProps['onSelect']; onEnter?: (id: string) => void; onHover: (hover: SatelliteHover) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const planet = useRef<Group>(null);
  const model = useRef<Group>(null);
  const effects = useRef<Group>(null);
  const distantPoint = useRef<Points>(null);
  const pointMaterial = useRef<PointsMaterial>(null);
  const body = useRef<Group>(null);
  const { camera, size } = useThree();
  const spin = useMemo(() => planetSpin(node.id), [node.id]);
  const illuminated = nodeIsNetworkOnline(node);
  const pointPositions = useMemo(() => new Float32Array([0, 0, 0]), []);
  useFrame(() => {
    const position = positions.current.get(node.id);
    if (planet.current && position) planet.current.position.copy(position);
    if (body.current) body.current.quaternion.set(...spinQuaternion(spin, time.current));
    if (!(camera instanceof PerspectiveCamera) || !position) return;
    const pixels = projectedRadiusPx(camera, position, radius, size.height);
    if (model.current) model.current.visible = pixels >= 2.2;
    if (effects.current) effects.current.visible = pixels >= 7;
    if (distantPoint.current) distantPoint.current.visible = pixels > 0 && pixels < 2.2;
    if (pointMaterial.current) pointMaterial.current.size = Math.max(1, Math.min(3, pixels * 2));
  });
  const relayCenter = plot.role === 'relay-center';
  const serviceCenter = plot.role === 'service-center';
  const accent = relayCenter ? '#efbd70' : serviceCenter ? '#75e5f1' : selected || hovered ? UNIVERSE_VISUALS.ice : '#8995a4';
  const choose = (event: ThreeEvent<MouseEvent>, enter = false) => {
    event.stopPropagation();
    if (event.delta > 6 || gestureMoved.current) return;
    if (enter) onEnter?.(node.id); else onSelect({ type: 'node', id: node.id });
  };
  return <group ref={planet} position={orbitPosition(plot, time.current)}>
    <group ref={model} onClick={(event) => choose(event)}
      onDoubleClick={(event) => choose(event, true)}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>
      <group ref={body} scale={radius} quaternion={spinQuaternion(spin, time.current)}>
        <Suspense fallback={<PlanetLoading illuminated={illuminated} />}>
          <AssetModel id="planet-peripheral" monochrome hideOrbitalRelays illuminated={illuminated} />
        </Suspense>
        <ProjectStorageSurface composition={composition} illuminated={illuminated} />
      </group>
      {/* A transparent hit target preserves easy selection between the fine GLB details. */}
      <mesh><sphereGeometry args={[radius * 1.1, 20, 14]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    </group>
    <points ref={distantPoint} visible={false} onClick={(event) => choose(event)} onDoubleClick={(event) => choose(event, true)}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pointPositions, 3]} /></bufferGeometry>
      <pointsMaterial ref={pointMaterial} color={illuminated ? '#a1aab5' : '#34414f'} size={1.5} sizeAttenuation={false} toneMapped={false} />
    </points>
    <group ref={effects}>
      {illuminated && <PlanetHologram radius={radius} core={relayCenter} color={accent} selected={selected || hovered} animate={animate} />}
      {relayCenter && <RelayBeacon radius={radius} time={time} />}
      {serviceCenter && <RelayBeacon radius={radius} time={time} color="#75e5f1" />}
      <CapabilityOrbit contents={contents} radius={radius} seed={node.id} time={time} selectedServiceId={selectedServiceId}
        gestureMoved={gestureMoved} onSelect={onSelect} onHover={onHover} illuminated={illuminated} />
    </group>
  </group>;
}

type LabelPointer = { x: number; y: number; dragging: boolean } | null;

function LabelsProjection({ nodes, layout, sizes, elements, selected, positions, sceneElement, pointer }: {
  nodes: NodeView[]; layout: UniverseLayout; sizes: Map<string, number>; elements: RefObject<Map<string, HTMLDivElement>>; selected: Set<string>;
  positions: RefObject<Map<string, Vector3>>;
  sceneElement: RefObject<HTMLDivElement | null>;
  pointer: RefObject<LabelPointer>;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);
  const hover = useRef<{ id: string | null; lastNear: number }>({ id: null, lastNear: 0 });
  useFrame(({ clock }) => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const planets = nodes.flatMap((node) => {
      const position = positions.current.get(node.id);
      if (!position) return [];
      point.copy(position).project(camera);
      if (point.z < -1 || point.z > 1) return [];
      return [{ id: node.id, x: (point.x + 1) * size.width / 2, y: (1 - point.y) * size.height / 2,
        radius: projectedRadiusPx(camera, position, sizes.get(node.id) ?? 1, size.height) * 1.95 + 4 }];
    });
    const cursor = pointer.current;
    if (!cursor || cursor.dragging) hover.current.id = null;
    else {
      const previous = hover.current.id ? elements.current.get(hover.current.id) : undefined;
      const card = previous?.style.visibility === 'visible' ? previous.querySelector('[data-label-body]')?.getBoundingClientRect() : undefined;
      const bounds = sceneElement.current?.getBoundingClientRect();
      const overCard = card && bounds && cursor.x + bounds.left >= card.left && cursor.x + bounds.left <= card.right
        && cursor.y + bounds.top >= card.top && cursor.y + bounds.top <= card.bottom;
      const nearest = overCard ? undefined : planets.map(planet => ({ ...planet, distance: Math.hypot(planet.x - cursor.x, planet.y - cursor.y) }))
        .filter(planet => planet.distance <= Math.max(26, planet.radius + 12)).sort((a, b) => a.distance - b.distance)[0];
      if (nearest) { hover.current.id = nearest.id; hover.current.lastNear = clock.elapsedTime; }
      else if (overCard) hover.current.lastNear = clock.elapsedTime;
      // Allow the pointer to cross the short gap from a planet to its clickable card.
      else if (clock.elapsedTime - hover.current.lastNear > 0.2) hover.current.id = null;
    }
    if (sceneElement.current) sceneElement.current.dataset.hoveredNodeId = hover.current.id ?? '';
    const labels = nodes.flatMap((node) => {
      const element = elements.current.get(node.id);
      const plot = layout.plots.get(node.id);
      const position = positions.current.get(node.id);
      if (!element || !plot || !position) return [];
      const pixels = projectedRadiusPx(camera, position, sizes.get(node.id) ?? 1, size.height);
      const lod = hover.current.id === node.id ? pixels >= 3 ? 'full' : 'compact' : 'hidden';
      element.dataset.labelLod = lod;
      element.dataset.labelRevealed = 'false';
      element.dataset.radiusPx = pixels.toFixed(2);
      element.dataset.worldRadius = String(sizes.get(node.id));
      element.dataset.worldPosition = position.toArray().map((value) => value.toFixed(3)).join(',');
      point.copy(position).project(camera);
      const x = (point.x + 1) * size.width / 2;
      const y = (1 - point.y) * size.height / 2 - pixels * 1.95 - 7;
      const centerY = (1 - point.y) * size.height / 2;
      element.dataset.screenPosition = `${x.toFixed(2)},${centerY.toFixed(2)}`;
      if (lod === 'hidden' || point.z < -1 || point.z > 1 || x < 0 || x > size.width || centerY < 0 || centerY > size.height) {
        element.style.visibility = 'hidden'; return [];
      }
      return [{ element, id: node.id, x, y, width: element.offsetWidth || 150, height: element.offsetHeight || 58,
        priority: selected.has(node.id) ? 0 : plot.role === 'relay-center' || plot.role === 'service-center' ? 1 : 2 }];
    }).sort((a, b) => a.priority - b.priority || a.y - b.y || a.id.localeCompare(b.id));
    const bounds = sceneElement.current?.getBoundingClientRect();
    const reserved = bounds ? [...(sceneElement.current?.querySelectorAll('[data-label-obstacle]') ?? [])].map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left - bounds.left - 10, right: rect.right - bounds.left + 10, top: rect.top - bounds.top - 10, bottom: rect.bottom - bounds.top + 10 };
    }) : [];
    const placements = placeUniverseLabels(labels, planets, size.width, size.height, reserved);
    for (const label of labels) {
      const placement = placements.get(label.id)!;
      label.element.style.transform = `translate3d(${placement.x.toFixed(1)}px,${placement.y.toFixed(1)}px,0)`;
      label.element.style.visibility = placement.visible ? 'visible' : 'hidden';
      label.element.dataset.labelRevealed = String(placement.visible);
      label.element.style.zIndex = String(10 - label.priority);
    }
  });
  return null;
}

function PlanetLabel({ node, plot, services, contents, composition, selected, relay, entry, system, networkPath, onSelect, onEnter, elementRef }: {
  node: NodeView; services: number | null; selected: boolean; onSelect: FactorySceneProps['onSelect'];
  contents: PlanetContents; composition: PlanetStorageComposition;
  relay?: NetworkRelayView; networkPath?: NetworkPathKind | 'self';
  plot: UniversePlot; entry?: ServiceEntry; system?: GalaxySystemLayout;
  onEnter?: (id: string) => void; elementRef: (element: HTMLDivElement | null) => void;
}) {
  const state = deviceState(node);
  return <div ref={elementRef} data-node-id={node.id} data-illuminated={nodeIsNetworkOnline(node)} data-storage-bytes={nodeStorageBytes(node) ?? "unknown"} data-satellite-count={contents.services.length}
    data-skill-star-count={contents.skills.length} data-skills-status={contents.skillsStatus} data-project-storage-status={composition.status}
    data-project-storage-bytes={composition.measuredBytes} data-project-share={composition.totalBytes !== null && composition.remainderBytes !== null ? composition.measuredBytes / composition.totalBytes : 'unknown'}
    data-relay-center={Boolean(relay)} data-service-center={Boolean(entry)} data-service-authority={entry?.authority}
    data-system-id={plot.galaxy?.systemId} data-system-center-id={system?.centerNodeId}
    data-major-orbit-radius={plot.galaxy?.majorRadius ?? 0} data-minor-orbit-radius={plot.galaxy?.minorRadius ?? 0}
    data-major-orbit-inclination={plot.galaxy?.majorPlane?.inclination} data-major-orbit-longitude={plot.galaxy?.majorPlane?.longitude}
    data-minor-orbit-inclination={plot.galaxy?.minorPlane?.inclination} data-minor-orbit-longitude={plot.galaxy?.minorPlane?.longitude}
    data-spin-axis={planetSpin(node.id).axis.map(value => value.toFixed(5)).join(',')}
    data-network-path={networkPath} className="universe-planet-label">
    <div data-label-body>
      <button type="button" data-label-button aria-label={`查看星球 ${node.name}，${state.label}，${formatNodeStorage(node)}`} aria-pressed={selected}
        onClick={(event) => { event.stopPropagation(); onSelect({ type: 'node', id: node.id }); }}
        onDoubleClick={(event) => { event.stopPropagation(); onEnter?.(node.id); }}
        style={{ width: '100%', border: `1px solid ${selected ? '#8ceeffb0' : '#608ba255'}`,
          borderLeft: `2px solid ${selected ? '#a5f4ff' : '#4692b7'}`,
          color: '#e2f4ff', background: selected ? 'linear-gradient(105deg,#12394bed,#07172aef)' : 'linear-gradient(105deg,#0c2031ee,#06101cd9)',
          borderRadius: 0, clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
          padding: '8px 10px', textAlign: 'left', cursor: 'pointer', pointerEvents: 'auto', fontFamily: font,
          boxShadow: selected ? 'inset 0 0 22px #55c9ed1f' : 'inset 0 1px 0 #76d8ef0e' }}>
        <span data-label-title>
          <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: state.color, flexShrink: 0 }} />
          <strong style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '.02em' }}>{relay ? 'DERP 总中心' : entry ? entry.authority || node.name : node.name}</strong>
        </span>
        {relay && <span data-label-relay>{displayNetworkEndpoint(`${relay.host}:${relay.port}`, node.name)}</span>}
        {entry && <span data-label-service>{node.name} · 服务中心<br />{Math.max(0, (system?.nodeIds.length ?? 1) - 1)} 台设备围绕入口公转</span>}
        {!relay && selected && networkPath && <span data-label-path>{({ self: '服务观察点', direct: '与观察点直连', derp: '与观察点经 DERP 中继', 'peer-relay': '与观察点经设备中继', offline: '设备网络离线', unknown: '观察点路径待观测' })[networkPath]}</span>}
        <span data-label-storage data-storage-known={nodeStorageBytes(node) !== null}>{formatNodeStorage(node)}{nodeStorageBytes(node) === null ? "" : " 存储"}</span>
        <span data-label-detail>{state.label} · {services === null ? '能力待核验' : `${services} 颗能力卫星`}</span>
        {selected && <span data-label-contents>{contents.skillsStatus === 'unknown' ? 'Skill 星点待探查' : `${contents.skills.length} 个 Skill 星点${contents.skillsStatus === 'ok' ? '' : ' · 部分'}`}</span>}
      </button>
      {selected && onEnter && <button type="button" data-label-entry onClick={() => onEnter(node.id)} style={{ pointerEvents: 'auto', width: '100%', color: cyan, cursor: 'pointer',
        border: '1px solid #76dce745', background: '#102a39ee', padding: '7px', fontSize: 10, borderRadius: '0 0 4px 4px', fontFamily: font }}>进入星球基地 →</button>}
      <div data-label-leader aria-hidden="true" style={{ background: `linear-gradient(${selected ? cyan : '#557284'}, transparent)` }} />
    </div>
  </div>;
}

/** Batch the complete peer graph; topology lines never intercept planet selection. */
function PeerConnectionLayer({ connections, positions, opacity, highlighted = false, color }: {
  connections: UniversePeerConnection[]; positions: RefObject<Map<string, Vector3>>; opacity: number; highlighted?: boolean; color?: string;
}) {
  const lines = useRef<LineSegments>(null);
  const coordinates = useMemo(() => new Float32Array(connections.length * 6), [connections]);
  useFrame(({ camera }) => {
    const geometry = lines.current?.geometry;
    if (!geometry || !lines.current) return;
    const attribute = geometry.getAttribute('position');
    let maxRadius = 0;
    connections.forEach(({ from, to }, index) => {
      const a = positions.current.get(from);
      const b = positions.current.get(to);
      attribute.setXYZ(index * 2, a?.x ?? 0, a?.y ?? 0, a?.z ?? 0);
      attribute.setXYZ(index * 2 + 1, b?.x ?? 0, b?.y ?? 0, b?.z ?? 0);
      if (a) maxRadius = Math.max(maxRadius, a.length());
    });
    attribute.needsUpdate = true;
    lines.current.visible = camera.position.length() < Math.max(800, maxRadius * 35);
  });
  if (!connections.length) return null;
  return <lineSegments ref={lines} frustumCulled={false} raycast={() => {}} renderOrder={-1}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[coordinates, 3]} /></bufferGeometry>
    <lineBasicMaterial color={color ?? (highlighted ? '#8fe9f1' : '#518ca4')} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
  </lineSegments>;
}

function PeerConnections({ connections, selected, positions, subdued = false }: {
  connections: UniversePeerConnection[]; selected: Set<string>; positions: RefObject<Map<string, Vector3>>; subdued?: boolean;
}) {
  const selectedKey = JSON.stringify([...selected].sort());
  const highlighted = useMemo(() => connections.filter(({ from, to }) => selected.has(from) || selected.has(to)), [connections, selectedKey]);
  const density = Math.min(1, Math.sqrt(78 / Math.max(1, connections.length)));
  return <group>
    <PeerConnectionLayer connections={connections} positions={positions} opacity={(highlighted.length ? 0.045 : subdued ? 0.065 : 0.2) * density} />
    <PeerConnectionLayer connections={highlighted} positions={positions} opacity={subdued ? 0.18 : 0.58} highlighted />
  </group>;
}

function EvidenceConnection({ event, positions, onSelect, gestureMoved }: {
  event: EventView; positions: RefObject<Map<string, Vector3>>; onSelect: FactorySceneProps['onSelect']; gestureMoved: RefObject<boolean>;
}) {
  const line = useRef<Line2>(null);
  const origin = new Vector3();
  const first = positions.current.get(event.nodeId!) ?? origin;
  const last = positions.current.get(event.targetNodeId!) ?? origin;
  const points = useMemo(() => Array.from({ length: 17 }, (_, index) => {
    const t = index / 16;
    return [first.x * (1 - t) + last.x * t, first.y * (1 - t) + last.y * t + Math.sin(t * Math.PI) * 3,
      first.z * (1 - t) + last.z * t] as [number, number, number];
  }), [event.id]);
  const { camera } = useThree();
  useLayoutEffect(() => {
    const object = line.current;
    if (!object) return;
    const originalRaycast = object.raycast;
    // Three's raycaster visits invisible objects too. A distant decorative connection
    // must not consume a background click after its visible geometry is suppressed.
    object.raycast = (raycaster, intersections) => {
      if (object.visible) originalRaycast.call(object, raycaster, intersections);
    };
    return () => { object.raycast = originalRaycast; };
  }, []);
  useFrame(() => {
    const a = positions.current.get(event.nodeId!);
    const b = positions.current.get(event.targetNodeId!);
    if (!line.current || !a || !b) return;
    line.current.visible = camera.position.distanceTo(a) < 800 && camera.position.distanceTo(b) < 800;
    const coordinates: number[] = [];
    for (let index = 0; index <= 16; index++) {
      const t = index / 16;
      coordinates.push(a.x * (1 - t) + b.x * t, a.y * (1 - t) + b.y * t + Math.sin(t * Math.PI) * 3, a.z * (1 - t) + b.z * t);
    }
    line.current.geometry.setPositions(coordinates);
    line.current.computeLineDistances();
  });
  return <Line ref={line} points={points} color="#81d6e6" transparent opacity={0.6} dashed dashSize={0.3} gapSize={0.22} lineWidth={1.2}
    onClick={(pointer) => { pointer.stopPropagation(); if (pointer.delta <= 6 && !gestureMoved.current) onSelect({ type: 'event', id: event.id }); }} />;
}

function UniverseFallback({ props, reason }: { props: UniverseSceneProps; reason: string }) {
  const selected = selectionNodeIds(props.snapshot, props.selection);
  return <div data-testid="universe-fallback" style={{ height: '100%', boxSizing: 'border-box', padding: '100px 11% 80px', overflow: 'auto', color: '#d1e1ec', background: 'radial-gradient(ellipse at 45% 45%, #143049, #050b16 70%)', fontFamily: font }}>
    <div style={{ font: `11px ${mono}`, letterSpacing: '.2em', color: cyan }}>CAPABILITY UNIVERSE</div>
    <p style={{ color: '#93aab9', fontSize: 13 }}>{reason} 仍可选择设备查看能力与来源。</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 20 }}>
      {props.snapshot.nodes.filter((node) => !props.visibleNodeIds || props.visibleNodeIds.includes(node.id)).map((node) => <div key={node.id} style={{ border: `1px solid ${selected.has(node.id) ? cyan : '#2d4b63'}`, padding: 17, borderRadius: 8, background: '#112337' }}>
        <button type="button" onClick={() => props.onSelect({ type: 'node', id: node.id })} aria-pressed={selected.has(node.id)}
          style={{ cursor: 'pointer', textAlign: 'left', padding: 0, border: 0, color: '#dcebf1', background: 'transparent', width: '100%', fontFamily: font }}>
          <span style={{ display: 'block', width: 42, height: 42, borderRadius: '50%', background: nodeIsNetworkOnline(node) ? 'radial-gradient(circle at 30% 25%, #9abbcb, #354e70 60%, #14213a)' : 'radial-gradient(circle at 30% 25%, #253442, #121c28 60%, #0b1320)', boxShadow: nodeIsNetworkOnline(node) ? '0 0 20px #9cbbd722' : 'none', marginBottom: 15 }} />
          <strong style={{ fontSize: 13 }}>{node.name}</strong><span style={{ display: 'block', marginTop: 8, fontSize: 11 }}>{formatNodeStorage(node)}</span>
          <span style={{ display: 'block', marginTop: 9, fontSize: 10, color: deviceState(node).color }}>{deviceState(node).label}</span>
        </button>
        {props.onEnterNode && <button type="button" onClick={() => props.onEnterNode?.(node.id)} style={{ border: 0, background: 'transparent', padding: '14px 0 0', color: cyan, cursor: 'pointer', fontSize: 11 }}>进入基地 →</button>}
      </div>)}
    </div>
  </div>;
}

export default function UniverseScene(props: UniverseSceneProps) {
  const { snapshot, selection, onSelect, showConnections = true, resetKey = 0, paused = false } = props;
  const [webGL, setWebGL] = useState<boolean | null>(null);
  const [lostContext, setLostContext] = useState(false);
  const [satelliteHover, setSatelliteHover] = useState<SatelliteHover>(null);
  const sceneElement = useRef<HTMLDivElement>(null);
  const orbitTime = useRef(0);
  const positions = useRef(new Map<string, Vector3>());
  const gestureMoved = useRef(false);
  const pointerOrigin = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const labelPointer = useRef<LabelPointer>(null);
  const labels = useRef(new Map<string, HTMLDivElement>());
  const relay = centralNetworkRelay(snapshot);
  const entry = resolveServiceEntry(snapshot, typeof window === 'undefined' ? '' : window.location.href);
  const layout = useUniverseLayout(snapshot, entry, relay?.nodeId);
  const localSystem = layout.systems.find(system => system.id === layout.localSystemId);
  useLayoutEffect(() => {
    for (const [id, plot] of layout.plots) positions.current.set(id, new Vector3(...orbitPosition(plot, orbitTime.current)));
    for (const id of positions.current.keys()) if (!layout.plots.has(id)) positions.current.delete(id);
  }, [layout]);
  const reduced = useReducedMotion();
  const animate = !paused && !reduced;
  const selected = selectionNodeIds(snapshot, selection);
  const visible = snapshot.nodes.filter((node) => !props.visibleNodeIds || props.visibleNodeIds.includes(node.id));
  const contentsByNode = useMemo(() => new Map(snapshot.nodes.map(node => [node.id, planetContents(snapshot, node.id)])), [snapshot]);
  const compositionByNode = useMemo(() => new Map(snapshot.nodes.map(node => [node.id, planetStorageComposition(snapshot, node.id)])), [snapshot]);
  const sizes = new Map(snapshot.nodes.map((node) => [node.id, universeNodeSize(snapshot, node.id)]));
  const visibleIds = new Set(visible.map((node) => node.id));
  const visibleKey = JSON.stringify([...visibleIds].sort());
  const peers = useMemo(() => universePeerConnections([...visibleIds]), [visibleKey]);
  const networkPaths = useMemo(() => networkSegments(snapshot.network, visibleIds), [snapshot.network, visibleKey]);
  const networkCounts = { direct: 0, derp: 0, 'peer-relay': 0, offline: 0, unknown: 0 };
  for (const connection of snapshot.network?.connections ?? []) networkCounts[connection.kind] += 1;
  const referenceTime = snapshot.mode === 'demo' ? Date.parse(snapshot.generatedAt) : Date.now();
  const connections = showConnections ? factoryConnections(snapshot, selection, visibleIds, referenceTime) : [];
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setWebGL(Boolean(context)); context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { setWebGL(false); }
  }, []);
  const fallback = <UniverseFallback props={props} reason={webGL === null ? '正在准备三维显示。' : lostContext ? '三维显示已中断，已切换到设备星图。' : '当前环境无法启用三维显示，已切换到设备星图。'} />;
  return <div ref={sceneElement} data-testid="universe-scene" role="region" aria-label={`能力宇宙三维空间；拖动旋转视角，滚轮缩放，触屏单指旋转、双指缩放或平移；单击星球查看指标，双击进入基地。当前服务入口 ${entry.authority} 对应的设备为小太阳系中心；能与它直连的设备做小公转，整个星系绕 DERP 总中心做较慢的大公转。金色为观测的 DERP 中继路径，蓝色为直连，淡线为对等关系示意。细星环上每颗卫星代表一个服务能力，每个星点代表一个可见 Skill 包，球面颜色显示项目存储占比，灰色为未探查或未归属。公转为示意。`}
    data-projection="perspective" data-sizing="storage-volume"
    data-layout="service-centered-galaxies" data-motion-profile="independent-spatial-orbits-v10" data-label-mode="proximity" data-device-count={snapshot.nodes.length} data-ring-radius={layout.majorRadius.toFixed(4)}
    data-service-domain={entry.authority} data-service-center-node-id={entry.nodeId} data-system-count={layout.systems.length}
    data-local-orbit-radius={localSystem?.minorRadius.toFixed(4) ?? '0'} data-local-device-count={localSystem?.nodeIds.length ?? 0}
    data-major-orbit-radius={layout.majorRadius.toFixed(4)} data-layout-envelope={layout.radius.toFixed(4)}
    data-central-relay-node-id={relay?.nodeId} data-orbiting-device-count={snapshot.nodes.length - (relay ? 1 : 0)} data-network-status={snapshot.network?.status ?? 'unavailable'}
    data-observed-direct-connections={networkCounts.direct} data-observed-relay-connections={networkCounts.derp}
    data-content-model="capability-satellites-skill-stars" data-capability-satellites={visible.reduce((count, node) => count + contentsByNode.get(node.id)!.services.length, 0)}
    data-skill-stars={visible.reduce((count, node) => count + contentsByNode.get(node.id)!.skills.length, 0)}
    data-peer-connections={showConnections ? peers.length : 0} data-highlighted-peer-connections={showConnections ? peers.filter(({ from, to }) => selected.has(from) || selected.has(to)).length : 0}
    data-effects-running={animate ? 'true' : 'false'}
    onPointerDownCapture={(event) => { gestureMoved.current = false; pointerOrigin.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }; }}
    onPointerMoveCapture={(event) => {
      const start = pointerOrigin.current;
      if (start && (event.pointerId !== start.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6)) gestureMoved.current = true;
      const bounds = event.currentTarget.getBoundingClientRect();
      labelPointer.current = event.pointerType === 'touch' ? null : { x: event.clientX - bounds.left, y: event.clientY - bounds.top,
        dragging: event.buttons !== 0 && gestureMoved.current };
    }}
    onPointerLeave={() => { labelPointer.current = null; }}
    onPointerCancelCapture={() => { gestureMoved.current = true; pointerOrigin.current = null; labelPointer.current = null; }}
    style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: UNIVERSE_VISUALS.background }}>
    {webGL && !lostContext ? <SceneBoundary fallback={<UniverseFallback props={props} reason="三维素材加载失败，已切换到设备星图。" />}>
      {/* Keep projection, GL viewport and DOM labels in sync across viewport restoration. Pausing only stops illustrative movement. */}
      <Canvas dpr={[1, 1.5]} frameloop="always" camera={{ position: [...UNIVERSE_CAMERA.overviewOffset], fov: UNIVERSE_CAMERA.fov, near: 0.03, far: 30000 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
        onPointerMissed={() => { if (!gestureMoved.current) onSelect(null); }} style={{ touchAction: 'none' }}>
        <color attach="background" args={[UNIVERSE_VISUALS.background]} />
        <ambientLight intensity={0.46} color="#9fc5ea" />
        <hemisphereLight args={['#8ac5ec', '#030b1b', 1.3]} />
        <directionalLight position={[-15, 22, 20]} color="#c9edff" intensity={2.8} />
        <directionalLight position={[20, -4, -8]} color="#4784ff" intensity={2.2} />
        <pointLight position={[-4, 6, 4]} color="#ffcf99" intensity={75} distance={40} decay={2} />
        <CanvasHealth onFailure={() => setLostContext(true)} />
        <OrbitClock layout={layout} animate={animate} time={orbitTime} positions={positions} />
        <UniverseNavigation resetKey={resetKey} action={props.navAction} positions={positions} sizes={sizes} ringRadius={layout.radius}
          localSystem={localSystem}
          selectedIds={selected} orbitTime={orbitTime} sceneElement={sceneElement} />
        <UniverseBackdrop animate={animate} />
        <UniverseStars animate={animate} />
        <GalaxyOrbits layout={layout} positions={positions} />
        {showConnections && <><PeerConnections connections={peers} selected={selected} positions={positions} subdued={Boolean(snapshot.network)} />
          <PeerConnectionLayer connections={networkPaths.direct} positions={positions} opacity={0.7} color="#77dce9" />
          <PeerConnectionLayer connections={networkPaths.derp} positions={positions} opacity={0.85} color="#efbd70" />
        </>}
        {connections.map((event) => <EvidenceConnection key={event.id} event={event} positions={positions} gestureMoved={gestureMoved} onSelect={onSelect} />)}
        {visible.map((node) => <Planet key={node.id} node={node} plot={layout.plots.get(node.id)!} radius={sizes.get(node.id)!}
          selected={selected.has(node.id)} contents={contentsByNode.get(node.id)!} composition={compositionByNode.get(node.id)!}
          selectedServiceId={selection?.type === 'service' ? selection.id : undefined} animate={animate} time={orbitTime} positions={positions}
          gestureMoved={gestureMoved} onSelect={onSelect} onEnter={props.onEnterNode} onHover={setSatelliteHover} />)}
        <LabelsProjection nodes={visible} layout={layout} sizes={sizes} elements={labels} selected={selected} positions={positions} sceneElement={sceneElement} pointer={labelPointer} />
      </Canvas>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
        {visible.map((node) => <PlanetLabel key={node.id} node={node} plot={layout.plots.get(node.id)!} selected={selected.has(node.id)}
          entry={entry.nodeId === node.id ? entry : undefined} system={layout.systems.find(system => system.nodeIds.includes(node.id))}
          relay={relay?.nodeId === node.id ? relay : undefined} networkPath={snapshot.network ? networkPathForNode(snapshot.network, node.id) : undefined}
          contents={contentsByNode.get(node.id)!} composition={compositionByNode.get(node.id)!}
          services={node.catalogAvailable || snapshot.services.some((service) => service.nodeId === node.id) ? snapshot.services.filter((service) => service.nodeId === node.id).length : null} onSelect={onSelect} onEnter={props.onEnterNode}
          elementRef={(element) => { if (element) labels.current.set(node.id, element); else labels.current.delete(node.id); }} />)}
      </div>
      {satelliteHover && visibleIds.has(satelliteHover.service.nodeId) && <div role="tooltip" className="universe-satellite-tooltip"
        style={{ left: Math.max(8, Math.min((sceneElement.current?.clientWidth ?? 1280) - 220, satelliteHover.clientX - (sceneElement.current?.getBoundingClientRect().left ?? 0) + 14)), top: Math.max(8, satelliteHover.clientY - (sceneElement.current?.getBoundingClientRect().top ?? 0) - 54) }}>
        <strong>{satelliteHover.service.name}</strong><span>{satelliteHover.service.methods.length} 个方法 · 点击查看能力</span>
      </div>}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 130px #01040a88',
        background: 'radial-gradient(ellipse at 48% 48%, transparent 20%, #01061033 75%)', zIndex: 1 }} />
    </SceneBoundary> : fallback}

  </div>;
}
