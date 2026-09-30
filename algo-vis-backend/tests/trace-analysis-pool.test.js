const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TraceAnalysisPool, TraceAnalysisQueueError } = require('../trace-analysis-pool');

test('trace analysis runs outside the main event loop and returns serializable directives', async () => {
  const pool = new TraceAnalysisPool({ size: 1, maxPending: 2 });
  try {
    const result = await pool.analyze('int main(){ int x=1; // @frame x\n}');
    assert.equal(result.success, true);
    assert.equal(result.variables.some(variable => variable.name === 'x'), true);
    assert.equal(result.frameDirectives.length, 1);
    assert.deepEqual(pool.snapshot(), { workers: 1, active: 0, pending: 0, maxPending: 2 });
  } finally {
    await pool.close();
  }
});

test('analysis errors reject only their job and the worker accepts the next source', async () => {
  const pool = new TraceAnalysisPool({ size: 1 });
  try {
    await assert.rejects(pool.analyze(null));
    const result = await pool.analyze('int main(){}');
    assert.equal(result.success, true);
  } finally {
    await pool.close();
  }
});

test('bounded pending queue rejects excess work', async () => {
  const pool = new TraceAnalysisPool({ size: 1, maxPending: 0 });
  try {
    assert.throws(() => pool.analyze('int main(){}'), TraceAnalysisQueueError);
  } finally {
    await pool.close();
  }
});
