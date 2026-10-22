import { Component, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3, OrthographicCamera, PCFShadowMap } from 'three';
import AssetModel from '../visual-assets/AssetModel';
import type { BaseLot } from '../read-model/universe';

export const lotLabels = { service: '服务工厂', academy: '技能学院', agents: '智能体驻地', project: '项目工坊' };
export const lotModel = (lot: BaseLot) => lot.type === 'service' ? 'service-factory' : lot.type === 'academy' ? 'academy' : lot.type === 'agents' ? 'workshop-advanced' : lot.grade > 1 ? 'workshop-advanced' : 'workshop-base';
export class ModelBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function Projection({ lots, positions, onProject }: { lots: BaseLot[]; positions: [number, number, number][]; onProject: (points: { id: string; x: number; y: number; visible: boolean }[]) => void }) {
  const { camera, size } = useThree(); const elapsed = useRef(0); const vector = useMemo(() => new Vector3(), []);
  useFrame((_state, delta) => { elapsed.current += delta; if (elapsed.current < .07) return; elapsed.current = 0; onProject(lots.map((lot, index) => { const [x, , z] = positions[index]; vector.set(x, 2.7, z).project(camera); return { id: lot.id, x: (vector.x + 1) * size.width / 2, y: (1 - vector.y) * size.height / 2, visible: vector.z < 1 && vector.z > -1 }; })); });
  return null;
}
/** Fit the grid in camera space, reserving pixel space for roof labels and the cockpit chrome. */
function GridCamera({ positions, onFit }: { positions: [number, number, number][]; onFit: (zoom: number) => void }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera) || !size.width || !size.height) return;
    camera.position.set(0, 35, 25);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const corner = new Vector3();
    for (const [x, , z] of positions) for (const dx of [-2.7, 2.7]) for (const dz of [-2.7, 2.7]) for (const y of [0, 3]) {
      corner.set(x + dx, y, z + dz).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
      minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
    }
    if (!positions.length) { minX = -5; maxX = 5; minY = -5; maxY = 5; }
    const left = Math.min(94, size.width * .1), right = left;
    const top = Math.min(142, size.height * .25), bottom = Math.min(132, size.height * .24);
    const zoom = Math.min((size.width - left - right) / Math.max(1, maxX - minX), (size.height - top - bottom) / Math.max(1, maxY - minY));
    camera.left = -size.width / 2; camera.right = size.width / 2;
    camera.top = size.height / 2; camera.bottom = -size.height / 2;
    camera.zoom = zoom;
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    const desiredX = (left + size.width - right) / 2 - size.width / 2;
    const desiredY = size.height / 2 - (top + size.height - bottom) / 2;
    camera.position.add(new Vector3(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(centerX - desiredX / zoom));
    camera.position.add(new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(centerY - desiredY / zoom));
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    onFit(zoom); invalidate();
  }, [camera, size.width, size.height, positions, onFit, invalidate]);
  return null;
}
export default function BaseMap({ lots, selectedId, onSelect }: { lots: BaseLot[]; selectedId?: string; onSelect: (lot: BaseLot) => void }) {
  const [gridZoom, setGridZoom] = useState(12);
  const [points, setPoints] = useState<{ id: string; x: number; y: number; visible: boolean }[]>([]);
  const columns = Math.max(3, Math.ceil(Math.sqrt(lots.length * 1.6))); const rows = Math.ceil(lots.length / columns);
  const positions = useMemo(() => lots.map((_lot, i): [number, number, number] => [(i % columns - (columns - 1) / 2) * 7, 0, (Math.floor(i / columns) - (rows - 1) / 2) * 7]), [lots, columns, rows]);
  return <div className="base-map">
    <ModelBoundary fallback={<div className="base-fallback">三维绘制暂不可用，请通过建筑目录进入。{lots.map(lot => <button key={lot.id} onClick={() => onSelect(lot)}>{lot.name}</button>)}</div>}>
      <Canvas orthographic shadows={{ type: PCFShadowMap }} camera={{ position: [0, 35, 25], zoom: 12, near: .1, far: 300 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <ambientLight intensity={1.25} /><directionalLight position={[12, 25, 12]} intensity={3} castShadow shadow-mapSize={[1024, 1024]} /><pointLight position={[-12, 10, -10]} intensity={50} color="#47dbe4" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.12, 0]} receiveShadow><planeGeometry args={[Math.max(42, columns * 8), Math.max(35, rows * 8)]} /><meshStandardMaterial color="#101f2b" roughness={.9} metalness={.25} /></mesh>
        <gridHelper args={[Math.max(48, columns * 8, rows * 8), Math.max(24, columns * 4, rows * 4), '#31536b', '#213344']} position={[0, -.1, 0]} />
        {lots.map((lot, index) => <group key={lot.id} position={positions[index]} onClick={event => { event.stopPropagation(); onSelect(lot); }}>
          <mesh position={[0, -.02, 0]}><boxGeometry args={[5.4, .12, 5.4]} /><meshStandardMaterial color={selectedId === lot.id ? '#205f6c' : lot.placeholder ? '#1b2632' : '#1c3546'} metalness={.5} roughness={.55} emissive={selectedId === lot.id ? '#145061' : '#07101c'} emissiveIntensity={.4} /></mesh>
          <AssetModel id={lotModel(lot)} scale={1} />
          {lot.grade > 1 && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .06, 0]}><ringGeometry args={[2.38, 2.43, 48]} /><meshBasicMaterial color={lot.grade === 3 ? '#f6ad55' : '#5dd5dd'} /></mesh>}
        </group>)}
        <GridCamera positions={positions} onFit={setGridZoom} /><Projection lots={lots} positions={positions} onProject={setPoints} />
      </Canvas>
      <div className="base-labels">{points.map(point => { const lot = lots.find(item => item.id === point.id); return lot && point.visible && <button title={lot.name} style={{ left: point.x, top: point.y, maxWidth: Math.max(70, Math.min(160, gridZoom * 6.2)) }} className={`base-label ${selectedId === lot.id ? 'selected' : ''} ${lot.placeholder ? 'unconnected' : ''}`} key={point.id} onClick={() => onSelect(lot)}><small>{lotLabels[lot.type]} · {lot.placeholder ? '待接入' : `L${lot.grade}`}</small><strong>{lot.name}</strong></button>; })}</div>
    </ModelBoundary>
    <div className="base-map-note">统一 4 × 4 建筑占地 · 同高模块 · 附件与材质表达积累</div>
  </div>;
}
