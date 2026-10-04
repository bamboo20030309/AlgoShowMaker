const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('bitwise results honor destination narrowing and auto deduction', {timeout: 30000}, async () => {
  const {trace} = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  unsigned char x = 1;
  int y = 256;
  // @frame bits(x, 16), bits(y, 16)
  x |= y;
  // @frame bits(x, 16), bits(y, 16)
  x = x | y;
  // @frame bits(x, 16), bits(y, 16)
  unsigned char z = x | y;
  auto result = x | y;
  // @frame bits(x, 16), bits(y, 16), bits(z, 16), bits(result, 16)
}`);
  const operations = trace.frames.flatMap(f => f.events).filter(e => e.bitwise);
  assert.deepEqual(Array.from(operations, e => e.payload.after.value), [1, 1, 1, 257]);
});

test('nested compound RHS preserves the original lhs and C++ precedence', {timeout: 30000}, async () => {
  const {trace} = await compile(`#include <bits/stdc++.h>
int main() {
  int x = 8, y = 3, z = 6;
  // @frame bits(x, 4), bits(y, 4), bits(z, 4)
  x |= (y & z);
  // @frame bits(x, 4), bits(y, 4), bits(z, 4)
}`);
  const operations = trace.frames.flatMap(f => f.events).filter(e => e.bitwise);
  assert.deepEqual(Array.from(operations, e => [e.bitwise.operator, e.payload.left.value,
    e.payload.right.value, e.payload.after.value]), [['&', 3, 6, 2], ['|', 8, 2, 10]]);
  assert.equal(operations[1].bitwise.rightIntermediate, true);
  const x = Object.keys(trace.variables).find(id => trace.variables[id].name === 'x');
  assert.equal(trace.frames.at(-1).state[x].data.value, 10);
});
