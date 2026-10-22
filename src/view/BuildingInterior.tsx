import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PCFShadowMap } from 'three';
import AssetModel from '../visual-assets/AssetModel';
import { lotLabels, lotModel, ModelBoundary } from './BaseMap';
import { projectProviderShares, type BaseLot } from '../read-model/universe';
import type { ProjectView } from '../read-model/types';

export default function BuildingInterior({ lot, project }: { lot: BaseLot; project?: ProjectView }) {
  const shares = project ? projectProviderShares(project) : [];
  // Tokens show the observed provider composition; never claim these are live workers.
  const tokens = shares.flatMap((share, index) => Array.from({ length: Math.max(1, Math.round(share.share * 10)) }, (_, i) => ({ provider: share.name, index, key: `${share.name}:${i}` })));
  return <div className="building-interior"><ModelBoundary fallback={<div className="base-fallback">三维模型暂不可用，可在详情 HUD 查看目录与证据。</div>}><Canvas shadows={{ type: PCFShadowMap }} camera={{ position: [9, 8, 11], fov: 40 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}><ambientLight intensity={1.3} /><directionalLight position={[8, 16, 10]} intensity={3.5} castShadow shadow-mapSize={[1024, 1024]} /><pointLight position={[-8, 4, 2]} intensity={60} color="#5ee1f0" /><mesh position={[0, -.1, 0]} receiveShadow><cylinderGeometry args={[5.5, 5.5, .18, 64]} /><meshStandardMaterial color="#152f42" metalness={.6} roughness={.4} /></mesh><AssetModel id={lotModel(lot)} scale={1.4} />{tokens.map((token, index) => { const angle = index / tokens.length * Math.PI * 2; return <group key={token.key} position={[Math.sin(angle) * 4.2, 0, Math.cos(angle) * 4.2]} rotation={[0, angle, 0]}><AssetModel id="agent-base" scale={.55} /><mesh position={[0, 1.35, 0]}><sphereGeometry args={[.12, 12, 12]} /><meshBasicMaterial color={token.provider === '未归属' ? '#8293a4' : ['#5ce0df', '#ffb65d', '#a79bff', '#82d497'][token.index % 4]} /></mesh></group>; })}<gridHelper args={[20, 20, '#284b63', '#152738']} position={[0, -.2, 0]} /><OrbitControls makeDefault minDistance={7} maxDistance={25} maxPolarAngle={Math.PI / 2.1} /></Canvas></ModelBoundary><div className="interior-caption"><span>{lotLabels[lot.type]} / L{lot.grade}</span><h2>{lot.name}</h2><p>{tokens.length ? '人物为已观测会话宿主占比示意，不代表当前在线人数。' : lot.placeholder ? '项目、会话与产物目录尚未接入。' : '可旋转观察模块化三维建筑，具体内容见详情 HUD。'}</p></div></div>;
}
