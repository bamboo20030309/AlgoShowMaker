'use strict';

const { randomUUID } = require('node:crypto');

const PRIORITY_RANKS = Object.freeze({
  interactive: 0,
  current: 0,
  high: 0,
  normal: 1,
  visible: 1,
  background: 2,
  buffer: 2,
  low: 2,
});

class CompileQueueError extends Error {
  constructor(message, code, statusCode = 429) {
    super(message);
    this.name = 'CompileQueueError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class CompileQueueCancelledError extends CompileQueueError {
  constructor(message = 'Compile request was cancelled while waiting') {
    super(message, 'COMPILE_QUEUE_CANCELLED', 499);
    this.name = 'CompileQueueCancelledError';
  }
}

/**
 * A process-local fair scheduler for expensive compile jobs.
 *
 * Jobs are grouped by owner and owners are selected in round-robin order. A
 * job's priority only reorders that owner's own pending work, so a stream of
 * high-priority requests from one owner cannot starve other owners. Lower
 * priority work is promoted one bucket per aging interval while it waits.
 */
class CompileJobQueue {
  constructor(options = {}) {
    this.concurrency = positiveInteger(options.concurrency, 1, 'concurrency');
    this.maxActivePerOwner = positiveInteger(
      options.maxActivePerOwner,
      1,
      'maxActivePerOwner',
    );
    this.maxPendingPerOwner = nonNegativeInteger(
      options.maxPendingPerOwner,
      3,
      'maxPendingPerOwner',
    );
    this.maxPending = nonNegativeInteger(options.maxPending, 150, 'maxPending');
    this.agingMs = nonNegativeInteger(options.agingMs, 30_000, 'agingMs');
    this.now = typeof options.now === 'function' ? options.now : Date.now;
    this.idFactory = typeof options.idFactory === 'function' ? options.idFactory : randomUUID;

    this.pendingByOwner = new Map();
    this.ownerOrder = [];
    this.activeByOwner = new Map();
    this.inFlightByKey = new Map();
    this.ownerLastServed = new Map();
    this.activeCount = 0;
    this.pendingCount = 0;
    this.sequence = 0;
    this.dispatchSequence = 0;
  }

  /**
   * Enqueue work and return an independently cancellable subscriber handle.
   * Identical non-empty keys share one queued/running job and one runner call.
   */
  enqueue({ ownerId, key = null, priority = 'normal', run } = {}) {
    const normalizedOwner = normalizeOwner(ownerId);
    if (typeof run !== 'function') {
      throw new TypeError('run must be a function');
    }

    const normalizedKey = normalizeKey(key);
    const existing = normalizedKey ? this.inFlightByKey.get(normalizedKey) : null;
    if (existing) {
      return this._subscribe(existing, true);
    }

    const ownerPending = this.pendingByOwner.get(normalizedOwner)?.length || 0;
    if (ownerPending >= this.maxPendingPerOwner) {
      throw new CompileQueueError(
        `Owner ${normalizedOwner} already has ${ownerPending} pending compile jobs`,
        'COMPILE_OWNER_QUEUE_FULL',
      );
    }
    if (this.pendingCount >= this.maxPending) {
      throw new CompileQueueError(
        `Compile queue already has ${this.pendingCount} pending jobs`,
        'COMPILE_QUEUE_FULL',
      );
    }

    const job = {
      id: String(this.idFactory()),
      ownerId: normalizedOwner,
      key: normalizedKey,
      priority: normalizePriority(priority),
      run,
      state: 'pending',
      createdAt: this.now(),
      sequence: this.sequence++,
      subscribers: new Set(),
    };

    let ownerQueue = this.pendingByOwner.get(normalizedOwner);
    if (!ownerQueue) {
      ownerQueue = [];
      this.pendingByOwner.set(normalizedOwner, ownerQueue);
      this.ownerOrder.push(normalizedOwner);
      this.ownerLastServed.set(normalizedOwner, 0);
    }
    ownerQueue.push(job);
    this.pendingCount += 1;
    if (normalizedKey) this.inFlightByKey.set(normalizedKey, job);

    const handle = this._subscribe(job, false);
    this._drain();
    return handle;
  }

  schedule(request) {
    return this.enqueue(request);
  }

  snapshot() {
    const pendingByOwner = {};
    for (const [ownerId, jobs] of this.pendingByOwner) {
      if (jobs.length > 0) pendingByOwner[ownerId] = jobs.length;
    }
    const activeByOwner = {};
    for (const [ownerId, count] of this.activeByOwner) {
      if (count > 0) activeByOwner[ownerId] = count;
    }
    return {
      concurrency: this.concurrency,
      maxActivePerOwner: this.maxActivePerOwner,
      maxPendingPerOwner: this.maxPendingPerOwner,
      maxPending: this.maxPending,
      active: this.activeCount,
      pending: this.pendingCount,
      pendingByOwner,
      activeByOwner,
      inFlightKeys: this.inFlightByKey.size,
    };
  }

  _subscribe(job, deduplicated) {
    const subscriber = {
      settled: false,
      resolve: null,
      reject: null,
    };
    const promise = new Promise((resolve, reject) => {
      subscriber.resolve = resolve;
      subscriber.reject = reject;
    });
    job.subscribers.add(subscriber);

    return {
      jobId: job.id,
      deduplicated,
      promise,
      cancel: () => this._cancelSubscriber(job, subscriber),
    };
  }

