import { Component, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Line, OrbitControls, RoundedBox } from '@react-three/drei';
import { CatmullRomCurve3, Group, Mesh, OrthographicCamera, PCFShadowMap, Vector3 } from 'three';
import type { FactorySceneProps, NodeView, ObserverSnapshot, ServiceView, WorkStatus } from '../read-model/types';
import {
  createFactoryLayout, factoryConnections, FACTORY_LAYOUT_STORAGE_KEY, isRecentFactoryEvent,
  selectionNodeIds, stableNodeHash, type FactoryLayout, type FactoryPlot, type LayoutAssignment,
} from './layout';

const palette = { cyan: '#76dfeb', green: '#75e7b4', amber: '#dcb76f', muted: '#748394', purple: '#b4a0ef' };
const uiFont = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif';
const monoFont = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
const activityColors: Record<WorkStatus, string> = { running: palette.cyan, queued: palette.amber, input_required: palette.purple,
  succeeded: palette.green, failed: '#e58786', canceled: palette.muted, rejected: '#e58786', unknown: palette.muted };
const activityLabels: Record<WorkStatus, string> = { running: '执行', queued: '排队', input_required: '等待', succeeded: '完成事件',
  failed: '失败事件', canceled: '取消事件', rejected: '拒绝事件', unknown: '近期事件' };

function nodeState(node: NodeView): { color: string; symbol: string; text: string } {
  if (node.status === 'stale') return { color: palette.muted, symbol: '?', text: '过期' };
  if (node.online === false || node.status === 'offline') return { color: palette.muted, symbol: '−', text: '离线' };
  if (node.online === null || node.status === 'unknown' || node.status === 'unavailable') return { color: palette.amber, symbol: '?', text: '未知' };
  return { color: palette.green, symbol: '●', text: '在线' };
}

function readAssignments(storageKey: string): LayoutAssignment[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch { return []; }
}

function useStableLayout(snapshot: ObserverSnapshot): FactoryLayout {
  const scope = String(stableNodeHash(snapshot.layoutScope ?? 'default'));
  const storageKey = `${FACTORY_LAYOUT_STORAGE_KEY}.${snapshot.mode}.${scope}`;
  const saved = useRef<{ storageKey: string; assignments: LayoutAssignment[] } | null>(null);
  if (saved.current?.storageKey !== storageKey) saved.current = { storageKey, assignments: readAssignments(storageKey) };
  const identityKey = JSON.stringify(snapshot.nodes.map((node) => node.id).sort());
  const layout = useMemo(() => createFactoryLayout(snapshot.nodes.map((node) => node.id), saved.current?.assignments ?? []), [identityKey, storageKey]);
  useEffect(() => {
    saved.current = { storageKey, assignments: layout.assignments };
    try { localStorage.setItem(storageKey, JSON.stringify(layout.assignments)); } catch { /* An in-memory layout also works in private mode. */ }
  }, [layout, storageKey]);
  return layout;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

function useReferenceTime(snapshot: ObserverSnapshot): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (snapshot.mode === 'demo') return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [snapshot.mode]);
  return snapshot.mode === 'demo' ? Date.parse(snapshot.generatedAt) : now;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function CanvasHealth({ onFailure }: { onFailure: () => void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    const handleLost = (event: Event) => { event.preventDefault(); onFailure(); };
    canvas.addEventListener('webglcontextlost', handleLost);
    return () => canvas.removeEventListener('webglcontextlost', handleLost);
  }, [canvas, onFailure]);
  return null;
}

function CameraController({ bounds, resetKey }: { bounds: FactoryLayout['bounds']; resetKey: number }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size, invalidate } = useThree();
  const { minX, maxX, minZ, maxZ } = bounds;
  useEffect(() => {
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    camera.position.set(centerX + 32, 31, centerZ + 38);
    camera.lookAt(centerX, 0, centerZ);
    if (camera instanceof OrthographicCamera) {
      const width = maxX - minX;
      const depth = maxZ - minZ;
      camera.zoom = Math.min(size.width / ((width + depth) * 0.72 + 6), size.height / ((width + depth) * 0.36 + 12)) * 1.09;
      camera.updateProjectionMatrix();
    }
    controls.current?.target.set(centerX, 0, centerZ);
    controls.current?.update();
    invalidate();
  }, [camera, size.width, size.height, minX, maxX, minZ, maxZ, resetKey, invalidate]);
  return <OrbitControls ref={controls} makeDefault enableDamping={false} minZoom={5} maxZoom={70}
    minPolarAngle={0.23} maxPolarAngle={Math.PI / 2.35} maxDistance={140}
    mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }} />;
}

