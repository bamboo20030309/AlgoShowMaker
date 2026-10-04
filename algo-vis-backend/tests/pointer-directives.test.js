const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findFrameDirectives } = require('../trace-instrumenter');

test('pointers select roots, current nodes and indexed layout collections', () => {
  const source = `// @layout recursion as tree
void f(){int a[3]; int i=0,depth=1;
// @frame a in tree
// @pointer i at tree.root
// @pointer i at tree.current[i+1]
// @pointer i at tree.nodes[1]
// @pointer i at tree.leaves[0][i+1]
// @pointer i at tree.level(depth)[0]
// @pointer i at tree.side(right)[0]
}`;
  const bindings = findFrameDirectives(source)[0].bindings;
  assert.deepEqual(bindings.map(b => b.layoutTarget.layoutSelector), ['root', 'current', 'nodes', 'leaves', 'level', 'side']);
  assert.deepEqual(bindings.map(b => b.indexExpression), ['i', 'i+1', 'i', 'i+1', 'i', 'i']);
  assert.equal(bindings[4].layoutTarget.layoutLevelExpression, 'depth');
  assert.equal(bindings[5].layoutTarget.layoutSide, 'right');
  assert.throws(() => findFrameDirectives(source.replace('tree.root', 'missing.root')), /找不到 layout/);
});

test('separate pointers coexist with legacy frame pointers and capture only their dependencies', () => {
  const [frame] = findFrameDirectives(`void f(){int a[3]; int i=0,j=1;
// @frame a[i]
// @pointer j at a[j]
}`);
  assert.equal(frame.bindings.length, 2);
  assert.equal(frame.bindings[0].explicitPointer, undefined);
  assert.equal(frame.bindings[1].label, 'j');
  assert.ok(frame.captureOnlyVariableIds.includes(frame.bindings[1].sourceVariableId));
});
test('child pointers retain the local index expression and reject missing layouts or variables', () => {
  const source = `// @layout recursion as tree
void f(){int a[3]; int i=0,L=0;
// @frame a in tree
// @pointer i at tree.children[0][i-L]
}`;
  const binding = findFrameDirectives(source)[0].bindings[0];
  assert.deepEqual(binding.layoutChild, { layoutId: 'tree', childExpression: '0' });
  assert.equal(binding.indexExpression, 'i-L');
  assert.throws(() => findFrameDirectives(source.replace('tree.children', 'missing.children')), /找不到 layout/);
  assert.throws(() => findFrameDirectives(source.replace('[i-L]', '[i-missing]')), /找不到可見變數/);
});
test('presets may contain independent pointers', () => {
  const [frame] = findFrameDirectives(`// @preset view
// @object a
// @pointer i at a[i]
// @endpreset
void f(){int a[3]; int i=0;
// @frame use view
}`);
  assert.equal(frame.bindings[0].label, 'i');
});

test('omitted pointer position uses its own variable while explicit expressions remain unchanged', () => {
  const source = `// @layout recursion as tree
void f(){int a[6]; int i=3;
// @frame a with range(2,4) in tree
// @pointer i at tree.children[0]
// @pointer i at a
// @pointer i at a[i-2]
}`;
  const bindings = findFrameDirectives(source)[0].bindings;
  assert.equal(bindings[0].implicitIndex, true);
  assert.equal(bindings[0].indexExpression, 'i');
  assert.equal(bindings[1].implicitIndex, true);
  assert.equal(bindings[1].indexExpression, 'i');
  assert.equal(bindings[2].implicitIndex, false);
  assert.equal(bindings[2].indexExpression, 'i-2');
});
