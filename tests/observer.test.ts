import test from 'node:test';
import assert from 'node:assert/strict';
import { AcpAdapter, workStatus } from '../src/adapters/acp';
import { parseConfig } from '../src/observer/config';
import { projectService } from '../src/adapters/node';
import { SourceError, type JsonObject } from '../src/adapters/http';

const options = { timeoutMs: 300, maxPages: 5, staleAfterMs: 5000 };
const timestamp = '2026-10-22T09:00:00.000Z';
function job(sourceId = 'ledger-a', originSessionId = 'origin-a', jobId = 'j1') {
  return { sourceId, originSessionId, jobId, title: 'Quarterly report', executionStatus: 'working', updatedAt: timestamp, businessAcceptance: { reviewStatus: 'pending' }, attempts: [{ attemptId: 'a1', jobId, executionStatus: 'working', updatedAt: timestamp }] };
}
function event(sequence: number, sourceId = 'ledger-a', jobId = 'j1') {
  return { eventId: `e${sequence}`, sourceId, sequence, jobId, attemptId: 'a1', observedAt: timestamp, type: 'attempt.updated', data: { executionStatus: 'working' } };
}

test('ACP requires explicit origins and does not infer human initiation', async () => {
  assert.throws(() => new AcpAdapter({ id: 'x', originSessionId: '' }, options));
  const config = parseConfig({ acpSources: [{ id: 'missing', url: 'http://127.0.0.1:1234' }] }, {});
  assert.equal(config.acpSources.length, 0);
  assert.ok(config.diagnostics.some(d => d.includes('originSessionId')));
  const adapter = new AcpAdapter({ id: 'source', originSessionId: 'origin-a' }, options, async method => method === 'execution_list' ? { jobs: [job(), job('ledger-a', 'wrong-origin', 'hidden')], total: 2 } : { sourceId: 'ledger-a', events: [], hasMore: false });
  const snapshot = await adapter.read(timestamp);
  assert.equal(snapshot.jobs.length, 1);
  assert.equal(snapshot.jobs[0].trigger, 'unknown');
  assert.equal(snapshot.source.status, 'partial');
});

test('ACP paginates jobs and events, preserves cursor on empty page, and deduplicates replay IDs', async () => {
  const cursors: number[] = [];
  const offsets: number[] = [];
  let round = 0;
  const adapter = new AcpAdapter({ id: 'source', originSessionId: 'origin-a' }, options, async (method, params) => {
    if (method === 'execution_list') {
      const offset = params.offset as number; offsets.push(offset);
      return { jobs: [job('ledger-a', 'origin-a', offset === 0 ? 'j1' : 'j2')], total: 2 };
    }
    const cursor = params.afterSequence as number; cursors.push(cursor);
    if (cursor === 0) return { sourceId: 'ledger-a', events: [event(1)], nextSequence: 1, hasMore: true };
    if (round++ === 0) return { sourceId: 'ledger-a', events: [event(2)], nextSequence: 2, hasMore: false };
    return { sourceId: 'ledger-a', events: [], hasMore: false };
  });
  const first = await adapter.read(timestamp);
  const second = await adapter.read(timestamp);
  assert.deepEqual(offsets, [0, 1, 0, 1]);
  assert.deepEqual(cursors, [0, 1, 2]);
  assert.equal(first.jobs.length, 2);
  assert.equal(second.events.length, 2);
  assert.equal(new Set(second.events.map(e => e.id)).size, 2);
});

