import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDemoSnapshot } from '../src/observer/demo';
import { planetContents, planetStorageComposition } from '../src/read-model/planet-contents';
import { LocalProjectsAdapter, readDirectoryStorage } from '../src/adapters/projects';
import { parseConfig } from '../src/observer/config';
import { buildBaseLots, summarizeNode } from '../src/read-model/universe';

test('satellites enumerate every service and Skill points deduplicate identities, not names', () => {
  const snapshot = createDemoSnapshot(), node = snapshot.nodes[0], template = snapshot.services[0];
  snapshot.services = Array.from({ length: 19 }, (_, index) => ({ ...template, id: `service:${index}`, nodeId: node.id,
    skills: [{ id: 'shared-package', name: 'same', description: '' }, { id: `package:${index}`, name: 'same', description: '' }] }));
  const contents = planetContents(snapshot, node.id);
  assert.equal(contents.services.length, 19, 'no former fleet sample cap');
  assert.equal(contents.skills.length, 20);
  snapshot.services.reverse();
  assert.deepEqual(planetContents(snapshot, node.id).skills.map(skill => skill.id), contents.skills.map(skill => skill.id));
  snapshot.services[0].skillsStatus = 'stale';
  assert.equal(planetContents(snapshot, node.id).skills.find(skill => skill.id === 'shared-package')?.cached, false, 'a fresh declaration takes precedence');
  assert.equal(planetContents(snapshot, node.id).skillsStatus, 'partial');
  snapshot.services = []; node.catalogAvailable = false;
  assert.equal(planetContents(snapshot, node.id).skillsStatus, 'unknown');
  assert.equal(planetContents(snapshot, node.id).catalogKnown, false);
});

test('project colors use node-local disk bytes divided by real total, preserving gray remainder', () => {
  const snapshot = createDemoSnapshot(), nodeId = snapshot.nodes[0].id;
  const composition = planetStorageComposition(snapshot, nodeId);
  assert.equal(composition.measuredBytes, 47e9);
  assert.equal(composition.segments.find(segment => segment.category === 'business-agent')?.share, 28 / 128);
  assert.equal(composition.segments.find(segment => segment.category === 'perception')?.share, 14 / 128);
  assert.equal(composition.remainderBytes, 81e9);
  assert.equal(composition.status, 'ok');
  const compute = planetStorageComposition(snapshot, snapshot.nodes[1].id);
  assert.equal(compute.measuredBytes, 96e9, 'cross-device project bytes are not copied to each planet');
  delete snapshot.nodes[0].storage;
  const unknownCapacity = planetStorageComposition(snapshot, nodeId);
  assert.equal(unknownCapacity.measuredBytes, 47e9);
  assert.ok(unknownCapacity.segments.every(segment => segment.share === null), '128 GB default cannot become an observed denominator');
  assert.equal(unknownCapacity.remainderBytes, null);
});

test('missing, failed, conflicting and oversized measurements remain unknown instead of zero or clamped colors', () => {
  const snapshot = createDemoSnapshot(), nodeId = snapshot.nodes[0].id;
  snapshot.projects = [snapshot.projects![0]];
  const first = snapshot.projects[0];
  const row = first.storage![0];
  first.storage = undefined;
  assert.equal(planetStorageComposition(snapshot, nodeId).status, 'unknown');
  assert.ok(planetStorageComposition(snapshot, nodeId).segments.every(segment => segment.share === null));
  first.storage = [{ ...row, bytes: null, status: 'unavailable' }];
  assert.ok(planetStorageComposition(snapshot, nodeId).segments.every(segment => segment.share === null));
  first.storage = [{ ...row, bytes: 129e9 }];
  assert.ok(planetStorageComposition(snapshot, nodeId).segments.every(segment => segment.share === null));
  first.storage = [{ ...row }];
  snapshot.projects.push({ ...first, id: 'duplicate' });
  assert.equal(planetStorageComposition(snapshot, nodeId).measuredBytes, row.bytes);
  snapshot.projects[1] = { ...first, id: 'conflict', storage: [{ ...row, bytes: 6e9 }] };
  assert.equal(planetStorageComposition(snapshot, nodeId).measuredBytes, 0);
  assert.equal(planetStorageComposition(snapshot, nodeId).status, 'partial');
});

