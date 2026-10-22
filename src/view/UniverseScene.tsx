import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Group, LineSegments, PerspectiveCamera, Points, PointsMaterial, Vector3 } from 'three';
import type { Line2 } from 'three-stdlib';
import type { EventView, FactorySceneProps, NodeView, ObserverSnapshot } from '../read-model/types';
import AssetModel from '../visual-assets/AssetModel';
import { formatNodeStorage, nodeStorageBytes } from '../read-model/storage';
import { FleetExhaust, PlanetHologram, UniverseBackdrop, UniverseOrbitalGrid, UniverseStars, UNIVERSE_VISUALS } from './UniverseEffects';
import { factoryConnections, selectionNodeIds, stableNodeHash, type LayoutAssignment } from './layout';
import { createUniverseLayout, placeUniverseLabels, universeFleetSample, universeNodeSize, universePeerConnections, UNIVERSE_LAYOUT_STORAGE_KEY,
  type UniverseLayout, type UniversePlot, type UniversePeerConnection } from './universe-layout';
import { advanceOrbitTime, orbitPosition } from './universe-motion';
import UniverseNavigation, { projectedRadiusPx, UNIVERSE_CAMERA, type UniverseNavigationAction } from './UniverseNavigation';
import './universe-space.css';

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
  if (node.status === 'stale') return { label: '资料过期', color: '#8b98ac' };
  if (node.online === false) return { label: '网关离线', color: '#8b98ac' };
  if (node.online === null && node.networkOnline === false) return { label: '网络离线', color: '#8b98ac' };
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

