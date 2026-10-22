import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBaseLots, projectGrade, projectProviderShares, summarizeNode } from '../src/read-model/universe';
import { createDemoSnapshot } from '../src/observer/demo';

test('unconnected node and project catalogs stay unknown rather than empty', () => {
  const snapshot = createDemoSnapshot();
  const node = snapshot.nodes[0];
  node.catalogAvailable = false;
  snapshot.services = snapshot.services.filter(service => service.nodeId !== node.id);
  delete snapshot.projects;
  assert.deepEqual(summarizeNode(snapshot, node.id), { services: null, methods: null, skills: null, projects: null, agentRuntimes: null, catalogKnown: false, partial: false });
  const placeholder = buildBaseLots(snapshot, node.id).find(lot => lot.type === 'project');
  assert.equal(placeholder?.placeholder, true);
  assert.equal(placeholder?.count, null);
  assert.equal(placeholder?.projectId, undefined);
});

test('cross-device project uses one identity, and tiers depend on session ranges rather than shape', () => {
  const snapshot = createDemoSnapshot();
  const project = snapshot.projects!.find(p => p.nodeIds.length > 1)!;
  const projections = project.nodeIds.map(id => buildBaseLots(snapshot, id).find(lot => lot.projectId === project.id)!);
  assert.equal(new Set(projections.map(lot => lot.projectId)).size, 1);
  assert.ok(projections.every(lot => lot.grade === 3));
  assert.deepEqual([projectGrade(null), projectGrade(0), projectGrade(9), projectGrade(10), projectGrade(49), projectGrade(50)], [1, 1, 1, 2, 2, 3]);
});

test('provider shares preserve unattributed sessions and never manufacture agent contribution', () => {
  const project = createDemoSnapshot().projects!.find(p => p.status === 'partial')!;
  const shares = projectProviderShares(project);
  assert.equal(shares.find(row => row.name === '未归属')?.count, 6);
  assert.ok(Math.abs(shares.reduce((sum, row) => sum + row.share, 0) - 1) < 1e-10);
  assert.deepEqual(projectProviderShares({ ...project, sessionCount: null, providers: [] }), []);
  const sanitized = projectProviderShares({ ...project, sessionCount: 2, providers: [{ name: 'Codex', count: 4 }, { name: 'Claude', count: -5 }] });
  assert.deepEqual(sanitized, [{ name: 'Codex', count: 4, share: 1, percent: 100 }]);
});

test('base lots keep registered services even when they exceed the former three-service visual cap', () => {
  const snapshot = createDemoSnapshot();
  const first = snapshot.services[0];
  snapshot.services.push(...Array.from({ length: 12 }, (_, i) => ({ ...first, id: `extra:${i}` })));
  const lots = buildBaseLots(snapshot, first.nodeId);
  assert.equal(lots.filter(lot => lot.type === 'service').length, snapshot.services.filter(s => s.nodeId === first.nodeId).length);
});
