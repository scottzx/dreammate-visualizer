import { Component, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import AssetModel from '../visual-assets/AssetModel';
import { UNIVERSE_MODEL_IDS, UNIVERSE_MODEL_REVISION, type UniverseModelId } from '../visual-assets/models';
import { assetUrl } from './deployment';
import './model-gallery.css';

const labels: Record<UniverseModelId, string> = {
  'planet-hub': '暖金戴森核心', 'planet-peripheral': '冷光戴森节点',
  'ship-base': '基础能力星舰', 'ship-advanced': '进阶能力星舰',
  'workshop-base': '初建项目工坊', 'workshop-advanced': '进阶项目工坊',
  'academy': '技能学院', 'service-factory': '服务工厂',
  'agent-base': '通用智能体', 'agent-resident': '常驻智能体',
};
class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="mg-error">三维预览不可用；仍可下载 GLB 模型文件。</div> : this.props.children; }
}
function Model({ id, onReady }: { id: UniverseModelId; onReady: () => void }) {
  useEffect(onReady, [id, onReady]);
  return <AssetModel id={id} />;
}
function ViewCamera({ id }: { id: UniverseModelId }) {
  const { camera } = useThree();
  const grounded = !id.startsWith('planet') && !id.startsWith('ship');
  const target = grounded ? .8 : 0;
  useEffect(() => { camera.position.set(7, 5.4 + target, 8); camera.lookAt(0, target, 0); }, [camera, target]);
  return <OrbitControls target={[0, target, 0]} makeDefault minZoom={35} maxZoom={200} enableDamping={false} />;
}
export default function ModelGallery() {
  const [selected, setSelected] = useState<UniverseModelId>('planet-hub');
  const [ready, setReady] = useState(false);
  const grounded = !selected.startsWith('planet') && !selected.startsWith('ship');
  return <div className="mg-page">
    <header className="mg-header"><div><span>DREAMMATE / REUSABLE 3D ASSETS</span><h1>能力宇宙 · 三维模型图鉴</h1><p>拖动旋转，滚轮缩放。每件样本都是驾驶舱中实际使用的独立 GLB 模型。</p></div><a href={assetUrl('')}>返回宇宙驾驶舱 →</a></header>
    <div className="mg-layout"><nav className="mg-assets" aria-label="选择三维模型">{UNIVERSE_MODEL_IDS.map(id => <button type="button" key={id} aria-pressed={selected === id} onClick={() => { setReady(false); setSelected(id); }}>{labels[id]}<small>{id}.glb</small></button>)}</nav>
      <section className="mg-view"><div className="mg-view-title"><strong>{labels[selected]}</strong><a href={assetUrl(`models/universe-v1/${selected}.glb?rev=${UNIVERSE_MODEL_REVISION}`)} download>下载 GLB</a></div><div className="mg-canvas" data-model-ready={ready} data-model-id={selected}>
        <ViewerBoundary key={selected}><Canvas orthographic camera={{ position: [7, 5.4, 8], zoom: 100, near: .1, far: 100 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
          <color attach="background" args={['#0b1827']} /><ambientLight intensity={1.25} /><hemisphereLight args={['#b5e6ff', '#273845', 1.8]} />
          <directionalLight position={[-4, 7, 5]} intensity={3} color="#ffe7c7" /><directionalLight position={[5, 3, -4]} intensity={2} color="#88d8ff" />
          <ViewCamera id={selected} /><Suspense fallback={null}><Model id={selected} onReady={() => setReady(true)} /></Suspense>
          {grounded && <gridHelper args={[10, 20, '#29465b', '#162c3c']} position={[0, -.025, 0]} />}
        </Canvas></ViewerBoundary>
      </div><div className="mg-info"><span>{ready ? '模型已加载' : '正在加载三维模型…'}</span><span>{grounded ? selected.startsWith('agent') ? '共享身体骨架 · 身份与工具附件复用' : '统一占地 4 × 4 · 总高度 2' : selected.startsWith('planet') ? '戴森球壳 · 恒星内核 / 采集面板 / 轨道设施' : '能力舰群素材 · 共享主舰体与模块接口'}</span></div></section>
    </div><footer className="mg-footer">球壳结构、恒星光效和舰群均为视觉示意；驾驶舱按设备存储统一换算球体体积。</footer>
  </div>;
}
