/**
 * 每個 `/compile` 請求必須擁有獨立的 debug_log，即使多個請求的 Promise、
 * timer 與 child-process 型回呼交錯執行，也不能互相清除或混入訊息。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  getCompileDebugMessages,
  logCompileDebug,
  runWithCompileContext,
} = require('../compile-context');

const delay = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

test('parallel async compile contexts keep debug messages isolated', async () => {
  const requestA = runWithCompileContext(async () => {
    logCompileDebug('A:start');
    await delay(20);
    logCompileDebug('A:end', { pid: 101 });
    return getCompileDebugMessages();
  });

  const requestB = runWithCompileContext(async () => {
    logCompileDebug('B:start');
    await delay(5);
    logCompileDebug('B:end', { pid: 202 });
    return getCompileDebugMessages();
  });

  const [messagesA, messagesB] = await Promise.all([requestA, requestB]);

  assert.deepEqual(messagesA.map(entry => entry.msg), ['A:start', 'A:end']);
  assert.deepEqual(messagesB.map(entry => entry.msg), ['B:start', 'B:end']);
  assert.equal(messagesA[1].pid, 101);
  assert.equal(messagesB[1].pid, 202);
  assert.ok(messagesA.every(entry => typeof entry.time === 'string'));
  assert.ok(messagesB.every(entry => typeof entry.time === 'string'));
});

test('a later compile context does not reset an earlier pending context', async () => {
  let releaseFirst;
  const firstCanFinish = new Promise(resolve => { releaseFirst = resolve; });

  const first = runWithCompileContext(async () => {
    logCompileDebug('first:before');
    await firstCanFinish;
    logCompileDebug('first:after');
    return getCompileDebugMessages();
  });

  const second = await runWithCompileContext(async () => {
    logCompileDebug('second:only');
    return getCompileDebugMessages();
  });

  releaseFirst();
  const firstMessages = await first;

  assert.deepEqual(firstMessages.map(entry => entry.msg), ['first:before', 'first:after']);
  assert.deepEqual(second.map(entry => entry.msg), ['second:only']);
});

test('logging outside a compile context is discarded', () => {
  assert.equal(logCompileDebug('orphan'), false);
  assert.deepEqual(getCompileDebugMessages(), []);
});
