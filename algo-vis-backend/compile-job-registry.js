'use strict';

const { randomUUID } = require('node:crypto');
const {
  CompileJobQueue,
  CompileQueueCancelledError,
} = require('./compile-job-queue');

const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);

class CompileJobRegistryError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'CompileJobRegistryError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class CompileJobNotFoundError extends CompileJobRegistryError {
  constructor() {
    super('Compile job was not found', 'COMPILE_JOB_NOT_FOUND', 404);
    this.name = 'CompileJobNotFoundError';
  }
}

class CompileJobForbiddenError extends CompileJobRegistryError {
  constructor() {
    super('Compile job belongs to another owner', 'COMPILE_JOB_FORBIDDEN', 403);
    this.name = 'CompileJobForbiddenError';
  }
}

class CompileJobConflictError extends CompileJobRegistryError {
  constructor(message, code = 'COMPILE_JOB_NOT_CANCELLABLE') {
    super(message, code, 409);
    this.name = 'CompileJobConflictError';
  }
}

/**
 * Process-local async job registry layered on top of CompileJobQueue.
 *
 * Every caller receives a private public job id. Several public jobs may point
 * at the same queue execution when the queue deduplicates an identical key.
 * Ownership checks therefore happen on the public record, never on the shared
 * queue job.
 */
class CompileJobRegistry {
  constructor(options = {}) {
    this.queue = options.queue || new CompileJobQueue(options.queueOptions);
    this.ttlMs = positiveInteger(options.ttlMs, 10 * 60_000, 'ttlMs');
    this.maxResults = positiveInteger(options.maxResults, 100, 'maxResults');
    this.now = typeof options.now === 'function' ? options.now : Date.now;
    this.idFactory = typeof options.idFactory === 'function' ? options.idFactory : randomUUID;

    this.jobs = new Map();
    this.recordsByExecution = new Map();
    this.terminalOrder = [];
    this.sequence = 0;
    this.counters = {
      submitted: 0,
      deduplicated: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      expired: 0,
    };
  }

  /**
   * Submit work without holding an HTTP response open. The returned id is safe
   * to expose to the owner; `promise` remains available for the legacy
   * synchronous route while an async route can poll getSnapshot instead.
   */
  submit({ ownerId, key = null, priority = 'normal', run, metadata = null } = {}) {
    const normalizedOwner = normalizeOwner(ownerId);
    if (typeof run !== 'function') throw new TypeError('run must be a function');
    this._prune();

    const publicId = String(this.idFactory());
    const record = {
      id: publicId,
      ownerId: normalizedOwner,
      executionId: null,
      state: 'queued',
      deduplicated: false,
      createdAt: this.now(),
      startedAt: null,
      finishedAt: null,
      expiresAt: null,
      sequence: this.sequence++,
      metadata: cloneImmutable(metadata),
      result: undefined,
      error: null,
      handle: null,
      listeners: new Set(),
      completion: null,
    };

    let handle;
    handle = this.queue.enqueue({
      ownerId: normalizedOwner,
      key,
      priority,
      run: (context) => {
        this._markExecutionRunning(context.jobId);
        return run(context);
      },
    });

    record.handle = handle;
    record.executionId = handle.jobId;
    record.deduplicated = handle.deduplicated;
    record.state = handle.getState() === 'active' ? 'running' : 'queued';
    if (record.state === 'running') record.startedAt = this.now();
    this.jobs.set(publicId, record);
    let executionRecords = this.recordsByExecution.get(handle.jobId);
    if (!executionRecords) {
      executionRecords = new Set();
      this.recordsByExecution.set(handle.jobId, executionRecords);
    }
    executionRecords.add(record);
    this.counters.submitted += 1;
    if (handle.deduplicated) this.counters.deduplicated += 1;

    record.completion = handle.promise.then(
      (value) => {
        this._finish(record, 'completed', value, null);
        return record.result;
      },
      (error) => {
        if (error instanceof CompileQueueCancelledError) {
          this._finish(record, 'cancelled', undefined, error);
        } else {
          this._finish(record, 'failed', undefined, error);
        }
        throw error;
      },
    );
    // Poll-only API consumers may never await completion. Marking this derived
    // promise handled prevents a cancelled or failed job from becoming a
    // process-level unhandled rejection.
    record.completion.catch(() => {});

    return Object.freeze({
      jobId: publicId,
      executionId: handle.jobId,
      deduplicated: handle.deduplicated,
      promise: record.completion,
      cancel: () => this.cancel(publicId, normalizedOwner),
    });
  }

  create(request) {
    return this.submit(request);
  }

  getSnapshot(jobId, ownerId) {
    const record = this._authorizedRecord(jobId, ownerId);
    return this._snapshot(record);
  }

  get(jobId, ownerId) {
    return this.getSnapshot(jobId, ownerId);
  }

  wait(jobId, ownerId) {
    return this._authorizedRecord(jobId, ownerId).completion;
  }

