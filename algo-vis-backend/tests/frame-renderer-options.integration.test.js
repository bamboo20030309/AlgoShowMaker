/**
 * 測試模組：frame-renderer-options.integration.test
 *
 * 驗證重點：frame renderer options.integration.test 相關功能的公開行為、回歸條件與錯誤邊界。
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
test('a global array frame inside main keeps visibility and renderer options', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;

int n = 100;
vector<int> isprime(n + 5, 1);
vector<int> prime;

int main() {
  cin >> n;
  //@frame isprime with range(0,n-1), columns(10), labels(index)
  return 0;
}`, '30\n');

  assert.equal(trace.frames.length, 1);
  const frame = trace.frames[0];
  const idByName = Object.fromEntries(
    Object.entries(trace.variables).map(([id, variable]) => [variable.name, id])
  );

  assert.equal(frame.source.function, 'main');
  assert.equal(frame.source.primaryVariableId, idByName.isprime);
  assert.deepEqual(
    JSON.parse(JSON.stringify(frame.rendererOptions[idByName.isprime])),
    { range: [0, 30], columns: 10, indexMode: 2 }
  );
  assert.deepEqual(
    [...frame.captureOnlyVariableIds].sort(),
    [idByName.n]
  );
  assert.equal(Object.prototype.hasOwnProperty.call(frame.state, idByName.prime), false);
});

test('@frame with consecutive @object lines keeps independent object settings', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;

int n = 20;
vector<int> isprime(n, 1);
vector<int> prime = {2, 3, 5, 7};

int main() {
  // @frame
  // @object isprime with range(0,n-1), columns(10), labels(index) at canvas.top offset(0,80)
  // @object prime with columns(10), labels(value) at isprime.bottom offset(0,60)
  return 0;
}`);

  assert.equal(trace.frames.length, 1);
  const frame = trace.frames[0];
  const idByName = Object.fromEntries(
    Object.entries(trace.variables).map(([id, variable]) => [variable.name, id])
  );

  assert.equal(frame.source.primaryVariableId, idByName.isprime);
  assert.deepEqual(
    JSON.parse(JSON.stringify(frame.rendererOptions)),
    {
      [idByName.isprime]: { range: [0, 20], columns: 10, indexMode: 2 },
      [idByName.prime]: { columns: 10, indexMode: 0 }
    }
  );
  assert.deepEqual([...frame.captureOnlyVariableIds], [idByName.n]);
  assert.equal(frame.objectBindings.length, 2);
  const primeBinding = frame.objectBindings.find(binding => binding.sourceVariableId === idByName.prime);
  assert.equal(primeBinding.targetVariableId, idByName.isprime);
  assert.equal(primeBinding.anchor, 'bottom');
  assert.equal(primeBinding.offsetY, 60);
});

test('one @object target list applies the same renderer options to every object', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  int n = 4;
  deque<int> a = {1, 2, 3, 4};
  deque<int> b;
  deque<int> c;
  // @frame
  // @object a, b, c render disk with capacity(n)
  return 0;
}`);
  const frame = trace.frames[0];
  const idByName = Object.fromEntries(
    Object.entries(trace.variables).map(([id, variable]) => [variable.name, id])
  );
  assert.deepEqual(frame.source.primaryVariableId, idByName.a);
  assert.deepEqual(JSON.parse(JSON.stringify(frame.renderers)), {
    [idByName.a]: 'original-disk',
    [idByName.b]: 'original-disk',
    [idByName.c]: 'original-disk'
  });
  assert.deepEqual(JSON.parse(JSON.stringify(frame.rendererOptions)), {
    [idByName.a]: { capacity: 4 },
    [idByName.b]: { capacity: 4 },
    [idByName.c]: { capacity: 4 }
  });
  assert.deepEqual([...frame.captureOnlyVariableIds], [idByName.n]);
});

test('blank @frame when emits only matching multi-object frames', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  int n = 10;
  vector<int> isprime(n + 1, 1);
  vector<int> prime = {2, 3};
  int prime_idx = 0;
  for (int i = 1; i <= 4; i++) {
    int v = 2;
    // @frame when i%v==0
    // @object isprime[i] with range(1,n), columns(10), labels(index)
    // @object prime with columns(10), labels(value)
    // @place prime.top-left at isprime.bottom-left offset(0,60)
    // @style isprime[i,i*prime[prime_idx+1]] highlight
    // @arrow from isprime[i] to prime[prime_idx] color rgba(255, 0, 0, 0.7) width 3
  }
  return 0;
}`);

  assert.equal(trace.frames.length, 2);
  const idByName = Object.fromEntries(
    Object.entries(trace.variables).map(([id, variable]) => [variable.name, id])
  );
  assert.deepEqual(JSON.parse(JSON.stringify(
    trace.frames.map(frame => frame.state[idByName.i]?.data?.value)
  )), [2, 4]);
  for (const frame of trace.frames) {
    assert.equal(frame.source.when?.expression, 'i%v==0');
    assert.equal(frame.source.primaryVariableId, idByName.isprime);
    assert.equal(frame.rendererOptions[idByName.isprime]?.columns, 10);
    assert.equal(frame.rendererOptions[idByName.isprime]?.indexMode, 2);
    assert.equal(frame.styles.length, 1);
    assert.equal(frame.arrows.length, 1);
    assert.equal(frame.objectBindings.length, 1);
    assert.ok(frame.captureOnlyVariableIds.includes(idByName.v));
    assert.ok(frame.captureOnlyVariableIds.includes(idByName.n));
  }
});

test('blank @frame when creates a conditional scene checkpoint without an object', async () => {
  const { findFrameDirectives } = require('../trace-instrumenter');
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int i = 1;
  // @frame when i > 0
  return 0;
}`;
  const [frame] = findFrameDirectives(source);
  assert.equal(frame.objects.length, 0);
  assert.equal(frame.when.expression, 'i > 0');
  assert.equal(frame.variables.some(variable => variable.name === 'i'), true);
  const { trace } = await compile(source);
  assert.equal(trace.frames.length, 1);
  assert.equal(trace.frames[0].source.primaryVariableId, '');
  assert.equal(trace.frames[0].snapshotIds.length, 0);
});
