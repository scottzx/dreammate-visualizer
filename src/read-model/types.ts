import type { Protocol, ServiceKind } from '@1agents/dreammate-network';
import type { DeviceInfoView } from './device-info';

export type DataMode = 'live' | 'demo';
export type CoverageStatus = 'ok' | 'offline' | 'unavailable' | 'forbidden' | 'unsupported' | 'partial' | 'stale' | 'unknown';
export type WorkStatus = 'queued' | 'running' | 'input_required' | 'succeeded' | 'failed' | 'canceled' | 'rejected' | 'unknown';
export interface Evidence { sourceId: string; nativeId?: string; locator?: string; observedAt: string; note?: string }
export interface SourceView { id: string; name: string; kind: 'node' | 'acp' | 'sessions' | 'artifacts'; status: CoverageStatus; scope: string; observedAt: string | null; diagnostics: string[]; jobsObservedAt?: string | null; version?: string; url?: string }
export interface NodeStorageView { totalBytes: number; observedAt: string; source: 'node-manifest' | 'observer-host' | 'demo'; status: 'observed' | 'cached' }
export interface NodeView { id: string; nativeId: string; name: string; address: string; platform: string; online: boolean | null; networkOnline?: boolean | null; catalogAvailable?: boolean; storage?: NodeStorageView; device?: DeviceInfoView; status: CoverageStatus; observedAt: string | null; serviceIds: string[]; agentStatus: 'unknown' | 'running' | 'waiting'; evidence: Evidence[] }
export interface MethodView { name: string; description: string; protocol?: Protocol }
export interface SkillView { id: string; name: string; description: string; revision?: string }
export interface ServiceView { id: string; nativeId: string; nodeId: string; name: string; description: string; kind: ServiceKind | string; status: 'up' | 'down' | 'unknown'; observedAt: string | null; methods: MethodView[]; skills: SkillView[]; skillsStatus?: CoverageStatus; skillsObservedAt?: string | null; sharing: string; evidence: Evidence[] }
export interface SessionLink { id: string; provider?: string; confirmed: boolean; locator?: string }
export interface AttemptView { id: string; nativeId: string; status: WorkStatus; sourceStatus: string; nodeId?: string; agent?: string; startedAt?: string; updatedAt: string; session?: SessionLink; evidence: Evidence[] }
export interface JobView { id: string; nativeId: string; sourceId: string; originSessionId: string; title: string; status: WorkStatus; sourceStatus: string; updatedAt: string; trigger: 'human' | 'agent' | 'automation' | 'unknown'; acceptance: string; attempts: AttemptView[]; evidence: Evidence[] }
export interface EventView { id: string; sourceId: string; sequence?: number; type: string; title: string; status: WorkStatus; occurredAt: string; observedAt: string; nodeId?: string; targetNodeId?: string; serviceId?: string; jobId?: string; attemptId?: string; sessionId?: string; protocol?: string; causalConfirmed: boolean; evidence: Evidence[] }
export interface ProjectView { id: string; name: string; nodeIds: string[]; sessionCount: number | null; providers: { name: string; count: number }[]; status: CoverageStatus; observedAt: string | null; evidence: Evidence[] }
export interface ObserverSnapshot { version: 1; mode: DataMode; layoutScope?: string; generatedAt: string; refreshIntervalMs: number; nodes: NodeView[]; services: ServiceView[]; jobs: JobView[]; events: EventView[]; sources: SourceView[]; limitations: string[]; projects?: ProjectView[] }
export interface Selection { type: 'node' | 'service' | 'job' | 'event'; id: string }
export interface FactorySceneProps { snapshot: ObserverSnapshot; selection: Selection | null; onSelect: (selection: Selection | null) => void; visibleNodeIds?: string[]; showConnections?: boolean; resetKey?: number }
