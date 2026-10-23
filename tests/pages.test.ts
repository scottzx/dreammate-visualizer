import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = fileURLToPath(new URL('../docs/', import.meta.url));
const landingFile = join(docs, 'index.html');
const landing = readFileSync(landingFile, 'utf8');

function localTargets(html: string): string[] {
  return [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map(match => match[1])
    .filter(target => !/^(?:https?:|#|data:|mailto:)/.test(target));
}

function resolves(htmlFile: string, target: string): boolean {
  const withoutQuery = target.split('?')[0];
  const absolute = resolve(dirname(htmlFile), withoutQuery);
  if (withoutQuery.endsWith('/')) return existsSync(join(absolute, 'index.html'));
  return existsSync(absolute) || existsSync(join(absolute, 'index.html'));
}

test('the four-step section replaces the old pillars and about blocks', () => {
  assert.match(landing, /id="approach"/);
  assert.match(landing, /四步，把能力接进网络/);
  assert.doesNotMatch(landing, /id="pillars"/);
  assert.doesNotMatch(landing, /id="about"/);
  assert.doesNotMatch(landing, /接进来，就不用再配置/);
  assert.doesNotMatch(landing, /它不生产模型/);
});

test('the landing page keeps the demo before the four-step section', () => {
  assert.ok(landing.indexOf('id="demo"') < landing.indexOf('id="approach"'));
  assert.match(landing, /data-demo-src="demo\/\?display=1"/);
});

test('the public page never links to the private design-book repository', () => {
  assert.doesNotMatch(landing, /dreammate_world_plan/);
});

test('the public page carries no milestones or implementation-status labels', () => {
  assert.doesNotMatch(landing, /\bM[1-5]\b/);
  for (const label of ['已落地', '设计中', '待核实', '里程碑']) {
    assert.doesNotMatch(landing, new RegExp(label), `landing page still contains "${label}"`);
  }
  assert.doesNotMatch(landing, /不是[^。]{0,40}而是/);
});

test('every relative link and asset in the landing page resolves locally', () => {
  for (const target of localTargets(landing)) {
    assert.ok(resolves(landingFile, target), `unresolved local target ${target}`);
  }
});