function Solid({ position, size, color, emissive, glow = 0, edge, opacity = 1 }: {
  position: [number, number, number]; size: [number, number, number]; color: string;
  emissive?: string; glow?: number; edge?: string; opacity?: number;
}) {
  return <mesh position={position} castShadow={size[1] >= 0.4} receiveShadow={size[1] >= 0.2}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} metalness={0.4} roughness={0.55} emissive={emissive} emissiveIntensity={glow}
      transparent={opacity < 1} opacity={opacity} />
    {edge && <Edges color={edge} threshold={20} />}
  </mesh>;
}

function FactoryGround({ bounds }: { bounds: FactoryLayout['bounds'] }) {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const width = bounds.maxX - bounds.minX + 4;
  const depth = bounds.maxZ - bounds.minZ + 4;
  const grid = Math.ceil(Math.max(width, depth));
  const verticalRoads: number[] = [];
  const horizontalRoads: number[] = [];
  for (let x = -56.1; x <= bounds.maxX + 2; x += 10.2) if (x >= bounds.minX - 2) verticalRoads.push(x);
  for (let z = -62.4; z <= bounds.maxZ + 2; z += 10.4) if (z >= bounds.minZ - 2) horizontalRoads.push(z);
  return <group>
    <RoundedBox args={[width, 0.48, depth]} radius={0.5} smoothness={2} position={[centerX, -0.44, centerZ]} receiveShadow>
      <meshStandardMaterial color="#101d2a" metalness={0.5} roughness={0.65} />
    </RoundedBox>
    <gridHelper args={[grid, grid, '#263b4d', '#1a2e40']} position={[centerX, -0.18, centerZ]} />
    <Solid position={[centerX, -0.15, bounds.minZ - 1.4]} size={[width - 2, 0.035, 0.055]} color="#4d99ac" emissive="#4d99ac" glow={0.5} />
    <Solid position={[bounds.maxX + 1.4, -0.15, centerZ]} size={[0.055, 0.035, depth - 2]} color="#4d99ac" emissive="#4d99ac" glow={0.5} />
    {verticalRoads.map((x) => <group key={`v${x}`}>
      <Solid position={[x, -0.13, centerZ]} size={[1.7, 0.025, depth - 1.4]} color="#0b1621" />
      {Array.from({ length: Math.floor(depth / 3.6) }, (_, index) => <Solid key={index}
        position={[x, -0.106, bounds.minZ + index * 3.6]} size={[0.045, 0.012, 0.85]} color="#37516a" />)}
    </group>)}
    {horizontalRoads.map((z) => <group key={`h${z}`}>
      <Solid position={[centerX, -0.1, z]} size={[width - 1.4, 0.025, 1.65]} color="#0b1621" />
      {Array.from({ length: Math.floor(width / 3.6) }, (_, index) => <Solid key={index}
        position={[bounds.minX + index * 3.6, -0.078, z]} size={[0.85, 0.012, 0.045]} color="#37516a" />)}
    </group>)}
    {[-1, 1].flatMap((side) => Array.from({ length: Math.max(3, Math.floor(width / 5)) }, (_, index) =>
      <group key={`${side}-${index}`} position={[bounds.minX + index * 5 + 1, 0, centerZ + side * (depth / 2 - 0.6)]}>
        <Solid position={[0, 0.1, 0]} size={[0.12, 0.5, 0.12]} color="#486477" />
        <Solid position={[0, 0.36, 0]} size={[0.2, 0.09, 0.2]} color="#b6e8ed" emissive="#8fe8f0" glow={1.4} />
      </group>))}
  </group>;
}

