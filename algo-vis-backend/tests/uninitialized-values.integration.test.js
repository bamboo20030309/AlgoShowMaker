/**
 * 測試模組：uninitialized-values.integration.test
 *
 * 驗證重點：uninitialized values.integration.test 相關功能的公開行為、回歸條件與錯誤邊界。
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
test('unassigned scalar variables render as an empty cell instead of captured stack garbage', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int empty;
  // @frame empty
  return 0;
}`;
  const { trace } = await compile(source);
  const variableId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'empty');
  assert.ok(variableId);
  assert.deepEqual(
    JSON.parse(JSON.stringify(trace.frames[0].state[variableId].data)),
    { kind: 'scalar', value: '' }
  );
});

test('stream input marks a previously unassigned scalar as initialized before capture', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n;
  cin >> n;
  // @frame n
  return 0;
}`;
  const { trace } = await compile(source, '17\n');
  const variableId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'n');
  assert.ok(variableId);
  assert.equal(trace.frames[0].state[variableId].data.value, 17);
});

test('stream input in a while condition is initialized before the body frame', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int L, R;
  while (cin >> L >> R) {
    // @frame L,R
  }
  return 0;
}`;
  const { trace } = await compile(source, '2 8\n4 7\n');
  const variable = name => Object.entries(trace.variables)
    .find(([, item]) => item.name === name && item.functionName === 'main')?.[0];
  const leftId = variable('L');
  const rightId = variable('R');
  assert.ok(leftId && rightId);
  assert.deepEqual(Array.from(trace.frames, frame => [
    Number(frame.state[leftId].data.value),
    Number(frame.state[rightId].data.value)
  ]), [[2, 8], [4, 7]]);
});
