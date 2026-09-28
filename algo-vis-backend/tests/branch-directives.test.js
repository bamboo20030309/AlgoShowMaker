const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findBranchDirectives, instrumentSource } = require('../trace-instrumenter');

const source = `
// @layout recursion as tree
void recurse(int n) {
  // @frame n in tree
  if (!n) return;
  recurse(n - 1);
  // @branch as "Move" in tree
  // @frame n
  // @frame n
  // @endbranch
  recurse(n - 1);
}
`;

test('@branch is structural, inherits its recursion layout, and remains separate from @frame', () => {
  const result = instrumentSource(source);
  assert.deepEqual(result.branchDirectives.map(item => item.type), ['start', 'end']);
  assert.equal(result.branchDirectives[0].label, 'Move');
  assert.equal(result.frameDirectives[1].layoutId, 'tree');
  assert.equal(result.frameDirectives[2].layoutId, 'tree');
  assert.match(result.code, /event_branch_start\([^;]+"Move", "tree"\)/);
  assert.match(result.code, /event_branch_end\(/);
  assert.equal((result.code.match(/event_branch_start/g) || []).length, 1);
  assert.equal((result.code.match(/"manual-frame"/g) || []).length, 3);
});

test('@branch validates layout, frame ownership, and explicit closing', () => {
  assert.throws(() => findBranchDirectives(`
// @layout recursion as tree
void f() {
  // @endbranch
}
`), /找不到作用中的/);
  assert.throws(() => findBranchDirectives(`
// @layout recursion as tree
void f() {
  // @branch as "Move" in tree
  // @endbranch
}
`), /至少需要一個 @frame/);
  assert.throws(() => findBranchDirectives(`
// @layout recursion as tree
void f() {
  // @branch as "Move" in missing
  // @frame
}
`), /找不到遞迴排版 ID/);
});
