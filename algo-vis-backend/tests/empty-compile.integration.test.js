'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { startIsolatedServer } = require('./helpers/isolated-server');

async function post(base, route, body) {
  const response = await fetch(base + route, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
  });
  return { status: response.status, data: await response.json() };
}
async function assertAliveAndDrained(base, child) {
  assert.equal(child.exitCode, null, 'server must remain running');
  const response = await fetch(base + '/api/compile/queue');
  assert.equal(response.status, 200);
  const queue = await response.json();
  assert.equal(queue.active, 0);
  assert.equal(queue.pending, 0);
}
test('empty, whitespace and invalid source cannot terminate direct or queued compile service', { timeout: 60000 }, async t => {
  const { base, child } = await startIsolatedServer(t);
  for (const route of ['/compile', '/api/compile/jobs']) {
    for (const code of ['', ' \t\r\n ', undefined, null, 123, {}]) {
      const { status, data } = await post(base, route, { code, input: '', trace: { enabled: true } });
      assert.equal(status, 400, `${route}: ${JSON.stringify(code)}`);
      assert.match(data.error, typeof code === 'string' ? /程式碼不能為空白/ : /code 必須是字串/);
      if (typeof code === 'string') assert.equal(data.code, 'EMPTY_SOURCE');
      await assertAliveAndDrained(base, child);
    }
  }
  const result = await post(base, '/compile', {
    code: '#include <iostream>\nint main(){std::cout<<"ALIVE_AFTER_EMPTY";}',
    input: '', trace: { enabled: false }
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.verdict, 'OK');
  assert.equal(result.data.output, 'ALIVE_AFTER_EMPTY');
  await assertAliveAndDrained(base, child);
});
test('a rejected compile preparation Promise returns JSON and releases its queue slot', { timeout: 60000 }, async t => {
  const preload = path.join(__dirname, 'fixtures/compile-preparation-fault.cjs');
  const { base, child } = await startIsolatedServer(t, { NODE_OPTIONS: `--require ${JSON.stringify(preload)}`, COMPILE_CONCURRENCY: '1' });
  const result = await post(base, '/compile', { code: 'int main(){} // ASM_TEST_PREPARATION_FAILURE', trace: { enabled: false } });
  assert.equal(result.status, 500);
  assert.equal(result.data.code, 'COMPILE_PREPARATION_ERROR');
  assert.ok(result.data.debug_log.some(entry => entry.msg.includes('injected cache-key preparation failure')));
  await assertAliveAndDrained(base, child);
  const normal = await post(base, '/compile', { code: 'int main(){return 0;}', trace: { enabled: false } });
  assert.equal(normal.status, 200);
  assert.equal(normal.data.verdict, 'OK');
  await assertAliveAndDrained(base, child);
});
