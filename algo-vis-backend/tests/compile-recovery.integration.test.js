'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const { startIsolatedServer } = require('./helpers/isolated-server');

function client(base) {
  let cookie = '';
  return async (url, init = {}) => {
    const response = await fetch(base + url, { ...init, signal: AbortSignal.timeout(45000),
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...init.headers } });
    const next = response.headers.get('set-cookie'); if (next) cookie = next.split(';')[0];
    return { status: response.status, body: await response.json() };
  };
}
async function submit(owner, code) {
  const response = await owner('/api/compile/jobs', { method: 'POST', body: JSON.stringify({ code: `${code}\n// ${randomUUID()}`, input: '', trace: { enabled: false, watches: [] } }) });
  assert.equal(response.status, 202, JSON.stringify(response.body)); return response.body;
}
async function result(owner, job) {
  for (let i = 0; i < 600; i++) {
    const response = await owner(job.statusUrl);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    if (response.body.state === 'completed') return (await owner(job.resultUrl)).body;
    assert.ok(!['failed','cancelled'].includes(response.body.state), JSON.stringify(response.body));
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail('compile job did not finish');
}
const normal = marker => `#include <iostream>\nint main(){std::cout<<"${marker}";}`;
async function assertDrained(base, directory) {
  const q = await (await fetch(`${base}/api/compile/queue`)).json();
  assert.equal(q.active + q.pending + q.asyncJobs.running + q.asyncJobs.queued + q.resultStreams.active, 0, JSON.stringify(q));
  const executionDir = path.join(directory, 'executions');
  for (let i = 0; i < 30; i++) {
    if (!fs.existsSync(executionDir) || fs.readdirSync(executionDir).length === 0) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.deepEqual(fs.readdirSync(executionDir), [], 'temporary execution files are reclaimed');
}

test('CE/TLE/OLE/MLE release resources and let another owner finish with independent messages', { timeout: 180000 }, async t => {
  const { base, directory } = await startIsolatedServer(t, { COMPILE_CONCURRENCY: '1', ASYNC_COMPILE_DISPATCH_CONCURRENCY: '1' });
  const bad = client(base), good = client(base);
  const cases = [
    ['CE', '#error ASM_RECOVERY_BAD_OWNER\nint main(){}'],
    ['TLE', 'int main(){for(;;){}}'],
    ['OLE', '#include <iostream>\nint main(){for(int i=0;i<100000;i++)std::cout<<"0123456789";}'],
    ['MLE', '#include <vector>\nint main(){std::vector<char> a(400ULL*1024*1024); for(auto &v:a)v=1;}']
  ];
  for (const [verdict, code] of cases) await t.test(verdict, { skip: verdict === 'MLE' && process.platform === 'win32' ? 'Linux ulimit contract; verify with npm run validate:backend-linux' : false }, async () => {
    const failedJob = await submit(bad, code);
    const nextJob = await submit(good, normal(`ASM_RECOVERY_GOOD_${verdict}`));
    assert.equal((await good(failedJob.statusUrl)).status, 403, 'cross-owner status is private');
    const failure = await result(bad, failedJob);
    assert.equal(failure.verdict, verdict, JSON.stringify(failure));
    const next = await result(good, nextJob);
    assert.equal(next.verdict, 'OK'); assert.equal(next.output, `ASM_RECOVERY_GOOD_${verdict}`);
    assert.ok(!JSON.stringify(next.debug_log).includes('ASM_RECOVERY_BAD_OWNER'));
    for (const entry of failure.debug_log || []) if (entry.pid) {
      // A reported watchdog process must already have closed before the slot is reused.
      assert.throws(() => process.kill(entry.pid, 0), /ESRCH/, `child ${entry.pid} is still present`);
    }
    await assertDrained(base, directory);
  });
});

test('queued cancellation and queue overflow do not prevent later normal work', { timeout: 90000 }, async t => {
  const { base, directory } = await startIsolatedServer(t, { COMPILE_CONCURRENCY: '1', ASYNC_COMPILE_DISPATCH_CONCURRENCY: '1', COMPILE_MAX_QUEUED: '1' });
  const a = client(base), b = client(base), c = client(base);
  const blocker = await submit(a, 'int main(){for(;;){}}');
  let running = false;
  for (let i = 0; i < 200; i++) {
    const q = await (await fetch(`${base}/api/compile/queue`)).json();
    if (q.active === 1) { running = true; break; }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(running, 'blocker actually entered the compile worker');
  const queued = await submit(b, normal('CANCELLED_MUST_NOT_RUN'));
  assert.equal((await b(queued.statusUrl)).body.state, 'queued');
  const overflow = await c('/api/compile/jobs', { method: 'POST', body: JSON.stringify({ code: normal('overflow'), trace: { enabled: false } }) });
  assert.equal(overflow.status, 429);
  assert.equal((await b(`/api/compile/jobs/${queued.jobId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await b(queued.statusUrl)).body.state, 'cancelled');
  assert.equal((await b(queued.resultUrl)).status, 409);
  assert.equal((await result(a, blocker)).verdict, 'TLE');
  assert.equal((await result(c, await submit(c, normal('RECOVERED')))).output, 'RECOVERED');
  await assertDrained(base, directory);
});