function useUniverseLayout(snapshot: ObserverSnapshot) {
  const scope = stableNodeHash(snapshot.layoutScope ?? 'default');
  const storageKey = `${UNIVERSE_LAYOUT_STORAGE_KEY}.${snapshot.mode}.${scope}`;
  const registry = useRef<{ key: string; saved: LayoutAssignment[] } | null>(null);
  if (registry.current?.key !== storageKey) {
    let saved: LayoutAssignment[] = [];
    try { const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); if (Array.isArray(stored)) saved = stored; } catch { /* Stable in-memory placement remains available. */ }
    registry.current = { key: storageKey, saved };
  }
  const identityKey = JSON.stringify(snapshot.nodes.map((node) => node.id).sort());
  const layout = useMemo(() => createUniverseLayout(snapshot.nodes.map((node) => node.id), registry.current?.saved), [identityKey, storageKey]);
  useEffect(() => {
    registry.current = { key: storageKey, saved: layout.assignments };
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

function PlanetLoading() {
  return <mesh><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color="#465b70" metalness={0.5} roughness={0.72} /></mesh>;
}

function FleetShip({ index, radius, seed, time }: { index: number; radius: number; seed: number; time: RefObject<number> }) {
  const ship = useRef<Group>(null);
  const initialPhase = ((seed % 97) / 97 + index / 7) * Math.PI * 2;
  const orbitRadius = radius * (1.65 + (index % 3) * 0.23);
  useFrame(() => {
    if (!ship.current) return;
    const phase = initialPhase + time.current * (0.08 + (index % 3) * 0.018);
    ship.current.position.set(Math.cos(phase) * orbitRadius, radius * (0.35 + Math.sin(phase * 2 + index) * 0.1), Math.sin(phase) * orbitRadius);
    ship.current.rotation.y = Math.PI - phase;
  });
  const angle = initialPhase;
  return <group ref={ship} position={[Math.cos(angle) * orbitRadius, radius * 0.35, Math.sin(angle) * orbitRadius]} rotation={[0, Math.PI - angle, 0]} raycast={() => {}}>
    <Suspense fallback={<mesh><sphereGeometry args={[0.06, 8, 8]} /><meshBasicMaterial color={cyan} /></mesh>}>
      <AssetModel id="ship-base" scale={radius * .055} />
    </Suspense>
    <group scale={radius * .25}><FleetExhaust core={false} /></group>
  </group>;
}

function Planet({ node, plot, radius, selected, fleets, animate, time, positions, gestureMoved, onSelect, onEnter }: {
  node: NodeView; plot: UniversePlot; radius: number; selected: boolean; fleets: number; animate: boolean;
  time: RefObject<number>; positions: RefObject<Map<string, Vector3>>; gestureMoved: RefObject<boolean>;
  onSelect: FactorySceneProps['onSelect']; onEnter?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const planet = useRef<Group>(null);
  const model = useRef<Group>(null);
  const effects = useRef<Group>(null);
  const fleet = useRef<Group>(null);
  const distantPoint = useRef<Points>(null);
  const pointMaterial = useRef<PointsMaterial>(null);
  const body = useRef<Group>(null);
  const { camera, size } = useThree();
  const phase = stableNodeHash(node.id) % 10;
  const pointPositions = useMemo(() => new Float32Array([0, 0, 0]), []);
  useFrame(() => {
    const position = positions.current.get(node.id);
    if (planet.current && position) planet.current.position.copy(position);
    if (body.current) body.current.rotation.y = phase + time.current * 0.08;
    if (!(camera instanceof PerspectiveCamera) || !position) return;
    const pixels = projectedRadiusPx(camera, position, radius, size.height);
    if (model.current) model.current.visible = pixels >= 2.2;
    if (effects.current) effects.current.visible = pixels >= 7;
    if (fleet.current) fleet.current.visible = pixels >= 8;
    if (distantPoint.current) distantPoint.current.visible = pixels > 0 && pixels < 2.2;
    if (pointMaterial.current) pointMaterial.current.size = Math.max(1, Math.min(3, pixels * 2));
  });
  const accent = selected || hovered ? UNIVERSE_VISUALS.ice : '#62cee9';
  const choose = (event: ThreeEvent<MouseEvent>, enter = false) => {
    event.stopPropagation();
    if (event.delta > 6 || gestureMoved.current) return;
    if (enter) onEnter?.(node.id); else onSelect({ type: 'node', id: node.id });
  };
  return <group ref={planet} position={orbitPosition(plot, time.current)}>
    <group ref={model} onClick={(event) => choose(event)}
      onDoubleClick={(event) => choose(event, true)}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>
      <group ref={body} scale={radius} rotation={[0.24, phase, -0.28]}>
        <Suspense fallback={<PlanetLoading />}>
          <AssetModel id="planet-peripheral" />
        </Suspense>
      </group>
      {/* A transparent hit target preserves easy selection between the fine GLB details. */}
      <mesh><sphereGeometry args={[radius * 1.1, 20, 14]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    </group>
    <points ref={distantPoint} visible={false} onClick={(event) => choose(event)} onDoubleClick={(event) => choose(event, true)}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pointPositions, 3]} /></bufferGeometry>
      <pointsMaterial ref={pointMaterial} color="#98cee9" size={1.5} sizeAttenuation={false} toneMapped={false} />
    </points>
    <group ref={effects}><PlanetHologram radius={radius} core={false} color={accent} selected={selected || hovered} animate={animate} /></group>
    <group ref={fleet}>{Array.from({ length: fleets }, (_, index) => <FleetShip key={index} index={index} radius={radius} seed={stableNodeHash(node.id)} time={time} />)}</group>
  </group>;
}

function LabelsProjection({ nodes, layout, sizes, elements, selected, positions }: {
  nodes: NodeView[]; layout: UniverseLayout; sizes: Map<string, number>; elements: RefObject<Map<string, HTMLDivElement>>; selected: Set<string>;
  positions: RefObject<Map<string, Vector3>>;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new Vector3(), []);
  useFrame(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    const planets = nodes.flatMap((node) => {
      const position = positions.current.get(node.id);
      if (!position) return [];
      point.copy(position).project(camera);
      if (point.z < -1 || point.z > 1) return [];
      return [{ x: (point.x + 1) * size.width / 2, y: (1 - point.y) * size.height / 2,
        radius: projectedRadiusPx(camera, position, sizes.get(node.id) ?? 1, size.height) * 1.25 + 4 }];
    });
    const labels = nodes.flatMap((node) => {
      const element = elements.current.get(node.id);
      const plot = layout.plots.get(node.id);
      const position = positions.current.get(node.id);
      if (!element || !plot || !position) return [];
      const pixels = projectedRadiusPx(camera, position, sizes.get(node.id) ?? 1, size.height);
      const lod = pixels >= 9 || (selected.has(node.id) && pixels >= 6) ? 'full' : pixels >= 3 ? 'compact' : 'hidden';
      element.dataset.labelLod = lod;
      element.dataset.radiusPx = pixels.toFixed(2);
      element.dataset.worldRadius = String(sizes.get(node.id));
      element.dataset.worldPosition = position.toArray().map((value) => value.toFixed(3)).join(',');
      point.copy(position).project(camera);
      const x = (point.x + 1) * size.width / 2;
      const y = (1 - point.y) * size.height / 2 - pixels - 7;
      if (lod === 'hidden' || point.z < -1 || point.z > 1 || x < 0 || x > size.width || y < 25 || y > size.height - 30) {
        element.style.visibility = 'hidden'; return [];
      }
      return [{ element, id: node.id, x, y, width: element.offsetWidth || 150, height: element.offsetHeight || 58,
        priority: selected.has(node.id) ? 0 : 2 }];
    }).sort((a, b) => a.priority - b.priority || a.y - b.y || a.id.localeCompare(b.id));
    const placements = placeUniverseLabels(labels, planets, size.width, size.height);
    for (const label of labels) {
      const placement = placements.get(label.id)!;
      label.element.style.transform = `translate3d(${placement.x.toFixed(1)}px,${placement.y.toFixed(1)}px,0)`;
      label.element.style.visibility = placement.visible ? 'visible' : 'hidden';
      label.element.style.zIndex = String(10 - label.priority);
    }
  });
  return null;
}

function PlanetLabel({ node, services, selected, onSelect, onEnter, elementRef }: {
  node: NodeView; services: number | null; selected: boolean; onSelect: FactorySceneProps['onSelect'];
  onEnter?: (id: string) => void; elementRef: (element: HTMLDivElement | null) => void;
}) {
  const state = deviceState(node);
  return <div ref={elementRef} data-node-id={node.id} data-storage-bytes={nodeStorageBytes(node) ?? "unknown"} className="universe-planet-label">
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
          <strong style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, letterSpacing: '.02em' }}>{node.name}</strong>
        </span>
        <span data-label-storage data-storage-known={nodeStorageBytes(node) !== null}>{formatNodeStorage(node)}{nodeStorageBytes(node) === null ? "" : " 存储"}</span>
        <span data-label-detail>{state.label} · {services === null ? '目录待核验' : `${services} 项可见服务`}</span>
      </button>
      {selected && onEnter && <button type="button" data-label-entry onClick={() => onEnter(node.id)} style={{ pointerEvents: 'auto', width: '100%', color: cyan, cursor: 'pointer',
        border: '1px solid #76dce745', background: '#102a39ee', padding: '7px', fontSize: 10, borderRadius: '0 0 4px 4px', fontFamily: font }}>进入星球基地 →</button>}
      <div data-label-leader aria-hidden="true" style={{ background: `linear-gradient(${selected ? cyan : '#557284'}, transparent)` }} />
    </div>
  </div>;
}

