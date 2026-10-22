import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotFacts, coverageLabels, workStatusLabels } from '../src/read-model/presentation';
import type { ObserverSnapshot } from '../src/read-model/types';

const empty: ObserverSnapshot = { version: 1, mode: 'live', generatedAt: '2026-10-22T09:00:00.000Z', refreshIntervalMs: 15000, nodes: [], services: [], jobs: [], events: [], sources: [], limitations: [] };

test('unconnected snapshot does not invent zero-valued global interaction totals', () => {
  const facts = snapshotFacts(empty);
  assert.equal(facts.jobStatusCoverageKnown, false);
  assert.equal(facts.totalProtocolCalls, null);
  assert.equal(facts.totalSessions, null);
  assert.equal(facts.totalTurns, null);
});

test('address book and stale evidence are not counted as verified online nodes', () => {
  const node = { id: 'n', nativeId: 'n', name: 'N', address: '', platform: '', online: true, status: 'stale' as const, observedAt: null, serviceIds: [], agentStatus: 'unknown' as const, evidence: [] };
  const facts = snapshotFacts({ ...empty, nodes: [node, { ...node, id: 'n2', online: null, status: 'unknown' }, { ...node, id: 'n3', status: 'ok' }] });
  assert.equal(facts.discoveredNodes, 3);
  assert.equal(facts.verifiedOnlineNodes, 1);
  assert.equal(facts.unknownNodes, 1);
});

test('service availability requires timestamp evidence and unknown remains unknown', () => {
  const service = { id: 's', nativeId: 's', nodeId: 'n', name: 'S', description: '', kind: 'other', status: 'up' as const, observedAt: null, methods: [], skills: [], sharing: 'network', evidence: [] };
  const facts = snapshotFacts({ ...empty, services: [service, { ...service, id: 's2', observedAt: empty.generatedAt }] });
  assert.equal(facts.serviceInstances, 2);
  assert.equal(facts.healthyServices, 1);
  assert.notEqual(coverageLabels.unknown, coverageLabels.ok);
  assert.notEqual(workStatusLabels.canceled, workStatusLabels.failed);
  assert.notEqual(workStatusLabels.rejected, workStatusLabels.failed);
});
