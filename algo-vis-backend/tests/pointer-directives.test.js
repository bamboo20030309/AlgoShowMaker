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

test('independent pointers share a view and capture only their dependencies', () => {
  const [frame] = findFrameDirectives(`void f(){int a[3]; int i=0,j=1;
// @frame a
// @pointer i at a
// @pointer j at a[j]
}`);
  assert.equal(frame.bindings.length, 2);
  assert.equal(frame.bindings[0].explicitPointer, true);
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

test('matrix axes infer indices and preserve the authored matrix options', () => {
  const [frame] = findFrameDirectives(`void f(){int dp[2][3];int i=1,j=2;
// @frame dp render matrix with labels(none), marker-layout(none)
// @pointer i at dp.row color AV_blue
// @pointer j at dp.column color #ff0088
}`);
  assert.deepEqual(frame.bindings.map(b => [b.pointerAxis,b.indexDimension,b.indexExpression,b.pointerColor]),
    [['row',0,'i','AV_blue'],['column',1,'j','#ff0088']]);
  assert.equal(frame.rendererOptions.markerLayout,'none');
  assert.deepEqual(frame.rendererOptions.labels, { showValue:false, indexFormat:'none' });
  assert.throws(()=>findFrameDirectives(`void f(){int a[3];int i=0;\n// @frame a\n// @pointer i at a.row\n}`),/必須指定二維矩陣/);
});

test('colors apply to array and every layout pointer selector; invalid colors are explicit errors', () => {
  const source=`// @layout recursion as tree
void f(){int a[3];int i=0;
// @frame a in tree
// @pointer i at a color red
// @pointer i at tree.root color #123456
// @pointer i at tree.children[0] color rgba(1, 2, 3, 0.5)
// @pointer i at tree.current color AV_green!
}`;
  assert.deepEqual(findFrameDirectives(source)[0].bindings.map(b=>b.pointerColor),['red','#123456','rgba(1, 2, 3, 0.5)','AV_green!']);
  assert.throws(()=>findFrameDirectives(source.replace('color red','color not-a-color')),/顏色無效/);
});


test('axis pointers work in composable presets without replacing custom matrix settings', () => {
  const [frame]=findFrameDirectives(`// @preset cursor
// @pointer i at dp.row color orange
// @pointer j at dp.column
// @endpreset
void f(){std::vector<std::vector<int>> dp;int i=0,j=1;
// @frame dp render matrix with labels(value), marker-layout(inner)
// @pointer i at dp.row color orange
// @pointer j at dp.column
}`);
  assert.equal(frame.variables.find(v=>v.name==='dp').kind,'matrix');
  assert.equal(frame.rendererOptions.markerLayout,'inner');
  const [preset]=findFrameDirectives(`// @preset base
// @object dp render matrix with labels(value), marker-layout(inner)
// @endpreset
// @preset cursor
// @pointer i at dp.row color orange
// @pointer j at dp.column
// @endpreset
void f(){int dp[2][3];int i=0,j=1;
// @frame use base, cursor
}`);
  assert.equal(preset.bindings[1].indexDimension,1);
  assert.equal(preset.bindings[0].pointerColor,'orange');
});


test('pointer expressions match object index dependencies and keep their authored labels', () => {
  const [frame] = findFrameDirectives(`void f(){int p[8];int i=3,j=1;
// @frame p
// @pointer i-1 at p
// @pointer i-1 at p color AV_green!
// @pointer i + j at p
// @pointer i-1 at p[i+1]
}`);
  const [object, same, sum, explicit] = frame.bindings;
  assert.equal(same.label,'i-1');
  assert.equal(same.indexExpression,object.indexExpression);
  assert.equal(same.sourceName,object.sourceName);
  assert.deepEqual(same.sourceVariableIds,object.sourceVariableIds);
  assert.equal(same.pointerColor,'AV_green!');
  assert.equal(sum.label,'i + j');
  assert.equal(sum.sourceVariableIds.length,2);
  assert.equal(explicit.label,'i-1');
  assert.equal(explicit.indexExpression,'i+1');
  for (const label of ['i++','i = 2','missing-1']) {
    assert.throws(()=>findFrameDirectives(`void f(){int p[8];int i=3;
// @frame p
// @pointer ${label} at p
}`));
  }
});
