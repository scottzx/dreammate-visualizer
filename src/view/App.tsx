import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, Box, Boxes, Check,
  ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Code2, Database,
  Factory, FileCheck2, Fingerprint, FlaskConical, GitBranch,
  Link2, LoaderCircle, Maximize2, Minimize2, Network, Pause, Presentation, Radio, Plus, Minus, Focus, Orbit, Sun,
  RefreshCw, Rocket, RotateCcw, Search, Server, ShieldCheck, SlidersHorizontal, Terminal,
  TriangleAlert, X,
} from 'lucide-react';
import type { DataMode, Evidence, EventView, JobView, NodeView, ObserverSnapshot, Selection, ServiceView, SourceView, VoyageView, WorkStatus } from '../read-model/types';
import { buildBaseLots, projectProviderShares, summarizeNode, type BaseLot } from '../read-model/universe';
import { sortVoyages, voyageCounts, voyageKindLabel, voyageNodeIds } from '../read-model/voyages';
import StageViewport from './StageViewport';
import SceneLegend from './SceneLegend';
import NodeContentsDetails, { ProjectStorageDetails } from './NodeContentsDetails';
import DeviceInfoDetails from './DeviceInfoDetails';
import { formatNodeStorage, nodeStorageBytes } from '../read-model/storage';
import type { UniverseNavigationAction } from './UniverseScene';
import { displayNetworkEndpoint } from '../read-model/ip-privacy';
import { resolveSkillSelection } from './layout';
import { createSnapshotPolling, snapshotRefreshInterval } from './snapshot-polling';
import { STANDALONE_DEMO, assetUrl } from './deployment';
import { standaloneDemoSnapshot } from './standalone-snapshot';
import './styles.css';
import './cockpit-tech.css';
import './cockpit-header.css';
import './hud-layout.css';

const UniverseScene = lazy(() => import('./UniverseScene'));
const BaseMap = lazy(() => import('./BaseMap'));
const BuildingInterior = lazy(() => import('./BuildingInterior'));
const SkillDocument = lazy(() => import('./SkillDocument'));

type Panel = 'overview' | 'jobs' | 'nodes' | 'capabilities' | 'sources' | 'events' | 'voyages';
type Filter = 'all' | 'online' | 'attention';

/**
 * Presentation mode (`?display=1`): the observation surface keeps its chrome out
 * of the way and panels slide in as drawers. The GitHub Pages landing page uses
 * this for the embedded demo; the observer itself keeps the workbench layout.
 */
const DISPLAY_MODE_REQUESTED = (() => {
  try { return new URLSearchParams(window.location.search).get('display') === '1'; } catch { return false; }
})();
const EMBED_REQUESTED = (() => {
  try { return new URLSearchParams(window.location.search).get('embed') === '1'; } catch { return false; }
})();
const IS_EMBEDDED = (() => {
  try { return EMBED_REQUESTED || window.self !== window.top; } catch { return true; }
})();

