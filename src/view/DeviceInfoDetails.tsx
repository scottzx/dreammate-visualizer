import type { NodeView } from '../read-model/types';
import './device-info.css';

export default function DeviceInfoDetails({ node }: { node: NodeView }) {
  const device = node.device;
  return <section className="device-info-details" aria-label="基础设备信息">
    <h4 className="section-label">基础设备信息 <span>{device?.status === 'cached' ? '缓存' : device ? '节点上报' : '未提供'}</span></h4>
    {device ? <>
      <dl className="device-facts">
        <dt>设备型号</dt><dd>{device.model || '未知'}</dd>
        <dt>系统</dt><dd>{[device.systemName, device.systemVersion].filter(Boolean).join(' ') || '未知'}</dd>
        <dt>架构</dt><dd>{device.arch || '未知'}</dd>
        <dt>主机名</dt><dd>{device.hostname || '未知'}</dd>
      </dl>
      <details className="device-interfaces"><summary>本地网卡 · {device.interfaces.length}</summary>
        {device.interfaces.map(nic => <article className="device-interface" key={nic.name}>
          <strong>{nic.name}</strong><small>MAC <code>{nic.mac ?? '未知'}</code></small>
          {nic.addresses.map(ip => <div key={`${ip.family}:${ip.address}`}><code>{ip.family} · {ip.address}</code><small>子网掩码 <code>{ip.netmask}</code></small></div>)}
        </article>)}
      </details>
    </> : <p className="device-info-note">该节点尚未提供基础设备信息。</p>}
  </section>;
}