/** Batch the complete peer graph; topology lines never intercept planet selection. */
function PeerConnectionLayer({ connections, positions, opacity, highlighted = false }: {
  connections: UniversePeerConnection[]; positions: RefObject<Map<string, Vector3>>; opacity: number; highlighted?: boolean;
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
    <lineBasicMaterial color={highlighted ? '#8fe9f1' : '#518ca4'} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
  </lineSegments>;
}

function PeerConnections({ connections, selected, positions }: {
  connections: UniversePeerConnection[]; selected: Set<string>; positions: RefObject<Map<string, Vector3>>;
}) {
  const selectedKey = JSON.stringify([...selected].sort());
  const highlighted = useMemo(() => connections.filter(({ from, to }) => selected.has(from) || selected.has(to)), [connections, selectedKey]);
  const density = Math.min(1, Math.sqrt(78 / Math.max(1, connections.length)));
  return <group>
    <PeerConnectionLayer connections={connections} positions={positions} opacity={(highlighted.length ? 0.045 : 0.2) * density} />
    <PeerConnectionLayer connections={highlighted} positions={positions} opacity={0.58} highlighted />
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
          <span style={{ display: 'block', width: 42, height: 42, borderRadius: '50%', background: 'radial-gradient(circle at 30% 25%, #9abbcb, #354e70 60%, #14213a)', boxShadow: '0 0 20px #9cbbd722', marginBottom: 15 }} />
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
  const sceneElement = useRef<HTMLDivElement>(null);
  const orbitTime = useRef(0);
  const positions = useRef(new Map<string, Vector3>());
  const gestureMoved = useRef(false);
  const pointerOrigin = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const labels = useRef(new Map<string, HTMLDivElement>());
  const layout = useUniverseLayout(snapshot);
  useLayoutEffect(() => {
    for (const [id, plot] of layout.plots) positions.current.set(id, new Vector3(...orbitPosition(plot, orbitTime.current)));
    for (const id of positions.current.keys()) if (!layout.plots.has(id)) positions.current.delete(id);
  }, [layout]);
  const reduced = useReducedMotion();
  const animate = !paused && !reduced;
  const selected = selectionNodeIds(snapshot, selection);
  const visible = snapshot.nodes.filter((node) => !props.visibleNodeIds || props.visibleNodeIds.includes(node.id));
  const sizes = new Map(snapshot.nodes.map((node) => [node.id, universeNodeSize(snapshot, node.id)]));
  const visibleIds = new Set(visible.map((node) => node.id));
  const visibleKey = JSON.stringify([...visibleIds].sort());
  const peers = useMemo(() => universePeerConnections([...visibleIds]), [visibleKey]);
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
  return <div ref={sceneElement} data-testid="universe-scene" role="region" aria-label="能力宇宙三维空间；拖动旋转视角，滚轮缩放，触屏单指旋转、双指缩放或平移；单击星球查看指标，双击进入基地。自转、公转与舰群为示意，不表示实时任务。"
    data-projection="perspective" data-sizing="storage-volume"
    data-layout="distributed-ring" data-device-count={snapshot.nodes.length} data-ring-radius={layout.radius.toFixed(4)}
    data-peer-connections={showConnections ? peers.length : 0} data-highlighted-peer-connections={showConnections ? peers.filter(({ from, to }) => selected.has(from) || selected.has(to)).length : 0}
    data-effects-running={animate ? 'true' : 'false'}
    onPointerDownCapture={(event) => { gestureMoved.current = false; pointerOrigin.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }; }}
    onPointerMoveCapture={(event) => {
      const start = pointerOrigin.current;
      if (start && (event.pointerId !== start.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6)) gestureMoved.current = true;
    }}
    onPointerCancelCapture={() => { gestureMoved.current = true; pointerOrigin.current = null; }}
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
          selectedIds={selected} orbitTime={orbitTime} sceneElement={sceneElement} />
        <UniverseBackdrop animate={animate} />
        <UniverseStars animate={animate} />
        <UniverseOrbitalGrid layout={layout} animate={animate} />
        {showConnections && <PeerConnections connections={peers} selected={selected} positions={positions} />}
        {connections.map((event) => <EvidenceConnection key={event.id} event={event} positions={positions} gestureMoved={gestureMoved} onSelect={onSelect} />)}
        {visible.map((node) => <Planet key={node.id} node={node} plot={layout.plots.get(node.id)!} radius={sizes.get(node.id)!}
          selected={selected.has(node.id)} fleets={universeFleetSample(snapshot, node.id)} animate={animate} time={orbitTime} positions={positions}
          gestureMoved={gestureMoved} onSelect={onSelect} onEnter={props.onEnterNode} />)}
        <LabelsProjection nodes={visible} layout={layout} sizes={sizes} elements={labels} selected={selected} positions={positions} />
      </Canvas>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
        {visible.map((node) => <PlanetLabel key={node.id} node={node} selected={selected.has(node.id)}
          services={node.catalogAvailable || snapshot.services.some((service) => service.nodeId === node.id) ? snapshot.services.filter((service) => service.nodeId === node.id).length : null} onSelect={onSelect} onEnter={props.onEnterNode}
          elementRef={(element) => { if (element) labels.current.set(node.id, element); else labels.current.delete(node.id); }} />)}
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 130px #01040a88',
        background: 'radial-gradient(ellipse at 48% 48%, transparent 20%, #01061033 75%)', zIndex: 1 }} />
      <div className="universe-storage-key" aria-label="球体体积与存储成正比，64G、128G、256G、512G 体积依次翻倍；未采集到存储的设备统一使用128G默认值">
        <span>体积 ∝ 存储 · 未采集按 128G</span><div>{[64, 128, 256, 512].map(gib => <span key={gib}><i style={{ width: 13 * Math.cbrt(gib / 64), height: 13 * Math.cbrt(gib / 64) }} /><small>{gib}G</small></span>)}</div>
      </div>
      <div className="universe-navigation-hint" aria-hidden="true">360° 拖动旋转 · 滚轮缩放 · 触屏双指缩放 / 平移</div>
    </SceneBoundary> : fallback}
    <div className="universe-caption" style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 3,
      font: `9px ${mono}`, color: '#8aa3b4', padding: '7px 13px', border: '1px solid #5b7a8e24', borderRadius: 4, background: '#081221ba', whiteSpace: 'nowrap' }}>
      等距设备环 · {paused || reduced ? '运动已暂停' : '顺时针公转'} · {showConnections ? '对等互联示意 · ' : ''}双击进入基地
    </div>
  </div>;
}
