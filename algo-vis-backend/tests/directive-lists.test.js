const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findFrameDirectives, findArrowDirectives, findPlaceDirectives } = require('../trace-instrumenter');

test('pointer lists expand all combinations in authored order with shared color', () => {
  const [frame] = findFrameDirectives(`void f(){int a[8],b[8];int j=1;
// @frame a,b
// @pointer j,j+1 at a,b color rgba(12,34,56,0.5)
}`);
  assert.deepEqual(frame.bindings.map(b => [b.label, b.targetName, b.indexExpression]), [
    ['j','a','j'], ['j','b','j'], ['j+1','a','j+1'], ['j+1','b','j+1']
  ]);
  assert.ok(frame.bindings.every(b => b.pointerColor === 'rgba(12,34,56,0.5)'));
});

test('pointer lists retain matrix axes, explicit indices and preset settings', () => {
  const [frame] = findFrameDirectives(`// @preset view
// @object dp render matrix with labels(none)
// @pointer i,i+1 at dp.row,dp.column color AV_blue
// @endpreset
void f(){int dp[4][4];int i=1;
// @frame use view
// @pointer i,i+1 at dp.row[0]
}`);
  assert.deepEqual(frame.bindings.map(b => [b.label,b.pointerAxis,b.indexExpression]), [
    // 保留既有的直接指令／preset 收集順序，各列表內仍按書寫順序展開。
    ['i','row','0'],['i+1','row','0'],
    ['i','row','i'],['i','column','i'],['i+1','row','i+1'],['i+1','column','i+1']
  ]);
  assert.equal(frame.objects[0].rendererOptions.labels.showValue, false);
});

test('arrow lists expand all endpoints without splitting nested indices, offsets or colors', () => {
  const source = '// @arrow from a[p[j-1]].bottom offset(0,8),a[1] to b[0],b[1] as "links" color rgb(1,2,3) dash 6,4';
  const arrows = findArrowDirectives(source);
  assert.equal(arrows.length,4);
  assert.deepEqual(arrows.map(a => [a.fromTarget.indexExpressions[0],a.toTarget.indexExpressions[0]]),
    [['p[j-1]','0'],['p[j-1]','1'],['1','0'],['1','1']]);
  assert.equal(new Set(arrows.map(a => a.id)).size,4);
  assert.deepEqual(arrows.map(a => a.id),findArrowDirectives(source).map(a => a.id));
  assert.equal(arrows[0].fromTarget.offsetY,8);
  assert.equal(arrows[0].style.dash,'6,4');
  assert.equal(arrows[0].style.color,'rgb(1,2,3)');
});

test('presets retain every expanded arrow and place source', () => {
  const [frame] = findFrameDirectives(`// @preset view
// @object a,b
// @place a.top,b.top at canvas.top offset(0,20)
// @arrow from a[0],a[1] to b[0],b[1] as "links"
// @endpreset
void f(){int a[2],b[2];
// @frame use view
}`);
  assert.equal(frame.arrows.length,4);
  assert.equal(new Set(frame.arrows.map(a => a.id)).size,4);
  assert.deepEqual(frame.placeBindings.map(b => b.sourceName),['a','b']);
  assert.ok(frame.placeBindings.every(b => b.offsetY === 20));
});

test('empty items and conflicting place destinations fail with a line-specific warning', () => {
  for (const directive of ['@pointer i, at a','@pointer i at a,,b','@pointer i at a,',
    '@arrow from a, to b','@arrow from a to b,,c','@place a, at canvas.top']) {
    assert.throws(() => findFrameDirectives(`void f(){int a[2],b[2],c[2],i=0;\n// @frame a,b,c\n// ${directive}\n}`), /第 3 行.*列表無效/);
  }
  assert.throws(() => findPlaceDirectives('// @place a at b.top,c.top'), /只能有一個定位目標/);
});

test('existing target lists keep commas inside transforms, display strings and style selections', () => {
  const [frame] = findFrameDirectives(`void f(){int a[4],b[4];int i=1;
// @frame bits(a,4),b
// @style a[i,i+1],b[0] highlight,point
// @exit a,b
}`);
  assert.equal(frame.objects[0].displayVariableIds.length,2);
  assert.equal(frame.styles.length,4);
});
