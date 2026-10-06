'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CompileJobQueue } = require('../compile-job-queue');
const {
  CompileJobRegistry,
  CompileJobNotFoundError,
  CompileJobForbiddenError,
  CompileJobConflictError,
} = require('../compile-job-registry');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

function idFactory() {
  let value = 0;
  return () => `public-${++value}`;
}

test('reports queued, running and completed states with queue positions', async () => {
  const firstGate = deferred();
  let executionId = 0;
  const queue = new CompileJobQueue({ idFactory: () => `execution-${++executionId}` });
  const registry = new CompileJobRegistry({ queue, idFactory: idFactory() });
  const first = registry.submit({ ownerId: 'A', run: () => firstGate.promise });
  const second = registry.submit({ ownerId: 'B', run: () => ({ value: 2 }) });

  assert.equal(registry.get(first.jobId, 'A').state, 'running');
  assert.equal(registry.get(first.jobId, 'A').queuePosition, 0);
  assert.equal(registry.get(second.jobId, 'B').state, 'queued');
  assert.equal(registry.get(second.jobId, 'B').queuePosition, 1);

  firstGate.resolve({ value: 1 });
  await first.promise;
  await second.promise;
  const finished = registry.get(second.jobId, 'B');
  assert.equal(finished.state, 'completed');
  assert.equal(finished.queuePosition, null);
  assert.deepEqual(finished.result, { value: 2 });
});

test('enforces owner authorization without revealing another owner result', async () => {
  const registry = new CompileJobRegistry({ idFactory: idFactory() });
  const job = registry.submit({ ownerId: 'owner-a', run: () => ({ secret: true }) });
  await job.promise;

  assert.throws(() => registry.get(job.jobId, 'owner-b'), CompileJobForbiddenError);
  assert.throws(() => registry.cancel(job.jobId, 'owner-b'), CompileJobForbiddenError);
  assert.throws(() => registry.get('missing', 'owner-a'), CompileJobNotFoundError);
});

test('deduplicated executions retain separate owner-scoped public jobs', async () => {
  const gate = deferred();
  let calls = 0;
  const registry = new CompileJobRegistry({ idFactory: idFactory() });
  const first = registry.submit({
    ownerId: 'A',
    key: 'same',
    run: () => { calls += 1; return gate.promise; },
  });
  const second = registry.submit({ ownerId: 'B', key: 'same', run: () => 'wrong' });

  assert.notEqual(first.jobId, second.jobId);
  assert.equal(first.executionId, second.executionId);
  assert.equal(second.deduplicated, true);
  assert.equal(registry.get(second.jobId, 'B').state, 'running');
  gate.resolve({ shared: true });
  assert.deepEqual(await Promise.all([first.promise, second.promise]), [
    { shared: true },
    { shared: true },
  ]);
  assert.equal(calls, 1);
});

test('only a queued subscriber can be cancelled and shared work remains for others', async () => {
  const blocker = deferred();
  const registry = new CompileJobRegistry({ idFactory: idFactory() });
  const active = registry.submit({ ownerId: 'A', run: () => blocker.promise });
  const first = registry.submit({ ownerId: 'B', key: 'shared', run: () => 'kept' });
  const second = registry.submit({ ownerId: 'C', key: 'shared', run: () => 'wrong' });

  assert.throws(() => registry.cancel(active.jobId, 'A'), CompileJobConflictError);
  const cancelled = registry.cancel(first.jobId, 'B');
  assert.equal(cancelled.state, 'cancelled');
  assert.equal(registry.get(second.jobId, 'C').state, 'queued');
  await assert.rejects(first.promise, /cancelled/i);

  blocker.resolve('done');
  await active.promise;
  assert.equal(await second.promise, 'kept');
});

test('publishes poll and subscription snapshots while isolating listener failures', async () => {
  const gate = deferred();
  const registry = new CompileJobRegistry({ idFactory: idFactory() });
  const blocker = registry.submit({ ownerId: 'A', run: () => gate.promise });
  const job = registry.submit({ ownerId: 'B', run: () => 42 });
  const states = [];
  registry.subscribe(job.jobId, 'B', (snapshot) => states.push(snapshot.state));
  registry.subscribe(job.jobId, 'B', () => { throw new Error('closed stream'); });

  gate.resolve();
  await blocker.promise;
  await job.promise;
  assert.deepEqual(states, ['queued', 'running', 'completed']);
});

test('stores immutable clones instead of caller-owned mutable results', async () => {
  const source = { trace: [{ value: 1 }] };
  const registry = new CompileJobRegistry({ idFactory: idFactory() });
  const job = registry.submit({ ownerId: 'A', metadata: { kind: 'interactive' }, run: () => source });
  await job.promise;
  source.trace[0].value = 99;

  const snapshot = registry.get(job.jobId, 'A');
  assert.equal(snapshot.result.trace[0].value, 1);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.result.trace), true);
  assert.equal(Object.isFrozen(snapshot.metadata), true);
  assert.throws(() => { snapshot.result.trace[0].value = 7; }, TypeError);
});

test('records failed jobs as serializable immutable errors', async () => {
  const registry = new CompileJobRegistry({ idFactory: idFactory() });
  const failure = Object.assign(new Error('compile failed'), { code: 'CE', statusCode: 422 });
  const job = registry.submit({ ownerId: 'A', run: () => { throw failure; } });
  await assert.rejects(job.promise, /compile failed/);

  const snapshot = registry.get(job.jobId, 'A');
  assert.equal(snapshot.state, 'failed');
  assert.deepEqual(snapshot.error, {
    name: 'Error',
    code: 'CE',
    message: 'compile failed',
    statusCode: 422,
  });
});

test('bounds terminal results and expires them after TTL', async () => {
  let now = 100;
  const registry = new CompileJobRegistry({
    ttlMs: 10,
    maxResults: 2,
    now: () => now,
    idFactory: idFactory(),
  });
  const jobs = [];
  for (let index = 0; index < 3; index += 1) {
    const job = registry.submit({ ownerId: 'A', run: () => index });
    jobs.push(job);
    await job.promise;
  }

  assert.throws(() => registry.get(jobs[0].jobId, 'A'), CompileJobNotFoundError);
  assert.equal(registry.metrics().completed, 2);
  now = 111;
  assert.equal(registry.metrics().retained, 0);
  assert.throws(() => registry.get(jobs[2].jobId, 'A'), CompileJobNotFoundError);
});

test('metrics expose aggregate lifecycle counters and queue pressure', async () => {
  const gate = deferred();
  const registry = new CompileJobRegistry({ idFactory: idFactory() });
  const active = registry.submit({ ownerId: 'A', run: () => gate.promise });
  const queued = registry.submit({ ownerId: 'B', run: () => 'ok' });
  const before = registry.metrics();
  assert.equal(before.running, 1);
  assert.equal(before.queued, 1);
  assert.equal(before.queue.active, 1);
  assert.equal(before.queue.pending, 1);
  assert.equal(before.counters.submitted, 2);

  gate.resolve();
  await Promise.all([active.promise, queued.promise]);
  const after = registry.metrics();
  assert.equal(after.completed, 2);
  assert.equal(after.counters.completed, 2);
  assert.equal(after.queue.active, 0);
});
