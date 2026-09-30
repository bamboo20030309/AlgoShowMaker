'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CompileJobQueue,
  CompileQueueError,
  CompileQueueCancelledError,
} = require('../compile-job-queue');

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

test('defaults use one worker, one active job per owner, and bounded pending work', () => {
  const queue = new CompileJobQueue();
  assert.deepEqual(queue.snapshot(), {
    concurrency: 1,
    maxActivePerOwner: 1,
    maxPendingPerOwner: 3,
    maxPending: 150,
    active: 0,
    pending: 0,
    pendingByOwner: {},
    activeByOwner: {},
    inFlightKeys: 0,
  });
});

test('concurrency and per-owner active limits are enforced', async () => {
  const queue = new CompileJobQueue({ concurrency: 2 });
  const gates = [deferred(), deferred(), deferred()];
  const started = [];
  const handles = [
    queue.enqueue({ ownerId: 'A', run: () => { started.push('A1'); return gates[0].promise; } }),
    queue.enqueue({ ownerId: 'A', run: () => { started.push('A2'); return gates[1].promise; } }),
    queue.enqueue({ ownerId: 'B', run: () => { started.push('B1'); return gates[2].promise; } }),
  ];

  await flush();
  assert.deepEqual(started, ['A1', 'B1']);
  assert.equal(queue.snapshot().active, 2);
  gates[0].resolve('a1');
  await handles[0].promise;
  await flush();
  assert.deepEqual(started, ['A1', 'B1', 'A2']);

  gates[1].resolve('a2');
  gates[2].resolve('b1');
  assert.deepEqual(await Promise.all(handles.map((handle) => handle.promise)), ['a1', 'a2', 'b1']);
  assert.equal(queue.snapshot().active, 0);
});

test('runner rejection releases its slot for the next job', async () => {
  const queue = new CompileJobQueue();
  const gate = deferred();
  const started = [];
  const failed = queue.enqueue({ ownerId: 'A', run: () => gate.promise });
  const next = queue.enqueue({ ownerId: 'B', run: () => { started.push('B'); return 'ok'; } });

  gate.reject(new Error('compiler failed'));
  await assert.rejects(failed.promise, /compiler failed/);
  assert.equal(await next.promise, 'ok');
  assert.deepEqual(started, ['B']);
  assert.equal(queue.snapshot().active, 0);
});

test('per-owner and global pending caps reject excess distinct jobs', async () => {
  const ownerQueue = new CompileJobQueue({ maxPendingPerOwner: 2 });
  const ownerGate = deferred();
  const active = ownerQueue.enqueue({ ownerId: 'A', run: () => ownerGate.promise });
  ownerQueue.enqueue({ ownerId: 'A', run: () => 'pending-1' });
  ownerQueue.enqueue({ ownerId: 'A', run: () => 'pending-2' });
  assert.throws(
    () => ownerQueue.enqueue({ ownerId: 'A', run: () => 'excess' }),
    (error) => error instanceof CompileQueueError && error.code === 'COMPILE_OWNER_QUEUE_FULL',
  );
  ownerGate.resolve('active');
  await active.promise;

  const globalQueue = new CompileJobQueue({ maxPending: 1 });
  const globalGate = deferred();
  const globalActive = globalQueue.enqueue({ ownerId: 'A', run: () => globalGate.promise });
  globalQueue.enqueue({ ownerId: 'B', run: () => 'pending' });
  assert.throws(
    () => globalQueue.enqueue({ ownerId: 'C', run: () => 'excess' }),
    (error) => error instanceof CompileQueueError && error.code === 'COMPILE_QUEUE_FULL',
  );
  globalGate.resolve('active');
  await globalActive.promise;
});

test('owners are dispatched round-robin while preserving each owner queue', async () => {
  const queue = new CompileJobQueue();
  const firstGate = deferred();
  const order = [];
  const handles = [
    queue.enqueue({ ownerId: 'A', run: () => { order.push('A1'); return firstGate.promise; } }),
    queue.enqueue({ ownerId: 'A', run: () => { order.push('A2'); return 'A2'; } }),
    queue.enqueue({ ownerId: 'B', run: () => { order.push('B1'); return 'B1'; } }),
    queue.enqueue({ ownerId: 'B', run: () => { order.push('B2'); return 'B2'; } }),
  ];

  firstGate.resolve('A1');
  await Promise.all(handles.map((handle) => handle.promise));
  assert.deepEqual(order, ['A1', 'B1', 'A2', 'B2']);
});

