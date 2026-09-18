const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

test('comma style lists expand all types with independent defaults, IDs and shared conditions', () => {
  const frame=findFrameDirectives(`int main(){int isprime[8]={},i=2;
// @frame isprime
// @style isprime[i] highlight, point,focus as combined when value==0
// @style isprime[0:1,3] background,mark rgba(1, 2, 3, 0.6)
// @style isprime[4] highlight
}`)[0];
  assert.deepEqual(frame.styles.map(style=>style.styleType),['highlight','point','focus','background','mark','highlight']);
  assert.deepEqual(frame.styles.slice(0,3).map(style=>style.color),['','','AV_grey']);
  assert.deepEqual(frame.styles.slice(0,3).map(style=>style.id),['combined:highlight','combined:point','combined:focus']);
  assert.ok(frame.styles.slice(0,3).every(style=>style.when.expression==='value==0' && style.selector.indexExpression==='i'));
  assert.deepEqual(frame.styles.slice(3,5).map(style=>style.color),['rgba(1, 2, 3, 0.6)','rgba(1, 2, 3, 0.6)']);
  assert.equal(frame.styles[5].id,'style-line-5','single-style identity remains unchanged');
});

test('comma style lists reject missing, unknown and repeated types', () => {
  for(const types of ['highlight,','highlight,,point','highlight,unknown','highlight,highlight']){
    assert.throws(()=>findFrameDirectives(`int main(){int a[3]={};\n// @frame a\n// @style a[0] ${types}\n}`),/格式應為|樣式無效|樣式不可重複/);
  }
});

test('preset list styles retain independent override priority', () => {
  const frame=findFrameDirectives(`// @defaults
// @style a[0] highlight,point AV_blue
// @enddefaults
// @preset colours
// @object a
// @style a[0] background,focus AV_green
// @endpreset
int main(){int a[3]={};
// @frame use colours
// @style a[0] highlight AV_red
}`)[0];
  assert.deepEqual(frame.styles.map(style=>[style.styleType,style.color]),
    [['point','AV_blue'],['background','AV_green'],['focus','AV_green'],['highlight','AV_red']]);
  assert.equal(new Set(frame.styles.map(style=>style.id)).size,4);
});

test('compiled list styles merge on the same cells inside drawing blocks and keep when filtering', async () => {
  const {trace,window}=await compile(`int main(){int a[4]={1,2,3,4};
// @frame a
// @events animate off
// @for k in [0:2]
// @style a[k] highlight,point when value<3
// @endfor
}`);
  const frame=trace.frames[0];
  const a=Object.keys(trace.variables).find(id=>trace.variables[id].name==='a');
  const styles=window.ASMTraceRules.evaluate(trace,frame)[a];
  assert.deepEqual(Object.keys(styles),['0','1']);
  for(const index of ['0','1']){
    assert.deepEqual(Object.keys(styles[index].styleTypes),['highlight','point']);
    assert.notEqual(styles[index].sourceStyleIds.highlight,styles[index].sourceStyleIds.point);
  }
  const reloaded=window.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(trace)));
  assert.equal(JSON.stringify(window.ASMTraceRules.evaluate(reloaded,reloaded.frames[0])),JSON.stringify(window.ASMTraceRules.evaluate(trace,frame)));
});
