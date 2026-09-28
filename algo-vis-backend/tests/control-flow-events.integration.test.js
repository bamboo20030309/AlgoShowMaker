const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('break and continue preserve control flow while recording code-only events', async () => {
  assert.ok(process.env.ASM_TEST_BASE_URL, 'set ASM_TEST_BASE_URL to an isolated server');
  const { trace } = await compile(`
int main() {
  int sum = 0;
  for (int i = 0; i < 5; ++i) {
    if (i == 1) continue;
    if (i == 3) break;
    sum += i;
  }
  // @frame sum
  return 0;
}
`);
  const sum = Object.values(trace.frames[0].state).find(entry => entry.name === 'sum');
  assert.equal(Number(sum.data.value), 2);
  const events = trace.frames.flatMap(frame => frame.events || []);
  assert.equal(events.filter(event => event.type === 'continue').length, 1);
  assert.equal(events.filter(event => event.type === 'break').length, 1);
  assert.equal(events.find(event => event.type === 'continue').controlTarget, 'for-update');
  assert.equal(events.find(event => event.type === 'break').controlTarget, 'loop-exit');
});
