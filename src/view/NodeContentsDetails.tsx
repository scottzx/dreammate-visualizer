import type { ObserverSnapshot, ProjectStorageView } from '../read-model/types';
import { formatStorageBytes, formatStorageShare, planetContents, planetStorageComposition, PROJECT_CATEGORY_LABELS, PROJECT_COLORS } from '../read-model/planet-contents';
import './planet-contents.css';

export function ProjectStorageDetails({ rows }: { rows: ProjectStorageView[] }) {
  return <div className="project-footprint-details">{rows.map(row => <div key={`${row.nodeId}:${row.path}`}>
    <strong><i style={{ background: row.bytes === null || row.status !== 'ok' ? PROJECT_COLORS.unknown : PROJECT_COLORS[row.category] }} />{PROJECT_CATEGORY_LABELS[row.category]} · {row.bytes === null || row.status !== 'ok' ? '未探查' : formatStorageBytes(row.bytes)}</strong>
    <code>{row.path}</code>
    <small>{row.observedAt ? `统计于 ${new Date(row.observedAt).toLocaleString('zh-CN', { hour12: false })}` : '占用未知'}{row.note ? ` · ${row.note}` : ''}</small>
  </div>)}</div>;
}

export default function NodeContentsDetails({ snapshot, nodeId }: { snapshot: ObserverSnapshot; nodeId: string }) {
  const contents = planetContents(snapshot, nodeId), composition = planetStorageComposition(snapshot, nodeId);
  const share = composition.totalBytes !== null && composition.remainderBytes !== null ? composition.measuredBytes / composition.totalBytes : null;
  return <section className="planet-contents-details" aria-label="星环、Skill 星点与项目存储占比" data-testid="planet-contents-details">
    <div className="planet-content-totals">
      <div><strong>{contents.catalogKnown ? contents.services.length : '—'}</strong><span>能力卫星 · 服务</span></div>
      <div><strong>{contents.skillsStatus === 'unknown' ? '—' : contents.skills.length}</strong><span>Skill 包星点{contents.skillsStatus === 'partial' ? ' · 部分' : ''}</span></div>
    </div>
    <div className="planet-storage-heading"><strong>项目存储占用</strong><span>{composition.rows.length ? `${composition.rows.length} 个配置项目` : '未探查'}</span></div>
    <div className="planet-storage-total"><strong>{composition.rows.some(row => row.bytes !== null && row.status === 'ok') ? formatStorageBytes(composition.measuredBytes) : '—'}</strong><span>{share === null ? '占设备比例未知' : `占设备 ${formatStorageShare(share)}`}</span></div>
    <div className="planet-storage-track" aria-label={`已测项目占设备 ${formatStorageShare(share)}，其余为未探查或未归属`}>
      {composition.segments.map(segment => <i key={segment.category} style={{ width: `${(segment.share ?? 0) * 100}%`, background: PROJECT_COLORS[segment.category] }} />)}
    </div>
    {composition.rows.length > 0 && <div className="planet-storage-categories">{composition.segments.filter(segment => segment.bytes > 0).map(segment => <div key={segment.category}><i style={{ background: PROJECT_COLORS[segment.category] }} /><span>{PROJECT_CATEGORY_LABELS[segment.category]}</span><strong>{formatStorageBytes(segment.bytes)}</strong><small>{formatStorageShare(segment.share)}</small></div>)}</div>}
    <p className="planet-storage-note"><i style={{ background: PROJECT_COLORS.unknown }} />灰色{share === null ? '' : ` ${formatStorageShare(1 - share)}`} · 未探查 / 未归属，包含其他文件及空闲空间。</p>
    {composition.rows.map(row => <details className="planet-project-row" key={`${row.id}:${row.path}`}><summary><i style={{ background: row.bytes !== null && row.status === 'ok' ? PROJECT_COLORS[row.category] : PROJECT_COLORS.unknown }} /><span>{row.name}</span><strong>{row.bytes !== null && row.status === 'ok' ? formatStorageBytes(row.bytes) : '未探查'}</strong></summary><ProjectStorageDetails rows={[row]} /></details>)}
    <p className="planet-storage-scope">卫星可点击查看服务方法；星点按目录 ID 去重。项目只统计所列目录的存储，含依赖与构建；目录存在不表示正在执行。</p>
  </section>;
}