const coverageText: Record<string, string> = { ok: '已采集', offline: '离线', unavailable: '不可达', forbidden: '无权限', unsupported: '未支持', partial: '部分覆盖', stale: '已过期', unknown: '未知' };
const workText: Record<WorkStatus, string> = { queued: '排队中', running: '执行中', input_required: '等待确认', succeeded: '已完成', failed: '失败', canceled: '已取消', rejected: '已拒绝', unknown: '未知' };
const triggerText = { human: '用户', agent: '智能体', automation: '自动化', unknown: '未知' };
const validSource = (source: SourceView) => source.status === 'ok' || source.status === 'partial';
const time = (value?: string | null, seconds = false) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) }) : '未观测';
const fullDate = (value?: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未观测';
const shortId = (value: string) => value.length > 40 ? `${value.slice(0, 22)}…${value.slice(-10)}` : value;
const sourceTone = (value: string) => value === 'ok' || value === 'up' ? 'green' : ['partial', 'stale', 'unknown'].includes(value) ? 'amber' : 'red';
const jobTone = (value: WorkStatus) => ({ queued: 'amber', running: 'blue', input_required: 'purple', succeeded: 'green', failed: 'red', canceled: 'muted', rejected: 'red', unknown: 'muted' })[value];
const contains = (values: unknown[], query: string) => !query || values.join(' ').toLowerCase().includes(query.toLowerCase());
const hasObservation = (value?: string | null): value is string => Boolean(value && Number.isFinite(Date.parse(value)));
const nodeBadge = (node: NodeView) => node.status === 'stale' ? { tone: 'amber', label: '快照过期' } : node.online === true ? { tone: 'green', label: '探活在线' } : node.online === false ? { tone: 'red', label: '探活离线' } : { tone: 'muted', label: '在线未知' };
const serviceBadge = (service: ServiceView) => service.status === 'up' ? service.observedAt ? { tone: 'green', label: '观测可用' } : { tone: 'amber', label: '申报可用' } : service.status === 'down' ? { tone: 'red', label: '不可用' } : { tone: 'muted', label: '健康未知' };
const serviceSkillLabel = (service: ServiceView) => !service.skills.length && service.skillsStatus !== 'ok' ? 'Skill 未核验' : `${service.skills.length} 可见 Skill`;

function Badge({ tone = 'muted', children, dot = true }: { tone?: string; children: ReactNode; dot?: boolean }) {
  return <span className={`badge badge-${tone}`}>{dot && <span className="status-dot" />}{children}</span>;
}
function EmptyState({ icon = <Database size={25} />, title, detail }: { icon?: ReactNode; title: string; detail?: string }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong>{detail && <p>{detail}</p>}</div>;
}
function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return <div className="evidence-list"><h4><Fingerprint size={13} /> 来源证据</h4>{evidence.length ? evidence.map((item, index) => <div className="evidence-item" key={`${item.sourceId}-${index}`}><div><code>{item.sourceId}</code><time>{time(item.observedAt, true)}</time></div>{item.nativeId && <span className="mono break">原生 ID · {item.nativeId}</span>}{item.locator && <span className="mono break">定位 · {item.locator}</span>}{item.note && <p>{item.note}</p>}</div>) : <p className="subtle">来源未提供可用的证据引用。</p>}</div>;
}
function Field({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return <div className="detail-field"><span>{label}</span><div className={mono ? 'mono break' : 'break'}>{children}</div></div>;
}
function SourceCards({ sources }: { sources: SourceView[] }) {
  return <div className="source-list">{sources.map(source => <article className="source-card" key={source.id}><div className="item-topline"><span className={`entity-icon ${sourceTone(source.status)}`}><Database size={16} /></span><Badge tone={sourceTone(source.status)}>{coverageText[source.status]}</Badge></div><h3>{source.name}</h3><p className="source-scope">{source.scope}</p><Field label="来源 ID" mono>{source.id}</Field>{source.version && <Field label="版本">{source.version}</Field>}{source.url && <Field label="读取地址" mono>{displayNetworkEndpoint(source.url)}</Field>}<Field label="观测时间">{fullDate(source.observedAt)}</Field>{source.kind === 'acp' && <Field label="工作单列表观测">{hasObservation(source.jobsObservedAt) ? fullDate(source.jobsObservedAt) : '未核验'}</Field>}{source.diagnostics.length > 0 && <div className="source-diagnostics">{source.diagnostics.map((line, i) => <p key={i}><TriangleAlert size={12} />{line}</p>)}</div>}</article>)}{!sources.length && <EmptyState title="尚无来源信息" detail="连接观察后端后，将展示明确配置的来源与覆盖范围。" />}</div>;
}

function useDisplayClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
function CurrentTime() {
  const now = useDisplayClock();
  return <time>{new Date(now).toLocaleTimeString('zh-CN', { hour12: false })}</time>;
}
function SnapshotTime({ generatedAt }: { generatedAt?: string }) {
  const now = useDisplayClock();
  const age = generatedAt ? Math.max(0, Math.floor((now - Date.parse(generatedAt)) / 1000)) : null;
  return <>{generatedAt ? `快照 ${time(generatedAt, true)} · ${Number.isFinite(age) ? age : '—'} 秒前` : '等待快照'}</>;
}

export default function App() {
  const [mode, setMode] = useState<DataMode>(STANDALONE_DEMO ? 'demo' : 'live');
  const [snapshot, setSnapshot] = useState<ObserverSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [panel, setPanel] = useState<Panel>('overview');
  const [displayMode, setDisplayMode] = useState(DISPLAY_MODE_REQUESTED);
  const [leftOpen, setLeftOpen] = useState(!DISPLAY_MODE_REQUESTED && window.innerWidth >= 1100);
  const [rightOpen, setRightOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [selectedLot, setSelectedLot] = useState<BaseLot | null>(null);
  const [insideBuilding, setInsideBuilding] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [showConnections, setShowConnections] = useState(true);
  const [showVoyages, setShowVoyages] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [navigationAction, setNavigationAction] = useState<UniverseNavigationAction>();
  const navigateUniverse = (type: UniverseNavigationAction['type']) => setNavigationAction(previous => ({ sequence: (previous?.sequence ?? 0) + 1, type }));
  const [sourceDrawer, setSourceDrawer] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const requestGeneration = useRef(0);
  const latestMode = useRef<DataMode>(STANDALONE_DEMO ? 'demo' : 'live');
  const refreshAction = useRef<(() => void) | null>(null);
  const refreshNow = () => refreshAction.current?.();

  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);
  useEffect(() => { if (STANDALONE_DEMO) document.title = '能力宇宙演示 · 一伴'; }, []);
  useEffect(() => {
    if (!displayMode) return;
    const closeDrawers = (event: KeyboardEvent) => { if (event.key === 'Escape') { setLeftOpen(false); setRightOpen(false); } };
    window.addEventListener('keydown', closeDrawers);
    return () => window.removeEventListener('keydown', closeDrawers);
  }, [displayMode]);
  useEffect(() => {
    const abort = new AbortController();
    const generation = ++requestGeneration.current;
    const isCurrent = () => !abort.signal.aborted && generation === requestGeneration.current && latestMode.current === mode;
    const polling = createSnapshotPolling({
      isVisible: () => document.visibilityState !== 'hidden',
      request: async force => {
        if (!isCurrent()) return;
        setLoading(true);
        try {
          if (STANDALONE_DEMO) {
            // GitHub Pages build: generate the isolated scenario locally, on the
            // same 3-minute cycle the observer advertises for demo snapshots.
            const data = standaloneDemoSnapshot();
            if (!isCurrent()) return;
            setSnapshot(data); setError(null);
            return data.refreshIntervalMs;
          }
          const response = await fetch(`/api/snapshot?mode=${mode}${force ? '&refresh=1' : ''}`, { signal: abort.signal, cache: 'no-store' });
          if (!response.ok) throw new Error(`观察后端返回 HTTP ${response.status}`);
          const data: ObserverSnapshot = await response.json();
          if (!isCurrent()) return;
          if (data?.version !== 1 || data.mode !== mode || !['nodes', 'services', 'jobs', 'events', 'sources', 'limitations'].every(key => Array.isArray(data[key as keyof ObserverSnapshot]))) throw new Error('快照格式或数据模式不匹配');
          setSnapshot(data); setError(null);
          return snapshotRefreshInterval(data.refreshIntervalMs);
        } catch (reason: unknown) {
          if (isCurrent()) setError(reason instanceof Error ? reason.message : '无法读取观察快照');
        } finally {
          if (isCurrent()) setLoading(false);
        }
      },
    });
    refreshAction.current = polling.refreshNow;
    document.addEventListener('visibilitychange', polling.visibilityChanged);
    return () => {
      polling.stop(); abort.abort();
      refreshAction.current = null;
      document.removeEventListener('visibilitychange', polling.visibilityChanged);
    };
  }, [mode]);
  useEffect(() => {
    const handler = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
  useEffect(() => {
    if (!sourceDrawer) return;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') setSourceDrawer(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sourceDrawer]);

  const switchMode = (next: DataMode) => { if (mode === next) return; latestMode.current = next; requestGeneration.current++; setSnapshot(null); setSelection(null); setSelectedLot(null); setActiveNodeId(null); setInsideBuilding(false); setRightOpen(false); setError(null); setLoading(true); setMode(next); };
  const openPanel = (next: Panel) => { setPanel(next); setSelection(null); setSelectedLot(null); setInsideBuilding(false); setLeftOpen(true); setRightOpen(false); };
  const select = (next: Selection | null) => { setSelection(next); setSelectedLot(null); setInsideBuilding(false); if (next) { setPanel(next.type === 'node' ? 'nodes' : next.type === 'service' || next.type === 'skill' ? 'capabilities' : next.type === 'event' ? 'events' : next.type === 'voyage' ? 'voyages' : 'jobs'); setRightOpen(true); if (window.innerWidth < 900 || displayMode) setLeftOpen(false); } else setRightOpen(false); };
  const setPresentation = (next: boolean) => {
    setDisplayMode(next);
    setLeftOpen(!next && window.innerWidth >= 1100);
    setRightOpen(false);
    if (next) { setSearchOpen(false); setQuery(''); }
    try {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set('display', '1'); else url.searchParams.delete('display');
      window.history.replaceState(null, '', url);
    } catch { /* history is optional in embedded or restricted contexts */ }
  };

  const nodes = snapshot?.nodes ?? [], services = snapshot?.services ?? [], jobs = snapshot?.jobs ?? [], events = snapshot?.events ?? [], sources = snapshot?.sources ?? [], voyages = snapshot?.voyages ?? [];
  const onlineNodes = nodes.filter(node => node.online === true && node.status !== 'stale').length;
  const unknownNodes = nodes.filter(node => node.online === null || node.status === 'unknown' || node.status === 'stale').length;
  const healthyServices = services.filter(service => service.status === 'up' && service.observedAt !== null).length;
  const methods = services.flatMap(service => service.methods.map(method => ({ ...method, service })));
  const skillCount = services.reduce((count, service) => count + service.skills.length, 0);
  const skillsPartial = services.some(service => service.skillsStatus !== 'ok');
  const skillInventoryLabel = !skillCount && skillsPartial ? 'Skill 未核验' : `${skillCount} 个可见 Skill 声明`;
  const attempts = jobs.reduce((count, job) => count + job.attempts.length, 0);
  const nodeKnown = nodes.length > 0 || sources.some(source => source.kind === 'node' && validSource(source));
  const nodeCatalogKnown = (node: NodeView) => (node.catalogAvailable === true && node.observedAt !== null) || services.some(service => service.nodeId === node.id);
  const catalogKnown = nodes.some(node => node.catalogAvailable === true && node.observedAt !== null) || services.length > 0;
  const catalogPartial = nodes.some(node => node.catalogAvailable === false || node.status !== 'ok') || sources.some(source => source.kind === 'node' && source.status !== 'ok');
  const catalogCached = Boolean(error && snapshot) || nodes.some(node => nodeCatalogKnown(node) && node.status === 'stale') || sources.some(source => source.kind === 'node' && source.status === 'stale');
  const catalogObservations = [...nodes.filter(node => nodeCatalogKnown(node)).map(node => node.observedAt), ...services.map(service => service.observedAt)].filter((value): value is string => value !== null && Number.isFinite(Date.parse(value)));
  const lastCatalogObservation = catalogObservations.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const catalogContext = catalogKnown ? `${catalogCached ? '含缓存 · 部分目录' : catalogPartial ? '含缓存/部分目录' : '已读可见目录'} · 最近观测 ${time(lastCatalogObservation, true)}` : '目录读取未完成或来源不可用';
  const workSources = sources.filter(source => source.kind === 'acp');
  const workObservations = workSources.map(source => source.jobsObservedAt).filter(hasObservation);
  const workKnown = jobs.length > 0 || workObservations.length > 0;
  const workPartial = Boolean(error && snapshot && workKnown) || workSources.some(source => source.status !== 'ok' || !hasObservation(source.jobsObservedAt));
  const lastWorkObservation = workObservations.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? (mode === 'demo' && workKnown ? snapshot?.generatedAt : undefined);
  const workContext = workKnown ? `${workPartial ? '含缓存/部分工作单' : '已读授权范围'} · 列表观测 ${hasObservation(lastWorkObservation) ? time(lastWorkObservation, true) : '未提供'}` : '未成功核验授权工作单列表';
  const voyageStats = voyageCounts(voyages);
  const voyageSources = sources.filter(source => source.kind === 'sessions');
  const voyageSourceKnown = mode === 'demo' ? voyages.length > 0 : voyageSources.some(validSource);
  const voyagePartial = Boolean(error && snapshot && voyages.length) || voyageSources.some(source => source.status !== 'ok');
  const voyageContext = voyageSourceKnown ? `${voyagePartial ? '含缓存/部分会话' : '已读本地会话范围'} · 观测 ${time(voyages[0]?.updatedAt, true)} · 每 ${snapshotRefreshInterval(snapshot?.refreshIntervalMs) / 60_000} 分钟重演起航` : '本地会话来源未接入，航次范围未知';
  const healthySources = sources.filter(source => source.status === 'ok').length;
  const problematicSources = sources.filter(source => source.status !== 'ok').length;
  const selectedNode = selection?.type === 'node' ? nodes.find(node => node.id === selection.id) : undefined;
  const selectedService = selection?.type === 'service' ? services.find(service => service.id === selection.id) : undefined;
  const selectedSkill = snapshot ? resolveSkillSelection(snapshot, selection)?.skill : undefined;
  const selectedJob = selection?.type === 'job' ? jobs.find(job => job.id === selection.id) : undefined;
  const selectedEvent = selection?.type === 'event' ? events.find(event => event.id === selection.id) : undefined;
  const selectedVoyage = selection?.type === 'voyage' ? voyages.find(voyage => voyage.id === selection.id) : undefined;

  const filteredNodes = useMemo(() => nodes.filter(node => {
    const nodeServices = services.filter(service => service.nodeId === node.id);
    const linkedJobs = jobs.filter(job => job.attempts.some(attempt => attempt.nodeId === node.id));
    const linkedEvents = events.filter(event => event.nodeId === node.id || event.targetNodeId === node.id);
    const matches = contains([node.id, node.name, node.address, node.platform, ...nodeServices.flatMap(service => [service.name, service.description, ...service.methods.map(method => method.name), ...service.skills.map(skill => skill.name)]), ...linkedJobs.flatMap(job => [job.id, job.title]), ...linkedEvents.flatMap(event => [event.title, event.type])], query);
    return matches && (filter === 'all' || (filter === 'online' ? node.online === true && node.status !== 'stale' : node.online !== true || node.status !== 'ok' || nodeServices.some(service => service.status === 'down')));
  }), [nodes, services, jobs, events, query, filter]);
  const visibleNodeIds = useMemo(() => filteredNodes.map(node => node.id), [filteredNodes]);
  const filteredServices = services.filter(service => visibleNodeIds.includes(service.nodeId) && contains([service.name, service.description, ...service.methods.map(method => method.name), ...service.skills.map(skill => skill.name), nodes.find(node => node.id === service.nodeId)?.name], query) && (filter !== 'attention' || service.status !== 'up'));
  const filteredJobs = jobs.filter(job => contains([job.id, job.title, job.sourceStatus, ...job.attempts.flatMap(attempt => [attempt.agent, nodes.find(node => node.id === attempt.nodeId)?.name])], query) && (filter === 'all' || (filter === 'online' ? job.attempts.some(attempt => attempt.nodeId && visibleNodeIds.includes(attempt.nodeId)) : ['failed', 'rejected', 'input_required', 'unknown'].includes(job.status))));
  const filteredEvents = events.filter(event => contains([event.title, event.type, event.id, nodes.find(node => node.id === event.nodeId)?.name], query) && (filter === 'all' || (filter === 'online' ? Boolean(event.nodeId && visibleNodeIds.includes(event.nodeId)) : ['failed', 'rejected', 'input_required', 'unknown'].includes(event.status))));
  const filteredSources = sources.filter(source => contains([source.name, source.id, source.scope], query) && (filter === 'all' || (filter === 'online' ? source.status === 'ok' : source.status !== 'ok')));
  const filteredVoyages = sortVoyages(voyages.filter(voyage => {
    const voyageNodeIds = [voyage.originNodeId, voyage.destinationNodeId, ...voyage.stops.map(stop => stop.nodeId)].filter((id): id is string => Boolean(id));
    const matches = contains([voyage.title, voyage.provider, voyage.projectName, voyage.destinationLabel, ...voyage.stops.flatMap(stop => [stop.nodeLabel, stop.serviceLabel, stop.method, ...(stop.methods ?? [])])], query);
    return matches && (filter === 'all' || (filter === 'online' ? voyageNodeIds.some(id => visibleNodeIds.includes(id))
      : !voyage.stops.length || voyage.status !== 'active' || voyage.stops.some(stop => !stop.resolved || stop.status !== 'ok')));
  }));
  const visibleVoyageIds = filteredVoyages.map(voyage => voyage.id);
  // A voyage search must keep its origin, stops and destination on screen even when
  // no device/service card matches the same text in the side panel.
  const sceneNodeIds = useMemo(() => [...new Set([...visibleNodeIds, ...voyageNodeIds(filteredVoyages)])], [visibleNodeIds, filteredVoyages]);

  const metrics = [
    { label: '已发现设备', english: 'DISCOVERED DEVICES', value: nodeKnown ? nodes.length : '—', unit: nodeKnown ? '个候选' : '范围未知', icon: Server, tone: 'green', detail: nodeKnown ? `${onlineNodes} 个探活在线${unknownNodes ? ` · ${unknownNodes} 个未知` : ''}` : '等待设备目录与探活证据', context: null, note: '包括配置种子与地址簿发现的候选设备；读取成功的设备申报与探活在线分别核验' },
    { label: '可用服务部署', english: 'SERVICE DEPLOYMENTS', value: catalogKnown ? healthyServices : '—', unit: catalogKnown ? catalogCached ? '个可用记录（缓存）' : '个观测可用' : '未核验', icon: Boxes, tone: 'blue', detail: catalogKnown ? `${services.length} 个可见部署 · ${services.filter(service => service.status === 'unknown' || !service.observedAt).length} 个健康未核验` : '服务目录与健康均未核验', context: catalogContext, note: '只有读取到有效 manifest 或可见服务记录后才统计；不可达不记为空库。可用数只计 up 且带观测时间的记录，不证明每个方法已实测' },
    { label: '能力部署', english: 'METHOD INSTANCES', value: catalogKnown ? methods.length : '—', unit: catalogKnown ? '个 Method 实例' : '未核验', icon: Code2, tone: 'purple', detail: catalogKnown ? `${skillInventoryLabel} · 独立种类未核验` : 'Method 与 Skill 目录均未核验', context: `${skillsPartial ? '部分/缓存，Skills 未完整核验。' : ''}${catalogContext}`, note: '只计已读目录中的部署记录；技能失败保留可见缓存，未读或部分结果不能作为完整总量。完整输入输出契约未核验，不按同名盲目合并独立能力' },
    { label: '业务工作单', english: 'VISIBLE WORK ORDERS', value: workKnown ? jobs.length : '—', unit: workKnown ? '个可见 Job' : '未核验', icon: FileCheck2, tone: 'amber', detail: workKnown ? `${attempts} 次 Attempt · ${jobs.filter(job => job.status === 'running').length} 个执行中` : 'Job 列表未核验，不能认定为零', context: workContext, note: '只在实际取得有效工作单列表或可见 Job 记录后统计。事件读取成功不代表列表读取成功；失败或过期时保留上次可见列表，重试记为 Attempt' },
    { label: '会话航次', english: 'SESSION VOYAGES', value: voyageSourceKnown ? voyages.length : '—', unit: voyageSourceKnown ? '个航次' : '未接入', icon: Rocket, tone: 'cyan', detail: voyageSourceKnown ? `${voyageStats.sessions} 普通会话 · ${voyageStats.acp} ACP · ${voyageStats.withStops} 个含停靠 · ${voyageStats.mcpCalls} 次 MCP` : '本地会话来源未接入', context: voyageContext, note: '每个航次对应一次本机会话或 ACP 工作单。起点为项目目录；停靠点只来自结构化 DreamMate MCP 工具调用中显式给出的 node/service_id，脚本内嵌调用不解析。每 3 分钟刷新周期重演一次起航，位置为视觉示意，不代表执行时长或成功率' },
    { label: '全网调用量', english: 'INVOCATION LEDGER', value: '—', unit: '未支持', icon: Activity, tone: 'muted', detail: '当前没有统一全网调用台账', context: null, note: '近期事件、会话或目录读取均不计为全网调用总量' },
  ];

  const renderNode = (node: NodeView) => <button className={`entity-card node-card ${selection?.id === node.id ? 'selected' : ''}`} key={node.id} onClick={() => select({ type: 'node', id: node.id })}><div className="item-topline"><span className={`entity-icon ${nodeBadge(node).tone}`}><Server size={17} /></span><Badge tone={nodeBadge(node).tone}>{nodeBadge(node).label}</Badge></div><h3>{node.name}<ChevronRight size={15} /></h3><p className="mono truncate">{displayNetworkEndpoint(node.address, '设备地址已隐藏')}</p><div className="entity-meta"><span>{node.platform || '平台未知'} · {formatNodeStorage(node)}</span><span>{nodeCatalogKnown(node) ? `${services.filter(service => service.nodeId === node.id).length} 个可见服务` : '目录未核验'}</span></div></button>;
  const renderService = (service: ServiceView) => <button className="entity-card capability-card" key={service.id} onClick={() => select({ type: 'service', id: service.id })}><div className="item-topline"><span className="entity-icon blue"><Box size={17} /></span><Badge tone={serviceBadge(service).tone}>{serviceBadge(service).label}</Badge></div><h3>{service.name}<ChevronRight size={15} /></h3><p className="line-clamp">{service.description || '来源未提供服务描述'}</p><div className="entity-meta"><span>{nodes.find(node => node.id === service.nodeId)?.name ?? '未匹配设备'}</span><span>{service.methods.length} 可见方法 · {serviceSkillLabel(service)}</span></div></button>;
  const renderJob = (job: JobView, index: number) => <button className="job-card entity-card" key={job.id} onClick={() => select({ type: 'job', id: job.id })}><div className="job-top"><span className="job-number">WO / {String(index + 1).padStart(3, '0')}</span><Badge tone={jobTone(job.status)}>{workText[job.status]}</Badge></div><h3>{job.title}<ChevronRight size={15} /></h3><div className="job-attempts">{job.attempts.slice(0, 3).map(attempt => <span className={`attempt-pip ${jobTone(attempt.status)}`} key={attempt.id} title={`${attempt.agent ?? '未知角色'} · ${workText[attempt.status]}`}><Terminal size={11} /></span>)}<span>{job.attempts.length} 次尝试</span></div><div className="entity-meta"><span>{triggerText[job.trigger]}触发 · {job.acceptance || '接受状态未知'}</span><span>{time(job.updatedAt)}</span></div></button>;
  const renderVoyage = (voyage: VoyageView, index: number) => <button className="voyage-card entity-card" key={voyage.id} onClick={() => select({ type: 'voyage', id: voyage.id })}>
    <div className="item-topline"><span className={`entity-icon ${voyage.kind === 'acp' ? 'violet' : 'blue'}`}><Rocket size={17} /></span><Badge tone={voyage.status === 'active' ? 'green' : voyage.status === 'ended' ? 'muted' : 'amber'}>{voyage.status === 'active' ? '航行中' : voyage.status === 'ended' ? '已停靠' : '状态未知'}</Badge></div>
    <h3>{voyage.title}<ChevronRight size={15} /></h3>
    <p className="voyage-route">{voyage.stops.length
      ? <><span>{voyage.projectName}</span><ArrowRight size={12} /><span>{voyage.destinationLabel}</span></>
      : <span>未离港 · 停在项目起点</span>}</p>
    <div className="entity-meta"><span>{voyageKindLabel(voyage.kind)} · {voyage.provider} · 航次 {String(index + 1).padStart(2, '0')}</span><span>{voyage.stops.length} 停靠 · {voyage.mcpCalls} 次 MCP</span></div>
  </button>;

  const renderDetails = () => {
    if (selectedSkill && selection?.type === 'skill') return <Suspense fallback={<p className="skill-document-status" role="status">正在载入文档阅读器…</p>}><SkillDocument key={JSON.stringify([mode, selection.serviceId, selectedSkill.id, selectedSkill.revision])} mode={mode} serviceId={selection.serviceId} skill={selectedSkill} onRefresh={refreshNow} /></Suspense>;
    if (selectedNode) return <><div className="detail-heading"><span className="entity-icon large green"><Server size={22} /></span><Badge tone={sourceTone(selectedNode.status)}>{coverageText[selectedNode.status]}</Badge><h3>{selectedNode.name}</h3><p>设备 / Node</p></div><Field label="设备原生 ID" mono>{selectedNode.nativeId}</Field><Field label="地址" mono>{displayNetworkEndpoint(selectedNode.address, '设备地址已隐藏')}</Field><Field label="平台">{selectedNode.platform || '未知'}</Field><Field label="设备存储">{formatNodeStorage(selectedNode)}{nodeStorageBytes(selectedNode) === null ? ' · 等待真实存储容量上报' : ' · 球体体积与存储成正比'}</Field>{selectedNode.storage ? <Field label="存储来源">{selectedNode.storage.source === 'observer-host' ? '观察机实测' : selectedNode.storage.source === 'demo' ? '隔离演示值' : 'Node 硬件上报'} · {fullDate(selectedNode.storage.observedAt)}</Field> : <Field label="存储来源">默认显示值 · 未采集到真实存储容量</Field>}<Field label="探活结果">{nodeBadge(selectedNode).label}</Field><Field label="Agent 状态">{selectedNode.agentStatus === 'running' ? '有执行状态证据' : selectedNode.agentStatus === 'waiting' ? '有等待状态证据' : '未知 · 节点在线不证明角色空闲'}</Field><Field label="观测时间">{fullDate(selectedNode.observedAt)}</Field><Field label="设备目录">{nodeCatalogKnown(selectedNode) ? selectedNode.status === 'ok' ? '已读取可见目录' : '含缓存/部分目录' : '未核验 · 不能认定没有服务'}</Field><h4 className="section-label">服务工位 <span>{nodeCatalogKnown(selectedNode) ? services.filter(service => service.nodeId === selectedNode.id).length : '未核验'}</span></h4>{services.filter(service => service.nodeId === selectedNode.id).map(renderService)}<EvidenceList evidence={selectedNode.evidence} /></>;
    if (selectedService) return <><div className="detail-heading"><span className="entity-icon large blue"><Box size={22} /></span><Badge tone={serviceBadge(selectedService).tone}>{serviceBadge(selectedService).label}</Badge><h3>{selectedService.name}</h3><p>{selectedService.description}</p></div><Field label="服务原生 ID" mono>{selectedService.nativeId}</Field><Field label="设备">{nodes.find(node => node.id === selectedService.nodeId)?.name ?? '未匹配'}</Field><Field label="服务类型 / 分享">{selectedService.kind} / {selectedService.sharing}</Field><Field label="健康观测时间">{fullDate(selectedService.observedAt)}</Field><Field label="目录覆盖">{nodes.find(node => node.id === selectedService.nodeId)?.status === 'ok' ? '已读可见目录' : '含缓存/部分目录 · 未返回不代表零'}</Field><h4 className="section-label">Method 方法 <span>{selectedService.methods.length}</span></h4>{selectedService.methods.map((method, index) => <div className="method-item" key={`${method.name}-${index}`}><div><Code2 size={13} /><strong className="mono break">{method.name}</strong>{method.protocol && <span className="protocol">{method.protocol}</span>}</div><p>{method.description || '来源未提供描述'}</p></div>)}<h4 className="section-label">Skill 工艺卡 <span>{!selectedService.skills.length && selectedService.skillsStatus !== 'ok' ? '未核验' : `${selectedService.skills.length} 可见`}</span></h4><Field label="Skill 目录状态">{coverageText[selectedService.skillsStatus ?? 'unknown']}</Field><Field label="Skill 观测时间">{fullDate(selectedService.skillsObservedAt)}</Field>{selectedService.skillsStatus !== 'ok' && <p className="inline-coverage-note"><TriangleAlert size={12} /><span>部分/缓存，Skills 未完整核验。{selectedService.skills.length ? '以下只展示已读到的声明，可能保留上次缓存。' : '没有可见声明不代表技能总量为零。'}</span></p>}{selectedService.skills.map(skill => <button type="button" className="entity-card method-item skill-list-item" key={skill.id} onClick={() => select({ type: 'skill', id: skill.id, serviceId: selectedService.id })}><strong className="break">{skill.name}</strong><p>{skill.description.trim() || '来源未提供 Skill 概要描述。'}</p></button>)}<EvidenceList evidence={selectedService.evidence} /></>;
    if (selectedJob) return <><div className="detail-heading"><span className="entity-icon large blue"><FileCheck2 size={22} /></span><Badge tone={jobTone(selectedJob.status)}>{workText[selectedJob.status]}</Badge><h3>{selectedJob.title}</h3><p>业务工作单 / Job</p></div><Field label="原生 Job ID" mono>{selectedJob.nativeId}</Field><Field label="源状态" mono>{selectedJob.sourceStatus}</Field><Field label="业务接受">{selectedJob.acceptance || '未知 · 执行完成不代表已接受'}</Field><Field label="最终触发者">{triggerText[selectedJob.trigger]}</Field><Field label="授权 origin" mono>{selectedJob.originSessionId}</Field><Field label="更新时间">{fullDate(selectedJob.updatedAt)}</Field><h4 className="section-label">执行尝试 <span>{selectedJob.attempts.length} ATTEMPTS</span></h4>{selectedJob.attempts.map((attempt, index) => <details className="attempt-detail" key={attempt.id} open><summary><span className="attempt-index">{String(index + 1).padStart(2, '0')}</span><span>{attempt.agent ?? '未提供角色'}</span><Badge tone={jobTone(attempt.status)}>{workText[attempt.status]}</Badge><ChevronDown size={12} /></summary><div className="attempt-content"><Field label="Attempt ID" mono>{attempt.nativeId}</Field><Field label="源状态" mono>{attempt.sourceStatus}</Field><Field label="设备">{nodes.find(node => node.id === attempt.nodeId)?.name ?? '未确认关联'}</Field><Field label="开始 / 更新">{time(attempt.startedAt)} / {time(attempt.updatedAt)}</Field><div className="session-reference"><Link2 size={13} /><div><span>Session · {attempt.session ? attempt.session.confirmed ? '已确认关联' : '未确认关联' : '来源未提供'}</span>{attempt.session && <><code className="break">{attempt.session.id}</code>{attempt.session.provider && <small>{attempt.session.provider}</small>}{attempt.session.locator && <code className="break subtle">{attempt.session.locator}</code>}</>}</div></div><EvidenceList evidence={attempt.evidence} /></div></details>)}<EvidenceList evidence={selectedJob.evidence} /></>;
    if (selectedVoyage) return <>
      <div className="detail-heading"><span className={`entity-icon large ${selectedVoyage.kind === 'acp' ? 'violet' : 'blue'}`}><Rocket size={22} /></span><Badge tone={selectedVoyage.status === 'active' ? 'green' : selectedVoyage.status === 'ended' ? 'muted' : 'amber'}>{selectedVoyage.status === 'active' ? '航行中' : selectedVoyage.status === 'ended' ? '已停靠' : '状态未知'}</Badge><h3>{selectedVoyage.title}</h3><p>{voyageKindLabel(selectedVoyage.kind)} / Voyage</p></div>
      <Field label="航次 ID" mono>{selectedVoyage.id}</Field>
      <Field label="来源会话" mono>{selectedVoyage.nativeId}</Field>
      <Field label="来源" mono>{selectedVoyage.sourceId}</Field>
      <Field label="宿主 / 类型">{voyageKindLabel(selectedVoyage.kind)} · {selectedVoyage.provider}</Field>
      <Field label="项目目录">{selectedVoyage.projectName}</Field>
      <Field label="起点">{nodes.find(node => node.id === selectedVoyage.originNodeId)?.name ?? '未确认本地节点'}</Field>
      <Field label="当前终点">{selectedVoyage.stops.length ? selectedVoyage.destinationLabel : selectedVoyage.kind === 'acp' ? '授权 origin（无执行尝试目标）' : '项目起点（未识别到 MCP 停靠）'}</Field>
      <Field label="开始 / 更新">{fullDate(selectedVoyage.startedAt)} / {fullDate(selectedVoyage.updatedAt)}</Field>
      <Field label="MCP 停靠">{selectedVoyage.stops.length} 个停靠点 · {selectedVoyage.mcpCalls} 次工具调用</Field>
      <h4 className="section-label">航迹停靠 <span>{selectedVoyage.stops.length} STOPS</span></h4>
      {selectedVoyage.stops.length ? selectedVoyage.stops.map((stop, index) => <div className="voyage-stop" key={stop.id}>
        <span className="voyage-stop-index">{String(index + 1).padStart(2, '0')}</span>
        <div><strong>{stop.nodeLabel ?? '未确认设备'}{stop.serviceLabel ? ` · ${stop.serviceLabel}` : ''}</strong>
          <p>{stop.methods?.length ? stop.methods.join(' · ') : stop.method ?? stop.toolName ?? 'MCP 调用'}</p>
          <small>{fullDate(stop.at)} · {stop.calls} 次调用 · {stop.status === 'ok' ? '结果成功' : stop.status === 'error' ? '结果失败' : '结果未知'}{stop.resolved ? '' : ' · 目标未在当前目录中确认'}</small></div>
      </div>) : <p className="inline-coverage-note">本航次没有可识别的结构化 MCP 停靠点，飞船停在项目起点；这不代表没有工具调用。脚本内嵌的 MCP 调用不解析，避免猜测目标。</p>}
      <p className="inline-coverage-note">航迹位置是视觉示意；每 {Math.round(snapshotRefreshInterval(snapshot?.refreshIntervalMs) / 60_000)} 分钟刷新后重演起航。停靠只表示会话中出现带显式目标的 MCP 调用，不代表服务执行成功或业务接受。</p>
      <EvidenceList evidence={selectedVoyage.evidence} />
    </>;
    if (selectedEvent) return <><div className="detail-heading"><span className="entity-icon large blue"><Activity size={22} /></span><Badge tone={jobTone(selectedEvent.status)}>{workText[selectedEvent.status]}</Badge><h3>{selectedEvent.title}</h3><p>观察事件 / Event</p></div><Field label="原生类型" mono>{selectedEvent.type}</Field><Field label="事件 ID" mono>{selectedEvent.id}</Field><Field label="来源 / sequence" mono>{selectedEvent.sourceId} / {selectedEvent.sequence ?? '未提供'}</Field><Field label="发生时间">{fullDate(selectedEvent.occurredAt)}</Field><Field label="观测时间">{fullDate(selectedEvent.observedAt)}</Field><Field label="协议">{selectedEvent.protocol || '未知'}</Field><Field label="因果关系">{selectedEvent.causalConfirmed ? '来源提供了明确因果证据' : '未确认 · 不推测设备间的接力'}</Field>{selectedEvent.nodeId && <Field label="关联设备">{nodes.find(node => node.id === selectedEvent.nodeId)?.name ?? selectedEvent.nodeId}</Field>}{selectedEvent.jobId && <Field label="Job 引用" mono>{selectedEvent.jobId}</Field>}{selectedEvent.attemptId && <Field label="Attempt 引用" mono>{selectedEvent.attemptId}</Field>}{selectedEvent.sessionId && <Field label="Session 引用" mono>{selectedEvent.sessionId}</Field>}<EvidenceList evidence={selectedEvent.evidence} /></>;
    return <EmptyState title="该条记录已不在当前快照中" detail="返回列表查看当前可见记录。" />;
  };

  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await sceneRef.current?.requestFullscreen(); setNotice(null); } catch { setNotice('浏览器未允许全屏，可使用窗口最大化继续查看。'); } };

  const activeNode = nodes.find(node => node.id === activeNodeId);
  const baseLots = useMemo(() => snapshot && activeNodeId ? buildBaseLots(snapshot, activeNodeId) : [], [snapshot, activeNodeId]);
  const currentLot = selectedLot ? baseLots.find(lot => lot.id === selectedLot.id) ?? null : null;
  useEffect(() => {
    if (!snapshot) return;
    if (activeNodeId && !activeNode) {
      setActiveNodeId(null); setSelectedLot(null); setInsideBuilding(false); setSelection(null); setRightOpen(false);
      setNotice('当前设备已不在最新快照中，已返回能力宇宙。');
    } else if (selectedLot && !currentLot) {
      setSelectedLot(null); setInsideBuilding(false); setRightOpen(false);
      setNotice('该建筑已不在最新目录中，已返回基地。');
    }
  }, [snapshot, activeNodeId, activeNode, selectedLot, currentLot]);
  const project = snapshot?.projects?.find(item => item.id === currentLot?.projectId);
  const enterNode = (id: string) => { setActiveNodeId(id); setSelection({ type: 'node', id }); setSelectedLot(null); setInsideBuilding(false); setRightOpen(false); };
  const selectLot = (lot: BaseLot) => { setSelectedLot(lot); setSelection(null); setRightOpen(true); if (window.innerWidth < 900 || displayMode) setLeftOpen(false); };
  const backToUniverse = () => { setActiveNodeId(null); setSelectedLot(null); setInsideBuilding(false); setSelection(null); setRightOpen(false); };
  const scopeName = insideBuilding && currentLot ? currentLot.name : activeNode?.name ?? '我们的能力宇宙';
  const renderLot = () => currentLot && <>
    <div className="detail-heading"><span className="eyebrow">{({ service: 'SERVICE FACTORY', academy: 'SKILL ACADEMY', agents: 'AGENT RESIDENCE', project: 'PROJECT WORKSHOP' })[currentLot.type]}</span><h3>{currentLot.name}</h3><Badge tone={currentLot.placeholder ? 'amber' : sourceTone(currentLot.status)}>{currentLot.placeholder ? '目录待接入 · 占位地块' : `建设等级 L${currentLot.grade}`}</Badge></div>
    {!insideBuilding && <button className="button primary-action" onClick={() => setInsideBuilding(true)}><Box size={15} />进入建筑观察<ArrowRight size={15} /></button>}
    <Field label="建筑规则">统一占地与高度，积累由材质、灯带和附件表现。</Field>
    {currentLot.placeholder ? <EmptyState title="项目、会话与产物待接入" detail="这是接口预留地块，不代表发现了一个真实项目。真实数量、参与占比和活动状态均未核验。" /> : currentLot.type === 'project' ? <><Field label="可见会话">{project?.sessionCount ?? '未核验'}</Field>{project?.storage && <ProjectStorageDetails rows={project.storage.filter(row => row.nodeId === currentLot.nodeId)} />}<Field label="项目覆盖">{coverageText[project?.status ?? 'unknown']}</Field><Field label="观测时间">{fullDate(project?.observedAt)}</Field><h4 className="section-label">会话宿主构成</h4>{project && projectProviderShares(project).length ? <><div className="provider-shares">{projectProviderShares(project).map((share, index) => <div className="provider-share" key={share.name}><div><i style={{ background: share.name === '未归属' ? '#8293a4' : ['#5ce0df', '#ffb65d', '#a79bff', '#82d497'][index % 4] }} /><strong>{share.name}</strong><span>{share.count} · {share.percent.toFixed(0)}%</span></div><div className="share-track"><i style={{ width: `${share.percent}%`, background: share.name === '未归属' ? '#8293a4' : ['#5ce0df', '#ffb65d', '#a79bff', '#82d497'][index % 4] }} /></div></div>)}</div><p className="inline-coverage-note">按可见会话宿主归属统计；不代表工作质量、耗时或当前在线人数。人物仅为比例示意。</p></> : <p className="inline-coverage-note">尚无可核验的会话宿主归属，不生成参与占比。</p>}{project && <EvidenceList evidence={project.evidence} />}</> : currentLot.type === 'academy' ? <><Field label="可见技能声明">{currentLot.count ?? '未核验'}</Field><p className="inline-coverage-note">同一技能在不同服务中可能重复部署；可见声明不是去重后的独立技能总量。</p>{services.filter(service => service.nodeId === currentLot.nodeId && (service.skills.length || service.skillsStatus !== 'ok')).map(service => <div className="method-item" key={service.id}><strong>{service.name}</strong><p>{serviceSkillLabel(service)} · {coverageText[service.skillsStatus ?? 'unknown']}</p><div className="skill-chips">{service.skills.slice(0, 18).map(skill => <span key={skill.id}>{skill.name}</span>)}{service.skills.length > 18 && <span>+{service.skills.length - 18}</span>}</div></div>)}</> : currentLot.type === 'agents' ? <><Field label="已申报智能体运行时">{currentLot.count ?? '未核验'}</Field><p className="inline-coverage-note">目录中的运行时声明不等于常驻角色数量，也不证明角色正在执行。</p>{services.filter(service => service.nodeId === currentLot.nodeId && ['agent_runtime', 'agent'].includes(service.kind)).map(renderService)}</> : <>{services.filter(service => service.id === currentLot.serviceId).map(service => <div key={service.id}><Field label="健康观测">{serviceBadge(service).label}</Field><Field label="可见方法">{service.methods.length}</Field><Field label="可见 Skill">{serviceSkillLabel(service)}</Field><p className="inline-coverage-note">{service.description || '来源未提供描述'}</p><button className="button" onClick={() => select({ type: 'service', id: service.id })}>查看完整目录与证据<ArrowRight size={14} /></button><EvidenceList evidence={service.evidence} /></div>)}</>}
  </>;
  const panelLabels: Record<Panel, string> = { overview: '能力概览', jobs: '业务工作单', nodes: '设备星球', capabilities: '能力目录', sources: '数据来源', events: '观察事件', voyages: '会话航次' };
  const directoryTabs = [['overview', '概览'], ['nodes', '设备'], ['capabilities', '能力'], ['jobs', '工作'], ['voyages', '航次'], ['events', '事件']] as const;
  const panelCounts: Partial<Record<Panel, number | string>> = { nodes: nodeKnown ? filteredNodes.length : '—', capabilities: catalogKnown ? filteredServices.length : '—', jobs: workKnown ? filteredJobs.length : '—', voyages: voyageSourceKnown ? filteredVoyages.length : '—', events: filteredEvents.length };

  const renderOverview = () => <>
    <p className="list-context">完整快照口径 · 不随当前搜索筛选改变</p>
    <div className="metric-grid">{metrics.map(metric => <article className={`metric-card metric-${metric.tone}`} key={metric.label} title={metric.note}><div className="metric-top"><span>{metric.label}</span><metric.icon size={15} /></div><div className="metric-value">{metric.value}<span>{metric.unit}</span></div><p className="metric-detail">{metric.detail}</p>{metric.context && <p className="metric-context">{metric.context}</p>}<details><summary>统计口径</summary><p>{metric.note}</p></details></article>)}</div>
    <button className="button" onClick={() => setSourceDrawer(true)}>来源与覆盖边界<ArrowRight size={14} /></button>
  </>;

  const renderDirectory = () => panel === 'nodes' ? <><p className="list-context">等距设备环 · 星球体积 ∝ 设备存储 · 未采集存储统一默认 128G</p>{filteredNodes.map(renderNode)}{!filteredNodes.length && <EmptyState title="没有匹配的设备" detail="搜索与状态筛选只改变当前可见范围。" />}</> : panel === 'capabilities' ? <><p className="list-context">{catalogContext} · 按部署实例浏览</p>{filteredServices.map(renderService)}{!filteredServices.length && <EmptyState title={catalogKnown ? '没有匹配的可见服务' : '能力目录尚未核验'} detail="来源不可用不能认定没有能力。" />}</> : panel === 'jobs' ? <><p className="list-context">{workContext}</p>{filteredJobs.map(renderJob)}{!filteredJobs.length && <EmptyState title={workKnown ? '当前可见列表中没有工作单' : '工作单列表尚未核验'} detail="仅成功读取明确授权的工作单列表后统计；事件空页不证明没有工作。" />}</> : panel === 'voyages' ? <><p className="list-context">{voyageContext} · 每个刷新周期重演一次起航</p>{filteredVoyages.map(renderVoyage)}{!filteredVoyages.length && <EmptyState icon={<Rocket size={26} />} title={voyageSourceKnown ? '当前可见范围内没有航次' : '本地会话来源未接入'} detail="在配置中启用 sessions 来源，或切换演示模式查看航迹；未接入不代表本机没有会话。" />}</> : panel === 'events' ? <><p className="list-context">来源可见历史 · 非全网调用台账</p>{filteredEvents.slice(0, 50).map(event => <button className="entity-card event-card" key={event.id} onClick={() => select({ type: 'event', id: event.id })}><div className="item-topline"><time>{time(event.occurredAt, true)}</time><Badge tone={jobTone(event.status)}>{workText[event.status]}</Badge></div><h3>{event.title}<ChevronRight size={14} /></h3><p className="mono break">{event.type}</p></button>)}{!filteredEvents.length && <EmptyState icon={<Activity size={26} />} title="尚无匹配的观察事件" detail="星环卫星表示可见服务，真实工作活动以事件证据为准。" />}</> : panel === 'sources' ? <SourceCards sources={filteredSources} /> : renderOverview();

  const renderInspector = () => selectedLot ? renderLot() : selection ? <>{selectedNode && <><DeviceInfoDetails node={selectedNode} /><NodeContentsDetails snapshot={snapshot!} nodeId={selectedNode.id} /><button className="button primary-action" onClick={() => enterNode(selectedNode.id)}><ArrowRight size={15} />进入星球基地</button></>}{renderDetails()}</> : <EmptyState icon={<Boxes size={26} />} title="尚未选择对象" detail="在左侧目录中选择设备、服务、工作单、航次或事件，或直接在星空中点击星球。" />;

  return <div className={`cockpit-shell ${mode === 'demo' ? 'demo-mode' : ''} ${paused ? 'motion-paused' : ''} ${displayMode ? 'display-mode' : 'workbench-mode'}`}>
    <header className="cockpit-header">
      <div className="cockpit-heading">
        <button className="cockpit-brand" onClick={backToUniverse} aria-label="返回能力宇宙" title="DreamMate · 返回能力宇宙"><Network size={20} /><strong>DreamMate</strong></button>
        <nav className="world-breadcrumb" aria-label="当前位置"><button onClick={backToUniverse}>宇宙</button>{activeNode && <><ChevronRight size={12} /><button title={activeNode.name} onClick={() => { setInsideBuilding(false); setSelectedLot(null); setRightOpen(false); }}>{activeNode.name}</button></>}{insideBuilding && currentLot && <><ChevronRight size={12} /><span title={currentLot.name}>{currentLot.name}</span></>}</nav>
      </div>
      <div id="cockpit-search" className={`cockpit-search ${searchOpen ? 'is-open' : ''}`} onKeyDown={event => { if (event.key === 'Escape') { setSearchOpen(false); searchToggle.current?.focus(); } }}>
        <Search size={14} /><input ref={searchInput} aria-label="搜索设备、能力、工作单或航次" placeholder="搜索设备、能力、航次…" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button onClick={() => setQuery('')} aria-label="清空搜索"><X size={13} /></button>}
        <select aria-label="筛选状态" value={filter} onChange={event => setFilter(event.target.value as Filter)}><option value="all">全部状态</option><option value="online">探活在线</option><option value="attention">需要关注</option></select>
        <button className="search-dismiss" onClick={() => { setSearchOpen(false); searchToggle.current?.focus(); }} aria-label="收起搜索"><X size={15} /></button>
      </div>
      <button ref={searchToggle} className={`compact-search-toggle square-button ${searchOpen || query || filter !== 'all' ? 'active' : ''}`} onClick={() => setSearchOpen(value => !value)} aria-label={searchOpen ? '收起搜索与筛选' : '展开搜索与筛选'} aria-expanded={searchOpen} aria-controls="cockpit-search"><Search size={16} /></button>
      <div className="cockpit-command-actions">
        <button className="square-button display-entry" onClick={() => setPresentation(true)} title="进入展示模式" aria-label="进入展示模式"><Presentation size={16} /></button>
        <a className="model-gallery-link square-button" href={assetUrl('?view=models')} title="打开三维模型图鉴" aria-label="打开三维模型图鉴"><Box size={16} /></a>
        {STANDALONE_DEMO ? <span className="mode-switch standalone-demo-badge" aria-label="数据模式"><FlaskConical size={13} />演示</span> : <div className="mode-switch" aria-label="数据模式"><button className={mode === 'live' ? 'active' : ''} onClick={() => switchMode('live')}><Radio size={13} />实况</button><button className={mode === 'demo' ? 'active demo-active' : ''} onClick={() => switchMode('demo')}><FlaskConical size={13} />演示</button></div>}
        <button className="square-button" disabled={loading} onClick={refreshNow} aria-label="手动刷新来源" title="手动刷新来源"><RefreshCw size={16} className={loading ? 'spinning' : ''} /></button>
        <button className="header-fullscreen square-button" onClick={toggleFullscreen} aria-label={fullscreen ? '退出全屏' : '全屏驾驶舱'} title="全屏驾驶舱"><Maximize2 size={16} /></button>
      </div>
      <div className="cockpit-header-status">
        <span className="readonly" title="只读观察"><ShieldCheck size={11} /><span>只读观察</span></span>
        <button className={`connection-summary ${problematicSources ? 'has-issues' : ''}`} onClick={() => setSourceDrawer(true)} aria-label={snapshot ? `${healthySources}/${sources.length} 来源正常` : '等待来源'} title={snapshot ? `${healthySources}/${sources.length} 来源正常，查看来源详情` : '等待来源'}><span className="status-dot" /><span>{snapshot ? `${healthySources}/${sources.length}` : '—'}</span><span className="connection-label">来源正常</span><ChevronRight size={11} /></button>
        <CurrentTime />
      </div>
    </header>
    <main className="cockpit-world" ref={sceneRef}>
      <StageViewport scope={`${mode}:${activeNodeId ?? 'universe'}:${insideBuilding ? currentLot?.id : 'base'}`}><Suspense fallback={<div className="scene-loading"><LoaderCircle size={25} className="spinning" /><span>正在载入三维空间…</span></div>}>{snapshot && nodes.length ? insideBuilding && currentLot ? <BuildingInterior lot={currentLot} project={project} /> : activeNode ? <BaseMap lots={baseLots} selectedId={currentLot?.id} onSelect={selectLot} /> : <UniverseScene snapshot={snapshot} selection={selection} onSelect={select} visibleNodeIds={sceneNodeIds} showConnections={showConnections} showVoyages={showVoyages} visibleVoyageIds={visibleVoyageIds} resetKey={resetKey} onEnterNode={enterNode} paused={paused} navAction={navigationAction} presentation={displayMode} /> : <div className="scene-empty"><EmptyState icon={loading ? <LoaderCircle className="spinning" size={32} /> : <Network size={32} />} title={loading ? '正在读取能力世界' : '尚无可见设备'} detail={error ?? '接入明确的 Node 来源，或切换演示预览空间。'} />{!loading && <button className="button" onClick={() => switchMode('demo')}>打开演示宇宙</button>}</div>}</Suspense></StageViewport>
      <div className="world-topline"><div><span className="eyebrow">{insideBuilding ? 'BUILDING OBSERVATORY' : activeNode ? 'PLANETARY BASE' : 'DISTRIBUTED INTELLIGENCE NETWORK'}</span><h1>{scopeName}</h1></div><div className="topline-actions">{displayMode && mode === 'demo' && <span className="display-badge"><FlaskConical size={12} />演示场景</span>}{displayMode && !IS_EMBEDDED && <button className="display-exit" onClick={() => setPresentation(false)} title="退出展示模式"><Minimize2 size={13} />退出展示</button>}<div className="scene-tools"><button onClick={toggleFullscreen} aria-label={fullscreen ? '退出全屏沙盘' : '全屏沙盘'} title="切换全屏沙盘"><Maximize2 size={16} /></button><button className={showConnections ? 'enabled' : ''} onClick={() => setShowConnections(value => !value)} aria-label="切换设备互联与协作链路" title="本机连接路径、对等互联示意与有证据的协作链路"><GitBranch size={16} /></button><button className={showVoyages ? 'enabled' : ''} onClick={() => setShowVoyages(value => !value)} aria-label="切换会话航次与小飞船" title="会话航次：项目起点 → MCP 停靠点 → 最后停靠点；每个刷新周期重演起航"><Rocket size={16} /></button><button className={paused ? 'enabled' : ''} onClick={() => setPaused(value => !value)} aria-label={paused ? '恢复示意巡航' : '暂停示意巡航'} title="暂停 / 恢复示意巡航"><Pause size={16} /></button><button onClick={() => setResetKey(value => value + 1)} aria-label="复位宇宙视角" title="复位视角"><RotateCcw size={16} /></button></div></div></div>
      {!activeNode && snapshot && nodes.length > 0 && <div className="universe-navigation" role="toolbar" aria-label="星空导航">
        <span>拖动旋转 · 滚轮 / 双指缩放</span>
        <button onClick={() => navigateUniverse('zoom-out')} aria-label="拉远星空" title="拉远：星系可缩至光点"><Minus size={16} /></button>
        <button onClick={() => navigateUniverse('zoom-in')} aria-label="拉近星空" title="拉近星体"><Plus size={16} /></button>
        <button onClick={() => navigateUniverse('focus-selected')} aria-label="聚焦星球" title="聚焦所选设备，未选中时显示全部星系"><Focus size={16} /></button>
        <button onClick={() => navigateUniverse('focus-service-system')} aria-label="服务太阳系" title="跟随当前服务域名对应的小太阳系"><Sun size={16} /></button>
        <button onClick={() => navigateUniverse('overview')} aria-label="星系总览" title="返回所有小星系与 DERP 总中心"><Orbit size={16} /></button>
      </div>}
      {((mode === 'demo' && !displayMode) || error || notice) && <div className={`world-notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{mode === 'demo' && !displayMode && <span><FlaskConical size={13} /><strong>演示世界</strong> · 设备、项目、会话和事件均为示例</span>}{error && <span><TriangleAlert size={13} />读取失败：{error}{snapshot ? ' · 保留旧快照' : ''}</span>}{notice && <span>{notice}<button onClick={() => setNotice(null)} aria-label="关闭提示"><X size={13} /></button></span>}</div>}
      {!displayMode && !leftOpen && <button className={`hud-toggle hud-toggle-left ${leftOpen ? 'open' : ''}`} onClick={() => setLeftOpen(value => !value)} aria-label={leftOpen ? '收起观察台' : '展开观察台'} aria-expanded={leftOpen}><Activity size={18} /><span>观察台</span>{leftOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}</button>}
      {!displayMode && !rightOpen && (selection || selectedLot) && <button className={`hud-toggle hud-toggle-right ${rightOpen ? 'open' : ''}`} onClick={() => setRightOpen(value => !value)} aria-label={rightOpen ? '收起对象详情 HUD' : '展开对象详情 HUD'} aria-expanded={rightOpen}>{rightOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}<span>对象详情</span><Boxes size={18} /></button>}
      {displayMode && (leftOpen || rightOpen) && <div className="hud-scrim" aria-hidden="true" onClick={() => { setLeftOpen(false); setRightOpen(false); }} />}
      {leftOpen && <aside className="cockpit-hud hud-left" aria-label="观察台目录"><div className="hud-header"><div><span className="eyebrow">OBSERVATORY</span><h2>{panelLabels[panel]}</h2></div><button className="icon-button" onClick={() => setLeftOpen(false)} aria-label="关闭观察台"><X size={18} /></button></div><div className="inspector-tabs directory-tabs">{directoryTabs.map(([value, label]) => <button key={value} title={`${label}${panelCounts[value] !== undefined ? ` · ${panelCounts[value]}` : ''}`} className={panel === value ? 'active' : ''} onClick={() => setPanel(value)}>{label}</button>)}</div><div className="hud-content">{renderDirectory()}</div><div className="hud-footer"><span className={`status-dot ${problematicSources ? 'amber' : ''}`} />{sources.length ? `${healthySources}/${sources.length} 来源正常` : '等待来源'} · 只读观察</div></aside>}
      {rightOpen && <aside className="cockpit-hud hud-right" aria-label="对象详情 HUD"><div className="hud-header"><div><span className="eyebrow">OBJECT OBSERVATORY</span><h2>对象与证据</h2></div><button className="icon-button" onClick={() => setRightOpen(false)} aria-label="关闭对象详情"><X size={18} /></button></div>{(selection || selectedLot) && <button className="detail-back" onClick={() => { setSelection(null); setSelectedLot(null); setInsideBuilding(false); setRightOpen(false); if (displayMode) setLeftOpen(true); }}><ChevronLeft size={14} />返回{panelLabels[panel]}</button>}<div className="hud-content">{renderInspector()}</div><div className="hud-footer"><ShieldCheck size={12} />只观察，不调度或控制执行</div></aside>}
      <div className="world-bottomline"><div className="world-legend"><button className="world-legend-button" onClick={() => setLegendOpen(true)} aria-label="打开图例说明" aria-haspopup="dialog"><CircleHelp size={15} />图例</button></div><div className="world-directory">{activeNode && <button onClick={() => { setSelection(null); setSelectedLot(null); setInsideBuilding(false); setRightOpen(false); }}><ChevronLeft size={14} />基地</button>}<button onClick={() => openPanel('nodes')}><Server size={14} />{nodeKnown ? nodes.length : '—'} 设备</button><button onClick={() => openPanel('capabilities')}><Boxes size={14} />{catalogKnown ? services.length : '—'} 服务</button><button onClick={() => openPanel('voyages')}><Rocket size={14} />航次 <span>{voyageSourceKnown ? voyages.length : '—'}</span></button><button onClick={() => openPanel('events')}><Activity size={14} />观察事件 <span>{events.length}</span></button></div></div>
      {legendOpen && <SceneLegend snapshot={snapshot} showConnections={showConnections} onClose={() => setLegendOpen(false)} />}
    </main>
    <footer className="cockpit-footer"><span><i className={`status-dot ${error ? 'red' : ''}`} />{mode === 'demo' ? '独立演示数据' : '明确配置的可见来源'}<button onClick={() => setSourceDrawer(true)}>覆盖说明<ArrowUpRight size={11} /></button></span><span><SnapshotTime generatedAt={snapshot?.generatedAt} /><b>16:9 固定沙盘</b></span></footer>
    {sourceDrawer && <div className="drawer-backdrop" onClick={() => setSourceDrawer(false)}><aside className="coverage-drawer" role="dialog" aria-modal="true" aria-labelledby="coverage-title" onClick={event => event.stopPropagation()}><div className="drawer-header"><div className="eyebrow">SOURCE & COVERAGE</div><button className="icon-button" autoFocus onClick={() => setSourceDrawer(false)} aria-label="关闭来源详情"><X size={20} /></button><h2 id="coverage-title">画面覆盖到哪里</h2><p>{mode === 'demo' ? '当前是完全独立的演示数据集。' : '来源状态描述采集结果；不可见、失败与未支持都不代表零条记录。'}</p></div><div className="drawer-content"><div className="coverage-summary"><div><strong>{sources.length}</strong><span>可见来源</span></div><div><strong>{healthySources}</strong><span>连接正常</span></div><div><strong>{problematicSources}</strong><span>需关注 / 未覆盖</span></div></div><div className="coverage-note"><Clock3 size={15} /><span>快照生成于 {fullDate(snapshot?.generatedAt)}。前台每 {snapshotRefreshInterval(snapshot?.refreshIntervalMs) / 60_000} 分钟重新读取，后台暂停自动刷新；来源以各自的观测时间为准。</span></div><SourceCards sources={sources} /><h3 className="limitations-heading">当前观察边界</h3>{(snapshot?.limitations.length ? snapshot.limitations : ['尚未获得有效快照，来源范围与新鲜度未知。']).map((limitation, index) => <div className="limitation" key={index}><span>{String(index + 1).padStart(2, '0')}</span><p>{limitation}</p></div>)}</div><div className="drawer-footer"><ShieldCheck size={15} /><span>观察端离线不会阻断现网执行。</span></div></aside></div>}
  </div>;
}