function ServerBuilding({ variant, color, offline }: { variant: number; color: string; offline: boolean }) {
  const towerHeight = variant === 0 ? 3.3 : variant === 1 ? 2.65 : 2.9;
  return <group>
    <Solid position={[-0.85, 0.35 + towerHeight / 2, -0.75]} size={[3.15, towerHeight, 3.45]} color={offline ? '#293342' : '#263c50'} edge="#456177" />
    <Solid position={[-0.85, towerHeight + 0.45, -0.75]} size={[3.4, 0.22, 3.7]} color="#536878" edge="#7b94a1" />
    <Solid position={[-0.85, towerHeight + 0.58, -0.75]} size={[2.9, 0.06, 3.2]} color="#1b2d3b" />
    {[-1.85, -0.88, 0.09].map((x) => <group key={x}>
      <Solid position={[x, 0.65 + towerHeight / 2, 1]} size={[0.66, towerHeight - 0.45, 0.075]} color="#101f2e" edge="#38546c" />
      {[0, 1, 2, 3, 4].map((stripe) => <Solid key={stripe} position={[x, 0.85 + stripe * (towerHeight - 0.7) / 5, 1.05]}
        size={[0.45, 0.045, 0.018]} color={color} emissive={color} glow={offline ? 0 : 0.6} />)}
    </group>)}
    {[0, 1].map((row) => <group key={row} position={[-1.65 + row * 1.6, towerHeight + 0.67, -0.8]}>
      <mesh>
        <cylinderGeometry args={[0.48, 0.48, 0.13, 16]} />
        <meshStandardMaterial color="#546979" metalness={0.7} roughness={0.5} />
      </mesh>
      <Solid position={[0, 0.08, 0]} size={[0.65, 0.035, 0.1]} color="#1c2b39" />
      <Solid position={[0, 0.08, 0]} size={[0.1, 0.035, 0.65]} color="#1c2b39" />
    </group>)}
    <Solid position={[1.75, 1.14, -1]} size={[1.5, 1.6, 2.6]} color="#20384c" edge="#43657d" />
    <Solid position={[1.75, 2.03, -1]} size={[1.7, 0.18, 2.8]} color="#476172" />
    <Solid position={[2.53, 1.15, -1]} size={[0.035, 1.15, 2.1]} color={color} emissive={color} glow={offline ? 0 : 0.25} opacity={0.62} />
    <Solid position={[1.75, 0.8, 0.34]} size={[1.05, 0.7, 0.045]} color="#102433" edge="#43657d" />
    {[0, 1, 2].map((index) => <Solid key={index} position={[1.4 + index * 0.35, 1.2, 0.39]} size={[0.17, 0.055, 0.025]}
      color={offline ? '#5b6571' : color} emissive={color} glow={offline ? 0 : 0.5} />)}
    {variant === 2 && <group position={[-2.7, 1.65, -1.6]}>
      <Solid position={[0, 0, 0]} size={[0.12, 2.6, 0.12]} color="#78919f" />
      <Solid position={[0.4, 1.3, 0]} size={[0.9, 0.08, 0.08]} color="#78919f" />
      <mesh position={[0.8, 1.2, 0]}><sphereGeometry args={[0.09, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} /></mesh>
    </group>}
    <Solid position={[-2.2, 0.65, -2.85]} size={[0.55, 0.5, 0.65]} color="#2e4455" edge="#4c6676" />
    <Solid position={[-1.35, 0.65, -2.85]} size={[0.55, 0.5, 0.65]} color="#2e4455" edge="#4c6676" />
  </group>;
}

function ServiceStation({ service, x, onSelect }: { service?: ServiceView; x: number; onSelect: FactorySceneProps['onSelect'] }) {
  const color = service?.status === 'up' ? palette.cyan : service?.status === 'down' ? '#e58786' : '#73859b';
  return <group position={[x, 0.43, 2.05]} onClick={(event) => { if (service) { event.stopPropagation(); onSelect({ type: 'service', id: service.id }); } }}>
    <Solid position={[0, 0.16, 0]} size={[1.37, 0.3, 1.12]} color="#263a4d" edge="#4a6377" />
    <Solid position={[0, 0.55, -0.3]} size={[1.2, 0.53, 0.37]} color="#192b3c" edge="#4a6377" />
    <Solid position={[0, 0.56, -0.1]} size={[0.98, 0.31, 0.025]} color={color} emissive={color} glow={service?.status === 'up' ? 0.5 : 0.08} />
    <Solid position={[0, 0.35, 0.28]} size={[1.0, 0.035, 0.34]} color="#537081" />
    <Solid position={[0.45, 0.55, 0.33]} size={[0.11, 0.11, 0.11]} color={color} emissive={color} glow={0.45} />
  </group>;
}

function ActivityBeacon({ color, animate, offset }: { color: string; animate: boolean; offset: number }) {
  const ring = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ring.current || !animate) return;
    const phase = (clock.elapsedTime * 0.42 + offset) % 1;
    ring.current.scale.setScalar(1 + phase * 0.34);
  });
  return <mesh ref={ring} position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[3.9, 3.94, 64]} />
    <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
  </mesh>;
}

