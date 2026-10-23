import test from 'node:test';
import assert from 'node:assert/strict';
import type { EventView, ObserverSnapshot } from '../src/read-model/types';
import { createDemoSnapshot } from '../src/observer/demo';
import { createFactoryLayout, factoryConnections, isRecentFactoryEvent, resolveSkillSelection, selectionNodeIds, stableNodeHash } from '../src/view/layout';

const identityPositions = (layout: ReturnType<typeof createFactoryLayout>) =>
  [...layout.plots].map(([id, plot]) => [id, plot.x, plot.z]).sort();

test('namespaced device identities retain their plots after a reordered snapshot', () => {
  const identities = ['node:local:studio', 'node:office:studio', 'node:gpu:rack', 'node:edge:minis', '__proto__'];
  assert.deepEqual(identityPositions(createFactoryLayout(identities)), identityPositions(createFactoryLayout([...identities].reverse())));
  assert.equal(createFactoryLayout(identities).plots.size, identities.length);
});

test('filtering, temporary disappearance, and returning devices do not move reserved plots', () => {
  const original = createFactoryLayout(['source:a', 'source:b', 'source:c', 'source:d']);
  const filtered = createFactoryLayout(['source:c'], original.assignments);
  assert.deepEqual(filtered.plots.get('source:c'), original.plots.get('source:c'));
  const expanded = createFactoryLayout(['source:new', 'source:d', 'source:a', 'source:c', 'source:b'], filtered.assignments);
  for (const [id, plot] of original.plots) assert.deepEqual(expanded.plots.get(id), plot);
});

test('hash home collisions allocate distinct plots, without replacing another identity', () => {
  const identities: string[] = [];
  for (let candidate = 0; identities.length < 8; candidate += 1) {
    const identity = `source:${candidate}:same-display-name`;
    if (stableNodeHash(identity) % 6 === 2) identities.push(identity);
  }
  const layout = createFactoryLayout(identities);
  assert.equal(layout.plots.size, identities.length);
  assert.equal(new Set([...layout.plots.values()].map((plot) => `${plot.x}:${plot.z}`)).size, identities.length);
  assert.deepEqual(identityPositions(layout), identityPositions(createFactoryLayout([...identities].reverse())));
  const added = createFactoryLayout([...identities, 'new-source:same-display-name'], layout.assignments);
  for (const [id, plot] of layout.plots) assert.deepEqual(added.plots.get(id), plot);
});

test('30-device layouts have unique plots and larger sources also avoid overlaps', () => {
  const identities = Array.from({ length: 42 }, (_, index) => `source:device-${index}`);
  const layout = createFactoryLayout(identities);
  const positions = [...layout.plots.values()];
  assert.equal(new Set(positions.map((plot) => `${plot.x}:${plot.z}`)).size, identities.length);
  for (const plot of positions) {
    assert.ok(plot.x >= layout.bounds.minX && plot.x <= layout.bounds.maxX);
    assert.ok(plot.z >= layout.bounds.minZ && plot.z <= layout.bounds.maxZ);
  }
});

test('malformed persisted slots are repaired before devices can overlap', () => {
  const layout = createFactoryLayout(['a', 'b', 'c'], [{ id: 'a', slot: 2 }, { id: 'b', slot: 2 }, { id: 'c', slot: -1 }]);
  assert.equal(layout.plots.get('a')?.slot, 2);
  assert.equal(new Set([...layout.plots.values()].map((plot) => plot.slot)).size, 3);
});

const referenceTime = Date.parse('2026-10-22T08:00:00Z');
const event = (overrides: Partial<EventView> = {}): EventView => ({
  id: 'e:1', sourceId: 's:1', type: 'delegation', title: '已确认委托', status: 'running',
  occurredAt: '2026-10-22T07:59:30Z', observedAt: '2026-10-22T07:59:31Z',
  nodeId: 'a', targetNodeId: 'b', causalConfirmed: true, evidence: [], ...overrides,
});
const snapshot = (events: EventView[]): ObserverSnapshot => ({
  version: 1, mode: 'demo', generatedAt: '2026-10-22T08:00:00Z', refreshIntervalMs: 10_000,
  nodes: [], services: [], jobs: [], sources: [], limitations: [], events,
});

