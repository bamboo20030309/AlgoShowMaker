const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Worker } = require('node:worker_threads');

class TraceAnalysisQueueError extends Error {
  constructor(message = 'Trace analysis queue is full') {
    super(message);
    this.name = 'TraceAnalysisQueueError';
    this.code = 'TRACE_ANALYSIS_QUEUE_FULL';
    this.statusCode = 503;
  }
}

class TraceAnalysisPool {
  constructor({ size = 1, maxPending = 150, workerPath } = {}) {
    this.size = size;
    this.maxPending = maxPending;
    this.workerPath = workerPath || path.join(__dirname, 'trace-analysis-worker.js');
    this.pending = [];
    this.workers = [];
    this.closed = false;
    for (let index = 0; index < size; index += 1) this._spawn();
  }

  analyze(code) {
    if (this.closed) return Promise.reject(new Error('Trace analysis pool is closed'));
    if (this.pending.length >= this.maxPending) throw new TraceAnalysisQueueError();
    return new Promise((resolve, reject) => {
      this.pending.push({ id: randomUUID(), code, resolve, reject });
      this._drain();
    });
  }

  snapshot() {
    return {
      workers: this.workers.length,
      active: this.workers.filter(entry => entry.job).length,
      pending: this.pending.length,
      maxPending: this.maxPending,
    };
  }

  async close() {
    this.closed = true;
    const error = new Error('Trace analysis pool is closed');
    for (const job of this.pending.splice(0)) job.reject(error);
    await Promise.all(this.workers.map(entry => entry.worker.terminate()));
    this.workers = [];
  }

  _spawn() {
    if (this.closed) return;
    const entry = { worker: new Worker(this.workerPath), job: null };
    entry.worker.on('message', message => this._finish(entry, message));
    entry.worker.on('error', error => this._failWorker(entry, error));
    entry.worker.on('exit', code => {
      if (!this.closed && code !== 0) this._failWorker(entry, new Error(`Trace analysis worker exited with code ${code}`));
    });
    this.workers.push(entry);
  }

  _finish(entry, message) {
    const job = entry.job;
    if (!job || message.id !== job.id) return;
    entry.job = null;
    if (message.error) {
      const error = new Error(message.error.message);
      error.name = message.error.name || 'Error';
      job.reject(error);
    } else {
      job.resolve(message.result);
    }
    this._drain();
  }

  _failWorker(entry, error) {
    const index = this.workers.indexOf(entry);
    if (index < 0) return;
    this.workers.splice(index, 1);
    if (entry.job) entry.job.reject(error);
    entry.job = null;
    if (!this.closed) this._spawn();
    this._drain();
  }

  _drain() {
    for (const entry of this.workers) {
      if (entry.job || this.pending.length === 0) continue;
      entry.job = this.pending.shift();
      entry.worker.postMessage({ id: entry.job.id, code: entry.job.code });
    }
  }
}

module.exports = { TraceAnalysisPool, TraceAnalysisQueueError };