function NodeWorkshop({ node, services, plot, selected, activity, reducedMotion, onSelect }: {
  node: NodeView; services: ServiceView[]; plot: FactoryPlot; selected: boolean; activity?: WorkStatus;
  reducedMotion: boolean; onSelect: FactorySceneProps['onSelect'];
}) {
  const state = nodeState(node);
  const offline = node.online === false || node.status === 'offline';
  const accent = selected ? palette.cyan : state.color;
  const [hovered, setHovered] = useState(false);
  return <group position={[plot.x, 0, plot.z]} onClick={(event) => { event.stopPropagation(); onSelect({ type: 'node', id: node.id }); }}
    onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }} onPointerOut={() => setHovered(false)}>
    <RoundedBox args={[7.8, 0.43, 7.7]} radius={0.16} smoothness={2} position={[0, 0.1, 0]} receiveShadow castShadow>
      <meshStandardMaterial color={selected || hovered ? '#263d50' : '#1b2e3f'} metalness={0.55} roughness={0.55} />
    </RoundedBox>
    <Solid position={[0, 0.35, -3.48]} size={[6.9, 0.065, 0.07]} color={accent} emissive={accent} glow={selected ? 1.5 : 0.45} />
    <Solid position={[-3.48, 0.35, 0]} size={[0.07, 0.065, 6.9]} color={accent} emissive={accent} glow={selected ? 1.5 : 0.45} />
    {selected && <Line points={[[-3.95, 0.35, -3.9], [3.95, 0.35, -3.9], [3.95, 0.35, 3.9], [-3.95, 0.35, 3.9], [-3.95, 0.35, -3.9]]}
      color={palette.cyan} lineWidth={1.7} />}
    <ServerBuilding variant={plot.variant} color={offline ? '#758492' : accent} offline={offline} />
    {services.slice(0, 3).map((service, index) => <ServiceStation key={service.id} service={service} x={-2.05 + index * 2.05} onSelect={onSelect} />)}
    {services.length === 0 && <Solid position={[0, 0.4, 2.2]} size={[4.4, 0.08, 0.45]} color="#354556" />}
    <Solid position={[0, 0.39, 3.34]} size={[3.9, 0.025, 0.07]} color="#637786" />
    {[-2.9, 2.9].map((x) => <group key={x} position={[x, 0.5, 2.8]}>
      <Solid position={[0, 0.15, 0]} size={[0.11, 0.5, 0.11]} color="#536d7d" />
      <Solid position={[0, 0.42, 0]} size={[0.21, 0.09, 0.21]} color={accent} emissive={accent} glow={offline ? 0.1 : 0.9} />
    </group>)}
    {activity && <ActivityBeacon color={activityColors[activity]}
      animate={!reducedMotion} offset={stableNodeHash(node.id) % 13 / 13} />}

  </group>;
}

