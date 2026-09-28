/**
 * 測試模組：iteration-summary.integration.test
 *
 * 驗證重點：iteration summary.integration.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('iteration.last resolves the completed inner-loop lifetime without creating a visible object', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;

// @preset loop_view
// @object values
// @style values[0:iteration.last(j)] focus
// @endpreset

int main() {
  vector<int> values = {10, 20, 30, 40, 50};
  for (int i=2; i<=4; i++) {
    // @frame use loop_view
    for (int j=0; j<i; j++) {
      // @frame use loop_view
    }
    // @frame use loop_view
  }
  return 0;
}`);

  const framesWithoutJ = trace.frames.filter(frame => !Object.values(frame.state || {})
    .some(entry => entry?.name === 'j'));
  const outerFrames = framesWithoutJ.filter((frame, index) => index % 2 === 0);
  const afterFrames = framesWithoutJ.filter((frame, index) => index % 2 === 1);
  assert.equal(outerFrames.length, 3);
  assert.equal(afterFrames.length, 3);
  assert.deepEqual(
    Array.from(outerFrames, frame => window.ASMTraceRules.resolveExpression(
      trace, frame, 'iteration.last(j)'
    )),
    [1, 2, 3]
  );
  assert.deepEqual(
    Array.from(afterFrames, frame => window.ASMTraceRules.resolveExpression(
      trace, frame, 'iteration.last(j)'
    )),
    [1, 2, 3]
  );
  assert.equal(framesWithoutJ.length, 6);
  assert.ok(trace.frames.every(frame => frame.styles[0]?.selector?.endExpression
    === 'iteration.last(j)'));
  assert.ok(trace.frames.every(frame => !Object.values(frame.state || {})
    .some(entry => entry?.name === 'iteration')));
  assert.equal(Object.prototype.propertyIsEnumerable.call(trace, 'iterationSummaries'), false);
  assert.equal(JSON.stringify(trace).includes('iterationSummaries'), false);
});

test('iteration.last can be used by a style condition and stays scoped to each loop lifetime', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;

int main() {
  vector<int> values = {1, 2, 3, 4, 5};
  for (int i=2; i<=3; i++) {
    // @frame values
    // @style values[0:4] background when index <= iteration.last(j)
    for (int j=0; j<i; j++) {
      // @frame values
      // @style values[0:4] background when index <= iteration.last(j)
    }
  }
  return 0;
}`);

  const valuesId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'values');
  const outerFrames = trace.frames.filter(frame => !Object.values(frame.state || {})
    .some(entry => entry?.name === 'j'));
  assert.deepEqual(Array.from(outerFrames, frame =>
    Object.keys(window.ASMTraceRules.evaluate(trace, frame)[valuesId] || {})), [
    ['0', '1'],
    ['0', '1', '2']
  ]);
});

test('iteration.first resolves the initial value throughout and immediately after a loop lifetime', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int values[9] = {};
int sum(int i) {
  int ans = 0;
  for (; i > 0; i -= i & -i) {
    // @frame values
    // @style values[1:iteration.first(i)] focus
    ans += i;
  }
  // @frame values
  // @style values[1:iteration.first(i)] focus
  return ans;
}
int main() {
  sum(7);
  sum(4);
}`);
  const values = Array.from(trace.frames, frame =>
    window.ASMTraceRules.resolveExpression(trace, frame, 'iteration.first(i)'));
  assert.deepEqual(values, [7, 7, 7, 7, 4, 4]);
});