test('round-robin cursor skips active owners without restarting at the first owner', async () => {
  const queue = new CompileJobQueue({ concurrency: 2 });
  const a1Gate = deferred();
  const b1Gate = deferred();
  const a2Gate = deferred();
  const order = [];
  const handles = [
    queue.enqueue({ ownerId: 'A', run: () => { order.push('A1'); return a1Gate.promise; } }),
    queue.enqueue({ ownerId: 'A', run: () => { order.push('A2'); return a2Gate.promise; } }),
    queue.enqueue({ ownerId: 'B', run: () => { order.push('B1'); return b1Gate.promise; } }),
    queue.enqueue({ ownerId: 'C', run: () => { order.push('C1'); return 'C1'; } }),
  ];

  await flush();
  assert.deepEqual(order, ['A1', 'B1']);
  a1Gate.resolve('A1');
  await handles[0].promise;
  await flush();
  assert.deepEqual(order.slice(0, 3), ['A1', 'B1', 'C1']);

  b1Gate.resolve('B1');
  a2Gate.resolve('A2');
  await Promise.all(handles.map((handle) => handle.promise));
  assert.deepEqual(order, ['A1', 'B1', 'C1', 'A2']);
});

test('priority buckets reorder one owner and aging promotes older work', async () => {
  let now = 0;
  const queue = new CompileJobQueue({ agingMs: 10, now: () => now });
  const blocker = deferred();
  const order = [];
  const active = queue.enqueue({ ownerId: 'X', run: () => blocker.promise });
  const oldBackground = queue.enqueue({
    ownerId: 'A',
    priority: 'background',
    run: () => { order.push('old-background'); return 1; },
  });
  now = 25;
  const newInteractive = queue.enqueue({
    ownerId: 'A',
    priority: 'interactive',
    run: () => { order.push('new-interactive'); return 2; },
  });

  blocker.resolve('done');
  await Promise.all([active.promise, oldBackground.promise, newInteractive.promise]);
  assert.deepEqual(order, ['old-background', 'new-interactive']);

  const priorityQueue = new CompileJobQueue({ agingMs: 0 });
  const priorityBlocker = deferred();
  const priorityOrder = [];
  const blockingHandle = priorityQueue.enqueue({ ownerId: 'X', run: () => priorityBlocker.promise });
  const low = priorityQueue.enqueue({ ownerId: 'A', priority: 'low', run: () => priorityOrder.push('low') });
  const high = priorityQueue.enqueue({ ownerId: 'A', priority: 'high', run: () => priorityOrder.push('high') });
  priorityBlocker.resolve();
  await Promise.all([blockingHandle.promise, low.promise, high.promise]);
  assert.deepEqual(priorityOrder, ['high', 'low']);
});

test('same-key subscribers share one queued or active runner call', async () => {
  const queue = new CompileJobQueue();
  const gate = deferred();
  let calls = 0;
  const first = queue.enqueue({ ownerId: 'A', key: 'same-input', run: () => { calls += 1; return gate.promise; } });
  const second = queue.enqueue({ ownerId: 'B', key: 'same-input', run: () => { calls += 1; return 'wrong'; } });

  assert.equal(first.deduplicated, false);
  assert.equal(second.deduplicated, true);
  assert.equal(second.jobId, first.jobId);
  assert.equal(queue.snapshot().pending, 0);
  gate.resolve({ trace: true });
  assert.deepEqual(await Promise.all([first.promise, second.promise]), [{ trace: true }, { trace: true }]);
  assert.equal(calls, 1);
  assert.equal(queue.snapshot().inFlightKeys, 0);
});

test('cancelling queued subscribers removes the job only after the last subscriber leaves', async () => {
  const queue = new CompileJobQueue();
  const blocker = deferred();
  let cancelledRunnerCalls = 0;
  const active = queue.enqueue({ ownerId: 'A', run: () => blocker.promise });
  const first = queue.enqueue({
    ownerId: 'B',
    key: 'cancel-me',
    run: () => { cancelledRunnerCalls += 1; return 'unexpected'; },
  });
  const second = queue.enqueue({ ownerId: 'C', key: 'cancel-me', run: () => 'unexpected' });

  assert.equal(first.cancel(), true);
  await assert.rejects(first.promise, CompileQueueCancelledError);
  assert.equal(queue.snapshot().pending, 1);
  assert.equal(second.cancel(), true);
  await assert.rejects(second.promise, CompileQueueCancelledError);
  assert.equal(queue.snapshot().pending, 0);
  assert.equal(queue.snapshot().inFlightKeys, 0);

  blocker.resolve('done');
  await active.promise;
  await flush();
  assert.equal(cancelledRunnerCalls, 0);
});