test('event pulse windows use the supplied snapshot clock and reject future, old, or invalid times', () => {
  assert.equal(isRecentFactoryEvent(event(), referenceTime), true);
  assert.equal(isRecentFactoryEvent(event({ occurredAt: '2026-10-22T07:58:00Z' }), referenceTime), false);
  assert.equal(isRecentFactoryEvent(event({ occurredAt: '2026-10-22T08:01:00Z' }), referenceTime), false);
  assert.equal(isRecentFactoryEvent(event({ occurredAt: 'unknown' }), referenceTime), false);
});

test('connections require explicit causal evidence and visible endpoints', () => {
  const events = [event(), event({ id: 'unconfirmed', causalConfirmed: false }), event({ id: 'missing-endpoint', targetNodeId: undefined })];
  assert.deepEqual(factoryConnections(snapshot(events), null, new Set(['a', 'b']), referenceTime).map((item) => item.id), ['e:1']);
  assert.equal(factoryConnections(snapshot(events), { type: 'event', id: 'unconfirmed' }, new Set(['a', 'b']), referenceTime).some((item) => item.id === 'unconfirmed'), false);
  assert.equal(factoryConnections(snapshot(events), null, new Set(['a']), referenceTime).length, 0);
});

test('historical links appear on selection and a selected job does not collect unrelated device links', () => {
  const historical = event({ id: 'historical', occurredAt: '2026-10-21T08:00:00Z', jobId: 'job:one' });
  const unrelated = event({ id: 'unrelated', nodeId: 'b', targetNodeId: 'c', occurredAt: '2026-10-21T08:00:00Z', jobId: 'job:two' });
  const data = snapshot([historical, unrelated]);
  const visible = new Set(['a', 'b', 'c']);
  assert.equal(factoryConnections(data, null, visible, referenceTime).length, 0);
  assert.deepEqual(factoryConnections(data, { type: 'event', id: 'historical' }, visible, referenceTime).map((item) => item.id), ['historical']);
  assert.deepEqual(factoryConnections(data, { type: 'job', id: 'job:one' }, visible, referenceTime).map((item) => item.id), ['historical']);
  assert.equal(factoryConnections(data, { type: 'node', id: 'b' }, visible, referenceTime).length, 2);
});

test('Skill selection resolves the owning service when devices share the same Skill ID and name', () => {
  const data = createDemoSnapshot(), template = data.services[0];
  data.services = [
    { ...template, id: 'service:mac:skills', nodeId: data.nodes[0].id, skills: [{ id: 'shared-skill', name: '相同名称', description: 'Mac 上的技能概要。' }] },
    { ...template, id: 'service:pc:skills', nodeId: data.nodes[1].id, skills: [{ id: 'shared-skill', name: '相同名称', description: 'PC 上的技能概要。' }] },
  ];
  const selection = { type: 'skill' as const, id: 'shared-skill', serviceId: 'service:pc:skills' };
  assert.equal(resolveSkillSelection(data, selection)?.skill.description, 'PC 上的技能概要。');
  assert.deepEqual([...selectionNodeIds(data, selection)], [data.nodes[1].id]);
  data.services.reverse();
  assert.equal(resolveSkillSelection(data, selection)?.skill.description, 'PC 上的技能概要。', 'snapshot order cannot switch the selected Skill');
  assert.deepEqual([...selectionNodeIds(data, { ...selection, serviceId: 'service:mac:skills' })], [data.nodes[0].id]);

  data.services.find(service => service.id === selection.serviceId)!.skills = [];
  assert.equal(resolveSkillSelection(data, selection), undefined, 'a removed Skill cannot fall back to the other device');
  assert.deepEqual([...selectionNodeIds(data, selection)], [], 'an absent Skill cannot focus its former owner');
  data.services = data.services.filter(service => service.id !== selection.serviceId);
  assert.equal(resolveSkillSelection(data, selection), undefined, 'a removed service cannot fall back to another matching Skill ID');
  assert.deepEqual([...selectionNodeIds(data, selection)], []);
  assert.equal(resolveSkillSelection(data, { type: 'service', id: 'shared-skill' }), undefined);
});