test('local project statistics bind to one explicit identity, cache reads, and leave other nodes unknown', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'planet-project-'));
  try {
    const snapshot = createDemoSnapshot(); snapshot.mode = 'live';
    const local = snapshot.nodes[0];
    const definitions = [{ id: 'fixture', name: 'Fixture', category: 'business-agent', path: directory }];
    let reads = 0;
    const measure = async () => { reads++; return 4096; };
    const unbound = new LocalProjectsAdapter(parseConfig({ localProjects: definitions }, {}), measure);
    assert.equal((await unbound.read(snapshot.nodes)).projects.length, 0);
    assert.equal(reads, 0);
    const adapter = new LocalProjectsAdapter(parseConfig({ localNodeId: local.nativeId, localProjects: definitions }, {}), measure);
    const first = await adapter.read(snapshot.nodes, '2026-10-23T00:00:00Z');
    assert.equal(first.projects[0].storage![0].bytes, 4096);
    assert.equal(first.projects[0].storage![0].nodeId, local.id);
    await adapter.read(snapshot.nodes, '2026-10-23T00:00:15Z');
    assert.equal(reads, 1);
    await adapter.read(snapshot.nodes, '2026-10-23T00:01:15Z');
    assert.equal(reads, 2);
    snapshot.projects = first.projects;
    assert.equal(summarizeNode(snapshot, snapshot.nodes[1].id).projects, null, 'a local scan does not establish an empty remote catalog');
    assert.equal(buildBaseLots(snapshot, snapshot.nodes[1].id).find(lot => lot.type === 'project')?.placeholder, true);
    const changed = await adapter.read(snapshot.nodes.filter(node => node.id !== local.id));
    assert.equal(changed.projects.length, 0, 'cached files are not reassigned after identity loss');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('overlapping directories, symlink aliases and failed probes are not counted twice or as empty', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'planet-overlap-'));
  try {
    await mkdir(path.join(directory, 'child')); await symlink(directory, path.join(directory, 'alias'));
    const snapshot = createDemoSnapshot(), local = snapshot.nodes[0];
    const roots = [directory, path.join(directory, 'child'), path.join(directory, 'alias')];
    let reads = 0;
    const adapter = new LocalProjectsAdapter(parseConfig({ localNodeId: local.nativeId, localProjects: roots.map((root, i) => ({ id: String(i), path: root })) }, {}), async () => { reads++; return 100; });
    const result = await adapter.read(snapshot.nodes);
    assert.equal(reads, 0);
    assert.ok(result.projects.every(project => project.storage![0].bytes === null));
    const failed = new LocalProjectsAdapter(parseConfig({ localNodeId: local.nativeId, localProjects: [{ id: 'one', path: directory }] }, {}), async () => { throw new Error('permission denied'); });
    assert.equal((await failed.read(snapshot.nodes)).projects[0].storage![0].bytes, null);
    assert.equal(parseConfig({ localProjects: [{ id: 'root', path: '/' }, { id: 'relative', path: './' }] }, {}).localProjects.length, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('directory allocation reader does not traverse a symlink to outside the project', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'planet-du-'));
  try {
    const project = path.join(directory, 'project'), outside = path.join(directory, 'outside');
    await mkdir(project); await mkdir(outside);
    await writeFile(path.join(project, 'small'), Buffer.alloc(4096, 1));
    await writeFile(path.join(outside, 'large'), Buffer.alloc(2 * 1024 * 1024, 2));
    const before = await readDirectoryStorage(project);
    await symlink(outside, path.join(project, 'outside-link'));
    const after = await readDirectoryStorage(project);
    assert.ok(after - before < 100 * 1024, 'an external tree is not charged to the project');
    assert.ok(after < await readDirectoryStorage(outside));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