  cancel(jobId, ownerId) {
    const record = this._authorizedRecord(jobId, ownerId);
    if (record.state !== 'queued') {
      throw new CompileJobConflictError(`Cannot cancel a ${record.state} compile job`);
    }
    if (!record.handle.cancel()) {
      throw new CompileJobConflictError('Compile job could not be cancelled');
    }
    // The queue rejects the subscriber promise asynchronously. Publish the
    // cancelled state immediately so the following poll is deterministic.
    this._finish(record, 'cancelled', undefined, new CompileQueueCancelledError());
    return this._snapshot(record);
  }

  subscribe(jobId, ownerId, listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    const record = this._authorizedRecord(jobId, ownerId);
    record.listeners.add(listener);
    try {
      listener(this._snapshot(record));
    } catch {
      // A subscriber may already have disconnected before its initial event.
    }
    return () => record.listeners.delete(listener);
  }

  metrics() {
    this._prune();
    const states = { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const record of this.jobs.values()) states[record.state] += 1;
    return deepFreeze({
      ...states,
      retained: this.jobs.size,
      counters: { ...this.counters },
      queue: this.queue.snapshot(),
    });
  }

  _authorizedRecord(jobId, ownerId) {
    this._prune();
    const record = this.jobs.get(String(jobId));
    if (!record) throw new CompileJobNotFoundError();
    if (record.ownerId !== normalizeOwner(ownerId)) throw new CompileJobForbiddenError();
    return record;
  }

  _markExecutionRunning(executionId) {
    const records = this.recordsByExecution.get(executionId);
    if (!records) return;
    const startedAt = this.now();
    for (const record of records) {
      if (record.state !== 'queued') continue;
      record.state = 'running';
      record.startedAt = startedAt;
      this._notify(record);
    }
  }

  _finish(record, state, result, error) {
    if (TERMINAL_STATES.has(record.state)) return;
    record.state = state;
    record.finishedAt = this.now();
    record.expiresAt = record.finishedAt + this.ttlMs;
    if (state === 'completed') record.result = cloneImmutable(result);
    if (error) record.error = immutableError(error);
    this.counters[state] += 1;
    this.terminalOrder.push(record.id);

    const executionRecords = this.recordsByExecution.get(record.executionId);
    executionRecords?.delete(record);
    if (executionRecords?.size === 0) this.recordsByExecution.delete(record.executionId);
    this._notify(record);
    this._prune();
  }

  _snapshot(record) {
    const queuePosition = record.state === 'queued'
      ? record.handle.getQueuePosition()
      : record.state === 'running' ? 0 : null;
    const snapshot = {
      jobId: record.id,
      executionId: record.executionId,
      state: record.state,
      deduplicated: record.deduplicated,
      queuePosition,
      createdAt: record.createdAt,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      expiresAt: record.expiresAt,
      metadata: record.metadata,
    };
    if (record.state === 'completed') snapshot.result = record.result;
    if (record.state === 'failed' || record.state === 'cancelled') snapshot.error = record.error;
    return deepFreeze(snapshot);
  }

  _notify(record) {
    if (record.listeners.size === 0) return;
    const snapshot = this._snapshot(record);
    for (const listener of [...record.listeners]) {
      try {
        listener(snapshot);
      } catch {
        // A broken SSE/WebSocket consumer must not affect queue progress.
      }
    }
    if (TERMINAL_STATES.has(record.state)) record.listeners.clear();
  }

  _prune() {
    const now = this.now();
    while (this.terminalOrder.length > 0) {
      const oldestId = this.terminalOrder[0];
      const oldest = this.jobs.get(oldestId);
      if (!oldest) {
        this.terminalOrder.shift();
        continue;
      }
      const terminalCount = this.terminalOrder.length;
      if (oldest.expiresAt > now && terminalCount <= this.maxResults) break;
      this.terminalOrder.shift();
      this.jobs.delete(oldestId);
      oldest.listeners.clear();
      this.counters.expired += 1;
    }
  }
}

function normalizeOwner(ownerId) {
  if (typeof ownerId !== 'string' || ownerId.trim() === '') {
    throw new TypeError('ownerId must be a non-empty string');
  }
  return ownerId.trim();
}

function positiveInteger(value, fallback, name) {
  const selected = value === undefined ? fallback : value;
  if (!Number.isInteger(selected) || selected < 1) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return selected;
}

function cloneImmutable(value) {
  if (value === null || value === undefined) return value;
  const cloned = typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
  return deepFreeze(cloned);
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function immutableError(error) {
  return deepFreeze({
    name: String(error?.name || 'Error'),
    code: error?.code ? String(error.code) : null,
    message: String(error?.message || error || 'Compile job failed'),
    statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : 500,
  });
}

module.exports = {
  CompileJobRegistry,
  CompileJobRegistryError,
  CompileJobNotFoundError,
  CompileJobForbiddenError,
  CompileJobConflictError,
  TERMINAL_STATES,
};
