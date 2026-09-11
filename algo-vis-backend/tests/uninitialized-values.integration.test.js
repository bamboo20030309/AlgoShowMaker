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
