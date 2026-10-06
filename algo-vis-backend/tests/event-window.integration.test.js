/**
 * 驗證 manual frame 之外的事件區間：第一幀前的事件歸入第一幀，
 * 程式正常結束時，最後一幀後的事件歸入最後一幀。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('events before the first frame and after the final frame remain traceable', async () => {
  const code = String.raw`
#include <bits/stdc++.h>
using namespace std;

int main() {
  int value = 1;
  // @frame value
  value = 2;
  return 0;
}
`;
  const { trace } = await compile(code);
  assert.equal(trace.frames.length, 1);
  const events = trace.frames[0].events;
  assert.deepEqual(Array.from(events, event => event.type), [
    'function-enter', 'declare', 'assign',
    'assign', 'return', 'return-complete', 'scope-exit', 'function-exit'
  ]);
  assert.deepEqual(Array.from(events, event => event.order), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(events[1].source?.text, 'int value = 1');
  assert.equal(events[2].source?.text, 'value = 1');
  assert.equal(events[3].source?.text, 'value = 2');
  assert.equal(events[3].payload?.before?.value, 1);
  assert.equal(events[3].payload?.after?.value, 2);
  assert.equal(events[6].targets?.[0]?.variableId, trace.frames[0].source.primaryVariableId);
});
