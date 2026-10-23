import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseConfig } from '../src/observer/config';
import { projectService } from '../src/adapters/node';

test('observer defaults collect every three minutes and allow nine minutes before evidence expires', () => {
  const config = parseConfig({}, {});
  assert.equal(config.refreshIntervalMs, 180000);
  assert.equal(config.staleAfterMs, 540000);

  const service = { id: 'service', liveness: 'up', lastProbedAt: '2026-10-23T09:00:00Z' };
  const at = (elapsed: number) => new Date(Date.parse(service.lastProbedAt) + elapsed).toISOString();
  assert.equal(projectService(service, 'node', 'source', at(config.refreshIntervalMs), config.staleAfterMs)?.status, 'up');
  assert.equal(projectService(service, 'node', 'source', at(config.staleAfterMs + 1), config.staleAfterMs)?.status, 'unknown');
});

test('example configuration uses the default collection and stale evidence intervals', async () => {
  const example = JSON.parse(await readFile(new URL('../observer.config.example.json', import.meta.url), 'utf8'));
  const defaults = parseConfig({}, {});
  assert.equal(example.refreshIntervalMs, defaults.refreshIntervalMs);
  assert.equal(example.staleAfterMs, defaults.staleAfterMs);
});

test('explicit observer intervals remain configurable within existing bounds', () => {
  const custom = parseConfig({ refreshIntervalMs: 30000, staleAfterMs: 120000 }, {});
  assert.equal(custom.refreshIntervalMs, 30000);
  assert.equal(custom.staleAfterMs, 120000);
  const bounded = parseConfig({ refreshIntervalMs: 1, staleAfterMs: 900000 }, {});
  assert.equal(bounded.refreshIntervalMs, 3000);
  assert.equal(bounded.staleAfterMs, 600000);
});

test('malformed observer intervals fall back to the slower defaults', () => {
  for (const invalid of ['10000', null, Number.NaN, 10000.5]) {
    const config = parseConfig({ refreshIntervalMs: invalid, staleAfterMs: invalid }, {});
    assert.equal(config.refreshIntervalMs, 180000);
    assert.equal(config.staleAfterMs, 540000);
  }
});
