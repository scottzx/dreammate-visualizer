import type { Protocol, ServiceKind } from '@1agents/dreammate-network';
import type { NetworkTopologyView } from './network';
import type { DeviceInfoView } from './device-info';

export type DataMode = 'live' | 'demo';
export type CoverageStatus = 'ok' | 'offline' | 'unavailable' | 'forbidden' | 'unsupported' | 'partial' | 'stale' | 'unknown';
export type WorkStatus = 'queued' | 'running' | 'input_required' | 'succeeded' | 'failed' | 'canceled' | 'rejected' | 'unknown';
export interface Evidence { sourceId: string; nativeId?: string; locator?: string; observedAt: string; note?: string }
export interface SourceView { id: string; name: string; kind: 'node' | 'acp' | 'sessions' | 'artifacts' | 'projects'; status: CoverageStatus; scope: string; observedAt: string | null; diagnostics: string[]; jobsObservedAt?: string | null; version?: string; url?: string }
export interface NodeStorageView { totalBytes: number; observedAt: string; source: 'node-manifest' | 'observer-host' | 'demo'; status: 'observed' | 'cached' }
export interface NodeView { id: string; nativeId: string; name: string; address: string; platform: string; online: boolean | null; networkOnline?: boolean | null; catalogAvailable?: boolean; storage?: NodeStorageView; device?: DeviceInfoView; status: CoverageStatus; observedAt: string | null; serviceIds: string[]; agentStatus: 'unknown' | 'running' | 'waiting'; evidence: Evidence[] }
export interface MethodView { name: string; description: string; protocol?: Protocol }
export interface SkillView { id: string; name: string; description: string; revision?: string }
export interface SkillDocumentView { skillId: string; name: string; revision?: string; markdown: string }
export interface ServiceView { id: string; nativeId: string; nodeId: string; name: string; description: string; kind: ServiceKind | string; status: 'up' | 'down' | 'unknown'; observedAt: string | null; methods: MethodView[]; skills: SkillView[]; skillsStatus?: CoverageStatus; skillsObservedAt?: string | null; sharing: string; evidence: Evidence[] }
export interface SessionLink { id: string; provider?: string; confirmed: boolean; locator?: string }
export interface AttemptView { id: string; nativeId: string; status: WorkStatus; sourceStatus: string; nodeId?: string; agent?: string; startedAt?: string; updatedAt: string; session?: SessionLink; evidence: Evidence[] }
export interface JobView { id: string; nativeId: string; sourceId: string; originSessionId: string; title: string; status: WorkStatus; sourceStatus: string; updatedAt: string; trigger: 'human' | 'agent' | 'automation' | 'unknown'; acceptance: string; attempts: AttemptView[]; evidence: Evidence[] }
export interface EventView { id: string; sourceId: string; sequence?: number; type: string; title: string; status: WorkStatus; occurredAt: string; observedAt: string; nodeId?: string; targetNodeId?: string; serviceId?: string; jobId?: string; attemptId?: string; sessionId?: string; protocol?: string; causalConfirmed: boolean; evidence: Evidence[] }
export type ProjectCategory = 'business-agent' | 'perception' | 'other';
export interface ProjectStorageView {
  nodeId: string; category: ProjectCategory; bytes: number | null; status: CoverageStatus;
  observedAt: string | null; source: 'observer-directory' | 'demo'; metric: 'allocated-disk-bytes';
  path: string; note?: string;
}
export interface ProjectView { id: string; name: string; nodeIds: string[]; sessionCount: number | null; providers: { name: string; count: number }[]; status: CoverageStatus; observedAt: string | null; evidence: Evidence[]; storage?: ProjectStorageView[] }
export type VoyageKind = 'session' | 'acp';
export type VoyageStatus = 'active' | 'ended' | 'unknown';
export type VoyageStopStatus = 'ok' | 'error' | 'unknown';
/** One resolved DreamMate MCP docking inside a session; unresolved refs keep the raw label. */
export interface VoyageStopView {
  id: string; nodeId?: string; nodeLabel?: string; serviceId?: string; serviceLabel?: string;
  method?: string; methods?: string[]; toolName?: string; at: string; status: VoyageStopStatus;
  calls: number; resolved: boolean; evidence: Evidence[];
}
/** One observed session or ACP work order treated as a voyage: project dock → MCP stops → last dock. */
export interface VoyageView {
  id: string; nativeId: string; kind: VoyageKind; sourceId: string; provider: string; title: string;
  projectId?: string; projectName: string; originNodeId?: string; startedAt: string; updatedAt: string;
  status: VoyageStatus; stops: VoyageStopView[]; destinationNodeId?: string; destinationLabel: string;
  mcpCalls: number; evidence: Evidence[];
}
export interface ObserverSnapshot { version: 1; mode: DataMode; layoutScope?: string; serviceNodeId?: string; privacy?: { ipAddresses: 'hidden' }; generatedAt: string; refreshIntervalMs: number; nodes: NodeView[]; services: ServiceView[]; jobs: JobView[]; events: EventView[]; sources: SourceView[]; limitations: string[]; projects?: ProjectView[]; voyages?: VoyageView[]; network?: NetworkTopologyView }
export type Selection = { type: 'node' | 'service' | 'job' | 'event' | 'voyage'; id: string }
  | { type: 'skill'; id: string; serviceId: string };
export interface FactorySceneProps { snapshot: ObserverSnapshot; selection: Selection | null; onSelect: (selection: Selection | null) => void; visibleNodeIds?: string[]; showConnections?: boolean; resetKey?: number }