  _cancelSubscriber(job, subscriber) {
    if (subscriber.settled || !job.subscribers.has(subscriber)) return false;
    subscriber.settled = true;
    job.subscribers.delete(subscriber);
    subscriber.reject(new CompileQueueCancelledError());

    if (job.state === 'pending' && job.subscribers.size === 0) {
      this._removePendingJob(job);
      if (job.key && this.inFlightByKey.get(job.key) === job) {
        this.inFlightByKey.delete(job.key);
      }
      job.state = 'cancelled';
      this._drain();
    }
    return true;
  }

  _drain() {
    while (this.activeCount < this.concurrency) {
      const job = this._takeNextJob();
      if (!job) break;
      this._start(job);
    }
  }

  _takeNextJob() {
    let ownerIndex = -1;
    let oldestDispatch = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.ownerOrder.length; index += 1) {
      const ownerId = this.ownerOrder[index];
      const pending = this.pendingByOwner.get(ownerId);
      const active = this.activeByOwner.get(ownerId) || 0;
      const lastServed = this.ownerLastServed.get(ownerId) || 0;
      if (pending?.length > 0 && active < this.maxActivePerOwner && lastServed < oldestDispatch) {
        ownerIndex = index;
        oldestDispatch = lastServed;
      }
    }
    if (ownerIndex < 0) return null;

    const ownerId = this.ownerOrder[ownerIndex];
    this.ownerLastServed.set(ownerId, ++this.dispatchSequence);

    const ownerQueue = this.pendingByOwner.get(ownerId);
    let selectedIndex = 0;
    for (let index = 1; index < ownerQueue.length; index += 1) {
      if (this._compareJobs(ownerQueue[index], ownerQueue[selectedIndex]) < 0) {
        selectedIndex = index;
      }
    }
    const [job] = ownerQueue.splice(selectedIndex, 1);
    this.pendingCount -= 1;
    return job;
  }

  _compareJobs(left, right) {
    const now = this.now();
    const leftPriority = this._effectivePriority(left, now);
    const rightPriority = this._effectivePriority(right, now);
    return leftPriority - rightPriority || left.sequence - right.sequence;
  }

  _effectivePriority(job, now) {
    if (this.agingMs === 0) return job.priority;
    const promotions = Math.floor(Math.max(0, now - job.createdAt) / this.agingMs);
    return Math.max(0, job.priority - promotions);
  }

  _start(job) {
    job.state = 'active';
    this.activeCount += 1;
    this.activeByOwner.set(job.ownerId, (this.activeByOwner.get(job.ownerId) || 0) + 1);

    Promise.resolve()
      .then(() => job.run({ jobId: job.id, ownerId: job.ownerId, key: job.key }))
      .then(
        (value) => this._settleJob(job, null, value),
        (error) => this._settleJob(job, error),
      );
  }

  _settleJob(job, error, value) {
    job.state = error ? 'failed' : 'completed';
    this.activeCount -= 1;
    const ownerActive = (this.activeByOwner.get(job.ownerId) || 1) - 1;
    if (ownerActive > 0) this.activeByOwner.set(job.ownerId, ownerActive);
    else this.activeByOwner.delete(job.ownerId);

    if (job.key && this.inFlightByKey.get(job.key) === job) {
      this.inFlightByKey.delete(job.key);
    }

    for (const subscriber of job.subscribers) {
      if (subscriber.settled) continue;
      subscriber.settled = true;
      if (error) subscriber.reject(error);
      else subscriber.resolve(value);
    }
    job.subscribers.clear();
    this._removeOwnerIfIdle(job.ownerId);
    this._drain();
  }

  _removePendingJob(job) {
    const ownerQueue = this.pendingByOwner.get(job.ownerId);
    if (!ownerQueue) return false;
    const index = ownerQueue.indexOf(job);
    if (index < 0) return false;
    ownerQueue.splice(index, 1);
    this.pendingCount -= 1;
    this._removeOwnerIfIdle(job.ownerId);
    return true;
  }

  _removeOwnerIfIdle(ownerId) {
    const ownerQueue = this.pendingByOwner.get(ownerId);
    if (ownerQueue?.length > 0 || (this.activeByOwner.get(ownerId) || 0) > 0) return;
    this.pendingByOwner.delete(ownerId);
    this.ownerLastServed.delete(ownerId);
    const orderIndex = this.ownerOrder.indexOf(ownerId);
    if (orderIndex >= 0) this.ownerOrder.splice(orderIndex, 1);
  }
}

function normalizeOwner(ownerId) {
  if (typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TypeError('ownerId must be a non-empty string');
  }
  return ownerId.trim();
}

function normalizeKey(key) {
  if (key === null || key === undefined || key === '') return null;
  return String(key);
}

function normalizePriority(priority) {
  if (Number.isInteger(priority) && priority >= 0 && priority <= 2) return priority;
  const rank = PRIORITY_RANKS[String(priority || 'normal').toLowerCase()];
  if (rank === undefined) throw new TypeError(`Unknown compile priority: ${priority}`);
  return rank;
}

function positiveInteger(value, fallback, name) {
  const selected = value === undefined ? fallback : value;
  if (!Number.isInteger(selected) || selected < 1) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return selected;
}

function nonNegativeInteger(value, fallback, name) {
  const selected = value === undefined ? fallback : value;
  if (!Number.isInteger(selected) || selected < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
  return selected;
}

module.exports = {
  CompileJobQueue,
  CompileQueueError,
  CompileQueueCancelledError,
  PRIORITY_RANKS,
};
