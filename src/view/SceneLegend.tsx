import { useEffect, useRef } from 'react';
import { CircleHelp, X } from 'lucide-react';
import type { ObserverSnapshot } from '../read-model/types';
import { centralNetworkRelay } from '../read-model/network';
import { serviceEntry, serviceSystems } from '../read-model/service-systems';
import { displayNetworkEndpoint } from '../read-model/ip-privacy';
import { PROJECT_COLORS, PROJECT_CATEGORY_LABELS } from '../read-model/planet-contents';
import './scene-legend.css';

export default function SceneLegend({ snapshot, showConnections, onClose }: {
  snapshot: ObserverSnapshot | null; showConnections: boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  const close = () => dialog.current?.close();
  const network = snapshot?.network;
  const relay = snapshot ? centralNetworkRelay(snapshot) : undefined;
  const observer = snapshot?.nodes.find(node => node.id === network?.observerNodeId);
  const direct = network?.connections.filter(connection => connection.kind === 'direct').length;
  const relayed = network?.connections.filter(connection => connection.kind === 'derp').length;
  const entry = snapshot ? serviceEntry(snapshot, window.location.href) : undefined;
  const local = snapshot && entry ? serviceSystems(snapshot, entry).find(system => system.kind === 'entry') : undefined;

  return <dialog ref={dialog} className="scene-legend-dialog" aria-labelledby="scene-legend-title" aria-describedby="scene-legend-description" onClose={onClose}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
    }}>
    <header className="scene-legend-header">
      <div><span className="eyebrow">MAP LEGEND</span><h2 id="scene-legend-title"><CircleHelp size={18} />图例说明</h2><p id="scene-legend-description">星球、颜色与连线分别代表什么</p></div>
      <button className="icon-button" onClick={close} aria-label="关闭图例说明" autoFocus><X size={20} /></button>
    </header>
    <div className="scene-legend-body">
      <section className="scene-legend-section scene-legend-wide">
        <h3>两级公转 · 服务域名是小太阳系中心</h3>
        <p>{entry?.authority || '当前服务入口'} 对应的设备是“太阳”，与它直连的设备围绕它做小公转。整个小星系与远端节点一起，绕 DERP 总中心做较慢的大公转。</p>
        <p>各星系与设备沿不同倾角、朝向的立体椭圆轨道运行，自转轴与能力星环也各不相同。轨迹和运动均为视觉示意。</p>
        <p>{local ? `当前服务星系包含 ${local.nodeIds.length} 台设备；可用底部的“服务太阳系”按钮近看并跟随。` : '当前服务设备身份未确定，等待有效节点观测。'} 域名别名可指向同一设备；服务中心不会按公网出口 IP 合并。</p>
      </section>
      <section className="scene-legend-section">
        <h3>星球与在线状态</h3>
        <div className="scene-legend-states"><span><i className="legend-planet online" />设备在线 · 星球点亮</span><span><i className="legend-planet offline" />离线 / 未核验 · 星球变暗</span></div>
        <p>每颗星球对应一台设备。将鼠标靠近星球显示标签，移开后收起；点击星球查看详情。优先使用设备网络状态；缺少网络状态时，使用有效的网关探活结果。</p>
      </section>
      <section className="scene-legend-section">
        <h3>星球大小 · 存储容量</h3>
        <div className="scene-legend-sizes">{[64, 128, 256, 512].map(gb => <span key={gb}><i style={{ width: 17 * Math.cbrt(gb / 64), height: 17 * Math.cbrt(gb / 64) }} /><small>{gb} GB</small></span>)}</div>
        <p>体积与设备存储总容量成正比。未采集到容量时，统一按 128 GB 显示并标记“默认”。</p>
      </section>
      <section className="scene-legend-section">
        <h3>卫星与星点</h3>
        <div className="scene-legend-symbols"><span><b className="legend-satellite">◈</b>一颗卫星 = 一个可见服务</span><span><b className="legend-skill">✦</b>一个星点 = 一个可见 Skill 包</span></div>
        <p>Skill 按目录 ID 去重；目录部分覆盖时，只展示已观测到的条目。公转为示意，不表示实时任务。</p>
      </section>
      <section className="scene-legend-section">
        <h3>球面颜色 · 项目存储占比</h3>
        <div className="scene-legend-colors">{(['business-agent', 'perception', 'other', 'unknown'] as const).map(category => <span key={category}><i style={{ background: PROJECT_COLORS[category] }} />{category === 'unknown' ? '未探查 / 未归属' : PROJECT_CATEGORY_LABELS[category]}</span>)}</div>
        <p>色块按已测项目占设备总存储的比例显示。灰色包含未探查、未归属及其他容量，不能视为空闲空间。</p>
      </section>
      <section className="scene-legend-section scene-legend-wide">
        <h3>网络与协作连线</h3>
        <div className="scene-legend-lines"><span><i className="legend-line direct" />青蓝 · 本机观测的设备直连</span><span><i className="legend-line relay" />金色 · 经 DERP 中继</span><span><i className="legend-line peer" />淡线 · 对等关系示意</span><span><i className="legend-line event" />虚线 · 有证据的协作事件</span></div>
        <p>直连与中继描述本机观察到的路径；淡线不证明两台设备实际互通，也不表示调用次数。</p>
        <div className="scene-legend-network">
          {relay && <><strong>DERP 中继中心 · {relay.regionCode}</strong><span>{displayNetworkEndpoint(`${relay.host}:${relay.port}`, snapshot?.nodes.find(node => node.id === relay.nodeId)?.name ?? '中继服务')}</span></>}
          <span>{observer?.name ?? '本机'}观测：{network?.status === 'ok' ? `${direct} 条直连 · ${relayed} 条 DERP 中继连接` : '连接路径尚未核验，等待有效观测。'}</span>
          {!showConnections && <span>地图连线已隐藏，可通过右上角的链路按钮打开。</span>}
        </div>
      </section>
    </div>
    <footer className="scene-legend-footer">拖动旋转 · 滚轮 / 双指缩放 · 单击查看详情 · 双击进入基地</footer>
  </dialog>;
}