function NodeLabel({ node, services, selected, activity, compact, onSelect, elementRef }: {
  node: NodeView; services: ServiceView[]; selected: boolean; activity?: WorkStatus; compact: boolean;
  onSelect: FactorySceneProps['onSelect']; elementRef: (element: HTMLDivElement | null) => void;
}) {
  const state = nodeState(node);
  return (
    <div ref={elementRef} data-node-id={node.id} style={{ position: 'absolute', left: 0, top: 0, width: 'max-content', visibility: 'hidden', pointerEvents: 'none' }}>
      <div style={{ transform: 'translate(-50%, -100%)', pointerEvents: 'none' }}>
      <button type="button" className="factory-node-label" aria-label={`查看设备 ${node.name}，${state.text}`} aria-pressed={selected}
        onClick={(event) => { event.stopPropagation(); onSelect({ type: 'node', id: node.id }); }}
        style={{
          pointerEvents: 'auto', fontFamily: uiFont, color: selected ? '#e4fcff' : '#d5e3ed', cursor: 'pointer', textAlign: 'left',
          background: selected ? 'rgba(18, 45, 60, .96)' : 'rgba(12, 25, 38, .94)',
          border: `1px solid ${selected ? '#73d9e9' : '#3b5266'}`, borderRadius: 6, padding: compact ? '6px 9px' : '9px 12px',
          boxShadow: selected ? '0 0 24px #55cadd24, 0 6px 20px #02080d70' : '0 5px 16px #02080d70',
          minWidth: compact ? 104 : 140, maxWidth: compact ? 140 : 190, outlineOffset: 3,
        }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
          <span aria-hidden="true" style={{ color: state.color, fontFamily: monoFont, fontSize: 12 }}>{state.symbol}</span>
          <strong style={{ fontWeight: 550, fontSize: compact ? 11 : 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</strong>
          <span aria-hidden="true" style={{ color: '#8098aa', marginLeft: 'auto', fontSize: 12 }}>↗</span>
        </span>
        {!compact && <span style={{ display: 'block', color: '#829aac', fontFamily: monoFont, fontSize: 9, marginTop: 5, letterSpacing: '.03em' }}>
          {state.text} <span style={{ color: '#456174', padding: '0 3px' }}> / </span> {services.length} 个可见工位
          {activity && <span style={{ color: activityColors[activity], marginLeft: 7 }}>{activityLabels[activity]}</span>}
        </span>}
      </button>
      <div aria-hidden="true" style={{ width: 1, height: 18, background: `linear-gradient(${selected ? palette.cyan : '#4a6378'}, transparent)`, margin: '0 auto' }} />
      </div>
    </div>
  );
}

/** Labels belong to the primary React tree. This only projects DOM refs. */
function LabelProjection({ nodes, layout, elements }: {
  nodes: NodeView[]; layout: FactoryLayout; elements: RefObject<Map<string, HTMLDivElement>>;
}) {
  const { camera, size, invalidate } = useThree();
  const point = useMemo(() => new Vector3(), []);
  useEffect(() => { invalidate(); }, [nodes, layout, invalidate]);
  useFrame(() => {
    const labels = nodes.flatMap((node) => {
      const element = elements.current.get(node.id);
      const plot = layout.plots.get(node.id);
      if (!element || !plot) return [];
      point.set(plot.x, 4.9, plot.z).project(camera);
      if (point.z < -1 || point.z > 1) { element.style.visibility = 'hidden'; return []; }
      const width = element.offsetWidth || 148;
      const height = element.offsetHeight || 58;
      const x = Math.max(width / 2 + 8, Math.min(size.width - width / 2 - 8, (point.x + 1) * size.width / 2));
      const y = Math.max(height + 60, Math.min(size.height - 30, (1 - point.y) * size.height / 2));
      return [{ id: node.id, element, x, y, width, height }];
    }).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
    const placed: { x: number; y: number; width: number; height: number }[] = [];
    for (const label of labels) {
      let x = label.x;
      let y = label.y;
      const candidatesX = size.width < 520 ? [label.x, label.width / 2 + 8, size.width - label.width / 2 - 8] : [label.x];
      findSpace: for (const offset of [0, 58, -58, 116, -116, 174, -174]) {
        const candidate = label.y + offset;
        if (candidate - label.height < 54 || candidate > size.height - 28) continue;
        for (const candidateX of candidatesX) {
          if (!placed.some((other) => Math.abs(candidateX - other.x) < (label.width + other.width) / 2 + 5
            && candidate - label.height < other.y + 4 && candidate + 4 > other.y - other.height)) {
            x = candidateX;
            y = candidate;
            break findSpace;
          }
        }
      }
      label.element.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      label.element.style.visibility = 'visible';
      placed.push({ ...label, x, y });
    }
  });
  return null;
}

function EvidenceConnection({ start, end, animate, onClick }: {
  start: FactoryPlot; end: FactoryPlot; animate: boolean; onClick: () => void;
}) {
  const marker = useRef<Group>(null);
  const curve = useMemo(() => new CatmullRomCurve3([
    new Vector3(start.x + 2.8, 2.3, start.z - 1),
    new Vector3(start.x + (end.x - start.x) * 0.3, 5.0, start.z + (end.z - start.z) * 0.3),
    new Vector3(start.x + (end.x - start.x) * 0.7, 5.0, start.z + (end.z - start.z) * 0.7),
    new Vector3(end.x + 2.8, 2.3, end.z - 1),
  ]), [start.x, start.z, end.x, end.z]);
  const points = useMemo(() => curve.getPoints(42), [curve]);
  useFrame(({ clock }) => {
    if (marker.current && animate) marker.current.position.copy(curve.getPoint((clock.elapsedTime * 0.17) % 1));
  });
  return <group onClick={(event) => { event.stopPropagation(); onClick(); }}>
    <Line points={points} color="#81cddd" transparent opacity={0.85} lineWidth={1.8} dashed dashScale={1.5} dashSize={0.6} gapSize={0.3} />
    {animate && <group ref={marker} position={points[0]}>
      <mesh><sphereGeometry args={[0.13, 10, 10]} /><meshBasicMaterial color="#b6f6ff" /></mesh>
      <mesh><sphereGeometry args={[0.25, 10, 10]} /><meshBasicMaterial color="#72ddf1" transparent opacity={0.18} /></mesh>
    </group>}
  </group>;
}

function FactoryFallback({ props, reason }: { props: FactorySceneProps; reason: string }) {
  const selected = selectionNodeIds(props.snapshot, props.selection);
  const visible = props.snapshot.nodes.filter((node) => !props.visibleNodeIds || props.visibleNodeIds.includes(node.id));
  return <div data-testid="factory-fallback" style={{ height: '100%', padding: '70px 26px 45px', overflow: 'auto', boxSizing: 'border-box', color: '#c8dae8', background: 'radial-gradient(ellipse at 50% 10%, #1b3043, #0b1723 65%)', fontFamily: uiFont }}>
    <div style={{ font: `10px ${monoFont}`, color: palette.cyan, letterSpacing: '.15em' }}>DEVICE OVERVIEW / 设备总览</div>
    <p style={{ color: '#93a8ba', fontSize: 12, margin: '12px 0 24px', lineHeight: 1.7 }}>{reason} 你仍可选择设备查看来源、服务与工作详情。</p>
    {visible.length === 0 && <p style={{ color: '#93a8ba', fontSize: 13 }}>当前筛选范围内没有设备。</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
      {visible.map((node) => {
        const state = nodeState(node);
        return <button key={node.id} type="button" onClick={() => props.onSelect({ type: 'node', id: node.id })} aria-pressed={selected.has(node.id)}
          style={{ textAlign: 'left', padding: '20px 17px', cursor: 'pointer', background: '#162a3b', color: '#d9e9f3', border: `1px solid ${selected.has(node.id) ? palette.cyan : '#344d63'}`, borderRadius: 8, minHeight: 130, fontFamily: uiFont }}>
          <span style={{ color: state.color, fontSize: 11 }}>{state.symbol} {state.text}</span>
          <strong style={{ display: 'block', fontSize: 15, margin: '13px 0 9px' }}>{node.name}</strong>
          <span style={{ display: 'block', color: '#8ea9bb', fontSize: 11 }}>{node.platform} · {props.snapshot.services.filter((service) => service.nodeId === node.id).length} 个可见工位</span>
          <span style={{ display: 'block', color: '#71899d', fontSize: 10, marginTop: 8 }}>{node.agentStatus === 'running' ? '角色执行中' : node.agentStatus === 'waiting' ? '角色等待确认' : '角色忙闲未知'}</span>
        </button>;
      })}
    </div>
  </div>;
}

export default function FactoryScene(props: FactorySceneProps) {
  const { snapshot, selection, onSelect, showConnections = true, resetKey = 0 } = props;
  const [webGL, setWebGL] = useState<boolean | null>(null);
  const [lostContext, setLostContext] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const sceneElement = useRef<HTMLDivElement>(null);
  const labelElements = useRef(new Map<string, HTMLDivElement>());
  const layout = useStableLayout(snapshot);
  const reducedMotion = useReducedMotion();
  const referenceTime = useReferenceTime(snapshot);
  useEffect(() => {
    const element = sceneElement.current;
    if (!element) return;
    setNarrow(element.clientWidth < 520);
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 520));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setWebGL(Boolean(context));
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { setWebGL(false); }
  }, []);
  const visibleNodes = snapshot.nodes.filter((node) => !props.visibleNodeIds || props.visibleNodeIds.includes(node.id));
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const selected = selectionNodeIds(snapshot, selection);
  const activityByNode = new Map<string, WorkStatus>();
  for (const event of [...snapshot.events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))) {
    if (!isRecentFactoryEvent(event, referenceTime)) continue;
    for (const id of [event.nodeId, event.causalConfirmed ? event.targetNodeId : undefined]) {
      if (id && !activityByNode.has(id)) activityByNode.set(id, event.status);
    }
  }
  for (const node of snapshot.nodes) {
    if (node.status === 'stale') activityByNode.delete(node.id);
    else if (node.agentStatus === 'running') activityByNode.set(node.id, 'running');
  }
  const connections = showConnections ? factoryConnections(snapshot, selection, visibleIds, referenceTime) : [];
  const animating = !reducedMotion && visibleNodes.some((node) => activityByNode.has(node.id));
  const fallback = <FactoryFallback props={props} reason={webGL === null ? '正在检测三维显示能力。' : lostContext ? '三维显示已中断，已切换为二维设备视图。' : '当前环境无法启用三维显示，已切换为二维设备视图。'} />;
  return <div ref={sceneElement} data-testid="factory-scene" role="region" aria-label="设备协作工厂沙盘；拖动旋转，右键平移，滚轮缩放，点击设备查看。动态仅来自已观测事件与执行状态。" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#0c1824' }}>
    {webGL && !lostContext ? <SceneBoundary fallback={<FactoryFallback props={props} reason="三维场景加载失败，已切换为二维设备视图。" />}>
      <Canvas orthographic shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]} frameloop={animating ? 'always' : 'demand'}
        camera={{ position: [32, 31, 38], zoom: 17, near: 0.1, far: 220 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
        onPointerMissed={() => onSelect(null)} style={{ touchAction: 'none' }}>
        <color attach="background" args={['#0c1824']} />
        <fog attach="fog" args={['#0c1824', 65, 145]} />
        <ambientLight intensity={1.45} color="#bad9f0" />
        <hemisphereLight args={['#adcfe4', '#17212e', 1.9]} />
        <directionalLight position={[-12, 24, -9]} intensity={3.5} color="#c6e5f3" castShadow shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={90} shadow-bias={-0.001} />
        <directionalLight position={[18, 12, 15]} intensity={1.2} color="#6b89bf" />
        <CanvasHealth onFailure={() => setLostContext(true)} />
        <CameraController bounds={layout.bounds} resetKey={resetKey} />
        <LabelProjection nodes={visibleNodes} layout={layout} elements={labelElements} />
        <FactoryGround bounds={layout.bounds} />
        {connections.map((event) => <EvidenceConnection key={event.id} start={layout.plots.get(event.nodeId!)!} end={layout.plots.get(event.targetNodeId!)!}
          animate={!reducedMotion && isRecentFactoryEvent(event, referenceTime)} onClick={() => onSelect({ type: 'event', id: event.id })} />)}
        {visibleNodes.map((node) => <NodeWorkshop key={node.id} node={node} plot={layout.plots.get(node.id)!}
          services={snapshot.services.filter((service) => service.nodeId === node.id)} selected={selected.has(node.id)} activity={activityByNode.get(node.id)}
          reducedMotion={reducedMotion} onSelect={onSelect} />)}
      </Canvas>
      <div className="factory-label-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        {visibleNodes.map((node) => <NodeLabel key={node.id} node={node}
          services={snapshot.services.filter((service) => service.nodeId === node.id)} selected={selected.has(node.id)} activity={activityByNode.get(node.id)}
          compact={narrow || snapshot.nodes.length > 12} onSelect={onSelect}
          elementRef={(element) => { if (element) labelElements.current.set(node.id, element); else labelElements.current.delete(node.id); }} />)}
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: 'inset 0 0 100px #07111c66', background: 'linear-gradient(180deg, #08152133, transparent 20%, transparent 80%, #08152177)' }} />
    </SceneBoundary> : fallback}
  </div>;
}
