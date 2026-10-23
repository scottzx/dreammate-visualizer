import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDALONE_DEMO, assetUrl } from '../src/view/deployment';
import { standaloneDemoSnapshot } from '../src/view/standalone-snapshot';
import { demoSkillDocument } from '../src/read-model/demo-skill';

test('the observer build keeps root asset URLs and does not start in demo mode', () => {
  assert.equal(STANDALONE_DEMO, false);
  assert.equal(assetUrl('models/x.glb'), '/models/x.glb');
  assert.equal(assetUrl('/?view=models'), '/?view=models');
  assert.equal(assetUrl(''), '/');
});

test('the standalone snapshot is a complete, explicitly labeled demo scenario', () => {
  const snapshot = standaloneDemoSnapshot(new Date('2026-10-23T10:00:00.000Z'));
  assert.equal(snapshot.mode, 'demo');
  assert.equal(snapshot.refreshIntervalMs, 180_000);
  assert.ok(snapshot.nodes.length >= 5);
  assert.ok(snapshot.services.every(service => service.evidence.length > 0));
  assert.ok((snapshot.voyages?.length ?? 0) >= 4);
  assert.ok(snapshot.limitations.some(line => line.includes('演示模式')));
});

test('demo Skill documents are constructed locally and labeled as examples', () => {
  const snapshot = standaloneDemoSnapshot();
  const service = snapshot.services.find(item => item.skills.length > 0);
  assert.ok(service);
  const document = demoSkillDocument(service.skills[0]);
  assert.equal(document.skillId, service.skills[0].id);
  assert.ok(document.markdown.includes('演示 SKILL.md'));
  assert.ok(document.markdown.includes('不会执行技能或访问真实设备'));
});
