const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('@code hide runs C++ and suppresses the whole nested trace', async () => {
  assert.ok(process.env.ASM_TEST_BASE_URL, 'set ASM_TEST_BASE_URL to an isolated server');
  const { trace } = await compile(`
int helper(int& value) {
  value++;
  return value;
}
int main() {
  int value = 0;
  // @code hide
  helper(value);
  // @endcode
  // @frame value
  return 0;
}
`);
  assert.equal(trace.frames.length, 1);
  const valueEntry = Object.values(trace.frames[0].state).find(entry => entry.name === 'value');
  assert.equal(Number(valueEntry.data.value), 1,
    'hidden logic still mutates the real program state');
  const events = trace.frames.flatMap(frame => frame.events || []);
  assert.equal(events.some(event => event.source?.text?.includes('helper(value)')), false);
  assert.equal(events.some(event => event.recursionFunction === 'helper'), false);
});

test('@code hide can wrap a whole function while drawing directives still run', async () => {
  assert.ok(process.env.ASM_TEST_BASE_URL, 'set ASM_TEST_BASE_URL to an isolated server');
  const { trace } = await compile(`
// @code hide
int main() {
  int value = 0;
  value = 7;
  // @frame value
  return 0;
}
// @endcode
`);
  assert.equal(trace.frames.length, 1);
  const valueEntry = Object.values(trace.frames[0].state).find(entry => entry.name === 'value');
  assert.equal(Number(valueEntry.data.value), 7);
  assert.equal(trace.frames[0].events.length, 0,
    'C++ inside the global hide range stays untracked while @frame remains active');
});

test('@frame remains active inside a runtime-suppressed code hide range', async () => {
  assert.ok(process.env.ASM_TEST_BASE_URL, 'set ASM_TEST_BASE_URL to an isolated server');
  const { trace } = await compile(`
int main() {
  int value = 0;
  // @code hide
  value = 9;
  // @frame value
  // @endcode
  return 0;
}
`);
  assert.equal(trace.frames.length, 1);
  const valueEntry = Object.values(trace.frames[0].state).find(entry => entry.name === 'value');
  assert.equal(Number(valueEntry.data.value), 9);
  assert.equal(trace.frames[0].events.some(event => event.source?.text?.includes('value = 9')), false,
    'the hidden assignment emits no event even though its frame is captured');
  assert.equal(trace.codeHideRanges.length, 1,
    'the hidden source range is retained so every code view can omit it');
});
