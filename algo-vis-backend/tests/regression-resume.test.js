const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  acquireRegressionLock,
  applyAnimationSummary,
  filesForAttempt,
  hasManualAnimationScope,
  prepareTestState,
  readTestState,
  recordFileResult,
  writeTestState
} = require('../scripts/regression');

function withTemporaryState(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'asm-regression-resume-'));
  try {
    return run(path.join(directory, 'state.json'));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('test cycle selects all, then only failed and remaining files, and fresh resets it', () => {
  withTemporaryState(stateFile => {
    const files = ['tests/a.test.js', 'tests/b.test.js', 'tests/c.test.js'];
    const state = readTestState(files, { fresh: true, stateFile });
    assert.deepEqual(filesForAttempt(state), files);

    recordFileResult(state, files[0], true);
    recordFileResult(state, files[1], false);
    state.status = 'failed';
    writeTestState(state, stateFile);
    const resumed = readTestState(files, { stateFile });
    assert.deepEqual(filesForAttempt(resumed), [files[1], files[2]]);

    recordFileResult(resumed, files[1], true);
    recordFileResult(resumed, files[2], true);
    resumed.status = 'complete';
    writeTestState(resumed, stateFile);
    assert.deepEqual(filesForAttempt(readTestState(files, { stateFile })), []);

    const fresh = readTestState(files, { fresh: true, stateFile });
    assert.deepEqual(filesForAttempt(fresh), files);
  });
});

test('adding a test schedules the new file without discarding unchanged passing files', () => {
  withTemporaryState(stateFile => {
    const files = ['tests/a.test.js'];
    const state = readTestState(files, { fresh: true, stateFile });
    recordFileResult(state, files[0], true); state.status = 'complete';
    writeTestState(state, stateFile);
    const resumed = readTestState([...files, 'tests/b.test.js'], { stateFile });
    assert.deepEqual(resumed.passedFiles, files);
    assert.deepEqual(filesForAttempt(resumed), ['tests/b.test.js']);
  });
});

test('new animation inventory is pending while malformed inventory still fails clearly', () => {
  withTemporaryState(stateFile => {
    const files = ['tests/a.test.js'];
    const state = readTestState(files, { fresh: true, stateFile });
    state.animation.expectedItems.pop();
    writeTestState(state, stateFile);
    const resumed = readTestState(files, { stateFile });
    assert.ok(resumed.animation.expectedItems.length > state.animation.expectedItems.length);
    for (const status of ['complete', 'failed']) {
      const previous = readTestState(files, { fresh: true, stateFile });
      const added = previous.animation.expectedItems.pop();
      previous.animation.status = status;
      previous.animation.passedItems = [...previous.animation.expectedItems];
      writeTestState(previous, stateFile);
      const updated = readTestState(files, { stateFile });
      assert.equal(updated.animation.status, 'failed');
      assert.ok(updated.animation.failedCases.includes(added));
      assert.deepEqual(updated.animation.passedItems, previous.animation.passedItems);
    }
    assert.doesNotThrow(() => readTestState(files, { fresh: true, stateFile }));
    const missing = readTestState(files, { fresh: true, stateFile });
    delete missing.animation.expectedItems;
    writeTestState(missing, stateFile);
    assert.throws(() => readTestState(files, { stateFile }), /動畫驗證案例清單已改變.*--fresh/);
  });
});

test('fresh scoped setup persists a pending release cycle atomically', () => {
  withTemporaryState(stateFile => {
    const files = ['tests/a.test.js'];
    assert.equal(hasManualAnimationScope({ ASM_ANIMATION_CASES: 'bubble' }), true);
    const state = prepareTestState(files, { fresh: true, stateFile });
    assert.equal(state.animation.status, 'pending');
    assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).animation.status, 'pending');
    assert.deepEqual(fs.readdirSync(path.dirname(stateFile)), [path.basename(stateFile)]);
  });
});

test('regression lock rejects a concurrent owner and can be reacquired after release', () => {
  withTemporaryState(stateFile => {
    const lockFile = path.join(path.dirname(stateFile), 'regression-state.lock');
    const release = acquireRegressionLock(lockFile);
    try {
      assert.throws(() => acquireRegressionLock(lockFile), /另一個 regression 正在執行/);
    } finally {
      release();
    }
    const releaseAgain = acquireRegressionLock(lockFile);
    releaseAgain();
    assert.equal(fs.existsSync(lockFile), false);
  });
});

test('animation cycle remains incomplete until every expected item passes', () => {
  const animation = {
    status: 'pending',
    expectedItems: ['cloud-storage-browser', 'bubble', 'heap'],
    passedItems: [],
    failedCases: [],
    failedPrerequisites: [],
    retryAll: false,
    attempts: []
  };
  applyAnimationSummary(animation, [
    { label: 'cloud-storage-browser', pass: false },
    { label: 'bubble-runtime', pass: true }
  ]);
  assert.equal(animation.status, 'failed');
  assert.deepEqual(animation.failedPrerequisites, ['cloud-storage-browser']);
  assert.deepEqual(animation.failedCases, ['heap']);
  assert.deepEqual(animation.passedItems, ['bubble']);

  applyAnimationSummary(animation, [
    { label: 'cloud-storage-browser', pass: true },
    { label: 'heap-runtime', pass: true }
  ]);
  assert.equal(animation.status, 'complete');
  assert.deepEqual(animation.failedPrerequisites, []);
  assert.deepEqual(animation.failedCases, []);
  assert.deepEqual(animation.passedItems, ['bubble', 'cloud-storage-browser', 'heap']);
});

test('manual animation selectors are recognized as a scoped run', () => {
  assert.equal(hasManualAnimationScope({}), false);
  assert.equal(hasManualAnimationScope({ ASM_ANIMATION_CASES: 'bubble' }), true);
  assert.equal(hasManualAnimationScope({ ASM_ANIMATION_PREREQUISITES: 'none' }), true);
});