test('failed second event page retains committed first page and reconnects without recounting', async () => {
  let fails = true;
  const cursors: number[] = [];
  const adapter = new AcpAdapter({ id: 'source', originSessionId: 'origin-a' }, options, async (method, params) => {
    if (method === 'execution_list') return { jobs: [job()], total: 1 };
    const cursor = params.afterSequence as number; cursors.push(cursor);
    if (cursor === 0) return { sourceId: 'ledger-a', events: [event(1)], nextSequence: 1, hasMore: true };
    if (fails) throw new SourceError('simulated source disconnect');
    return { sourceId: 'ledger-a', events: [event(1), event(2)], nextSequence: 2, hasMore: false };
  });
  const partial = await adapter.read(timestamp);
  assert.equal(partial.source.status, 'partial');
  assert.equal(partial.events.length, 1);
  fails = false;
  const restored = await adapter.read(timestamp);
  assert.deepEqual(cursors, [0, 1, 1]);
  assert.equal(restored.source.status, 'ok');
  assert.equal(restored.events.length, 2);
});

test('ledger identity changes reset cursor and remove old source identities', async () => {
  let source = 'ledger-a';
  const cursors: number[] = [];
  const adapter = new AcpAdapter({ id: 'source', originSessionId: 'origin-a' }, options, async (method, params) => {
    if (method === 'execution_list') return { jobs: [job(source)], total: 1 };
    cursors.push(params.afterSequence as number);
    return { sourceId: source, events: [event(1, source)], nextSequence: 1, hasMore: false };
  });
  const first = await adapter.read(timestamp);
  source = 'ledger-b';
  const second = await adapter.read(timestamp);
  assert.deepEqual(cursors, [0, 0]);
  assert.notEqual(first.events[0].id, second.events[0].id);
  assert.ok(second.events.every(e => e.sourceId.includes('ledger-b')));
  assert.ok(second.jobs.every(j => j.sourceId.includes('ledger-b')));
});

test('same native IDs from distinct origin/filter scopes never collide', async () => {
  const make = (origin: string, filter?: string) => new AcpAdapter({ id: 'source', originSessionId: origin, jobId: filter }, options, async method => method === 'execution_list' ? { jobs: [job('ledger-a', origin)], total: 1 } : { sourceId: 'ledger-a', events: [event(1)], nextSequence: 1, hasMore: false });
  const a = await make('origin-a').read(timestamp);
  const b = await make('origin-b').read(timestamp);
  const c = await make('origin-a', 'j1').read(timestamp);
  assert.equal(new Set([a.events[0].id, b.events[0].id, c.events[0].id]).size, 3);
});

test('canceled, rejected, authentication and unrecognized states keep their meaning', () => {
  assert.equal(workStatus('auth_required'), 'input_required');
  assert.equal(workStatus('canceled'), 'canceled');
  assert.equal(workStatus('rejected'), 'rejected');
  assert.equal(workStatus('some-new-status'), 'unknown');
});

test('declared CLI up and MCP source metadata do not prove current service health', () => {
  const declared = { id: 's1', liveness: 'up', execution: 'cli', metadata: { mcp_source: 'source' }, methods: { list: { description: 'Read catalog' } } };
  const result = projectService(declared, 'n1', 'source1', timestamp);
  assert.equal(result?.status, 'unknown');
  assert.equal(result?.observedAt, null);
  assert.equal(result?.methods[0].name, 'list');
});

test('a failed job list with a successful empty event page does not establish zero jobs', async () => {
  const adapter = new AcpAdapter({ id: 'source', originSessionId: 'origin-a' }, options, async method => {
    if (method === 'execution_list') throw new SourceError('HTTP 403', 'forbidden');
    return { sourceId: 'ledger-a', events: [], hasMore: false };
  });
  const result = await adapter.read(timestamp);
  assert.equal(result.jobs.length, 0);
  assert.equal(result.source.jobsObservedAt, null);
  assert.notEqual(result.source.status, 'ok');
});

test('an explicitly successful empty job list is known empty within its configured scope', async () => {
  const adapter = new AcpAdapter({ id: 'source', originSessionId: 'origin-a' }, options, async method => method === 'execution_list' ? { jobs: [], total: 0 } : { sourceId: 'ledger-a', events: [], hasMore: false });
  const result = await adapter.read(timestamp);
  assert.equal(result.jobs.length, 0);
  assert.equal(result.source.jobsObservedAt, timestamp);
  assert.equal(result.source.status, 'ok');
});
