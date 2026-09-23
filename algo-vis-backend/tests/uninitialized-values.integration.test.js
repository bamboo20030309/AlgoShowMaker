const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

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
