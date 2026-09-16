const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

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

test('blank @frame when still requires a consecutive @object', () => {
  const { findFrameDirectives } = require('../trace-instrumenter');
  assert.throws(() => findFrameDirectives(`#include <bits/stdc++.h>
using namespace std;
int main() {
  int i = 1;
  // @frame when i > 0
  return 0;
}`), /至少需要一個緊接的 @object/);
});
