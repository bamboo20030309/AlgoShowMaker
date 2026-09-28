const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findFrameDirectives } = require('../trace-instrumenter');

test('disk renderer accepts a captured capacity expression', () => {
  const [frame] = findFrameDirectives(`
#include <deque>
int main() {
  int n = 4;
  std::deque<int> peg;
  // @frame peg render disk with capacity(n)
}
`);
  assert.equal(frame.renderer, 'original-disk');
  assert.equal(frame.rendererOptions.capacity.expression, 'n');
  assert.deepEqual(frame.rendererOptions.capacity.identifiers, ['n']);
  assert.ok(frame.captureOnlyVariableIds.some(id => id.includes(':n@')));
});
