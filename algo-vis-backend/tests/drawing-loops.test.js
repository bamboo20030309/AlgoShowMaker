const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findFrameDirectives, instrumentSource } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');
const arrowModel = require('../public/trace-arrow-model');

test('drawing blocks parse styles, arrows and text with isolated locals and named scopes', () => {
  const code=`int main(){int a[8]={},j=99,n=3;
// @frame a
// @for k in [0:n-1]
// @style a[k] highlight when value==0 && k>0
// @text "k=\${k}" at a[k].top
// @arrow from a[0] to a[k]
// @endfor
// @text "outside"
}`;
  const frame=findFrameDirectives(code)[0];
  for(const item of [frame.styles[0],frame.texts[0],frame.arrows[0]]){
    assert.equal(item.drawLoops[0].variable,'k');
    assert.equal(item.drawLoops[0].endExpression,'n-1');
  }
  assert.equal(frame.texts[1].drawLoops.length,0);
  assert.ok(frame.variables.some(variable=>variable.name==='n'));
  assert.ok(!frame.variables.some(variable=>variable.name==='j' || variable.name==='k'));
  assert.equal((instrumentSource(code).code.match(/::asm_trace::LoopScope /g)||[]).length,0,'manual ranges need no loop instrumentation');
  const forward=code.replace('// @for k in [0:n-1]','// @for k in [0:j]\n// @for j in [0:1]').replace('// @endfor','// @endfor\n// @endfor');
  assert.ok(findFrameDirectives(forward)[0].variables.some(variable=>variable.name==='j'),'outer range captures C++ j before inner local shadows it');
});

test('drawing blocks reject malformed boundaries, C++ statements and non-drawing directives', () => {
  const source=body=>`int main(){int a[8]={};\n// @frame a\n${body}\n}`;
  assert.throws(()=>findFrameDirectives(source('// @endfor')),/必須對應/);
  assert.throws(()=>findFrameDirectives(source('// @for k in [0:2]\n// @style a[k] highlight')),/缺少 @endfor/);
  assert.throws(()=>findFrameDirectives(source('// @for k in [0:2]\na[0]=1;\n// @endfor')),/不可包含 C\+\+/);
  for(const command of ['frame a','events animate off','keep last','camera at a.top']){
    assert.throws(()=>findFrameDirectives(source(`// @for k in [0:2]\n// @${command}\n// @endfor`)),/只支援/);
  }
  assert.throws(()=>findFrameDirectives(source('// @for k in [0:2]\n// @for k in [0:2]\n// @endfor\n// @endfor')),/索引不可重複/);
  assert.throws(()=>findFrameDirectives(source('// @for k in [0:2]\n// @arrow for k in [0:2] from a[0] to a[k]\n// @endfor')),/索引不可與 @for 重複/);
});

test('compiled named block shares actual entries across styles, arrows and text, preserving reload and primes', async () => {
  const code=fs.readFileSync(path.join(__dirname,'fixtures/drawing-loop-sieve.cpp'),'utf8');
  const { trace,window }=await compile(code);
  const compact=trace.frames.filter(frame=>frame.eventControls.length);
  assert.equal(compact.length,23);
  const prime=Object.keys(trace.variables).find(id=>trace.variables[id].name==='prime');
  const isprime=Object.keys(trace.variables).find(id=>trace.variables[id].name==='isprime');
  const frame=compact[1];
  const arrows=window.ASMTraceModel.drawingDirectives(trace,frame,'arrows');
  assert.deepEqual(Array.from(arrows,arrow=>arrow.to.indexExpression),['18','27']);
  const earlierArrows=window.ASMTraceModel.drawingDirectives(trace,compact[0],'arrows');
  assert.equal(arrows[0].id,earlierArrows[0].id,'the same arrow slot persists when loop invocation and arrow count change');
  assert.notEqual(arrows[0].id,arrows[1].id,'different entry slots keep distinct arrow identities');
  const highlights=window.ASMTraceRules.evaluate(trace,frame);
  assert.deepEqual(Object.keys(highlights[prime]),['0','1']);
  assert.deepEqual(Object.keys(highlights[isprime]),['18','27']);
  const texts=window.ASMTraceModel.drawingDirectives(trace,frame,'texts');
  assert.deepEqual(Array.from(texts,text=>text.binding.indexExpression),['0','1']);
  assert.deepEqual(Array.from(texts,text=>text.drawLocals.j),[0,1]);
  assert.notEqual(texts[0].id,texts[1].id);
  const reloaded=window.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(trace)));
  assert.deepEqual(Array.from(window.ASMTraceModel.drawingDirectives(reloaded,reloaded.frames.find(item=>item.id===frame.id),'arrows'),arrow=>arrow.id),Array.from(arrows,arrow=>arrow.id));
  assert.deepEqual(Array.from(trace.frames.at(-1).state[prime].data.items,item=>item.value),[2,3,5,7,11,13,17,19,23,29]);
});

test('style-only while block records repeated entries and nested manual blocks use outer locals', async () => {
  const code=`int main(){int a[8]={},j=3,t=0,n=2;
// @frame a
// @for j
// @style a[j] highlight
// @endfor
while(t++<3){a[j]++;}
// @frame a
// @for k in [0:n] step 1
// @for q in [0:k]
// @style a[q] background AV_green when index==q && value==0
// @arrow from a[k] to a[q] when q!=k
// @text "\${k},\${q}" at a[q].bottom
// @endfor
// @endfor
// @frame a
// @for k in [0:1]
// @arrow for q in [0:1024] from a[0] to a[0]
// @endfor
}`;
  const {trace,window}=await compile(code);
  const repeated=window.ASMTraceModel.drawingDirectives(trace,trace.frames[0],'styles');
  assert.deepEqual(Array.from(repeated,item=>item.drawLocals.j),[3,3,3]);
  assert.equal(new Set(Array.from(repeated,item=>item.id)).size,3);
  const arrows=window.ASMTraceModel.drawingDirectives(trace,trace.frames[1],'arrows');
  assert.deepEqual(Array.from(arrows,item=>[item.from.indexExpression,item.to.indexExpression]),[['1','0'],['2','0'],['2','1']]);
  const texts=window.ASMTraceModel.drawingDirectives(trace,trace.frames[1],'texts');
  assert.equal(texts.length,6);
  const a=Object.keys(trace.variables).find(id=>trace.variables[id].name==='a');
  assert.deepEqual(Object.keys(window.ASMTraceRules.evaluate(trace,trace.frames[1])[a]),['0','1','2']);
  const invalid=JSON.parse(JSON.stringify(trace.frames[1]));
  invalid.styles[0].drawLoops[0].endExpression='2048';
  assert.throws(()=>window.ASMTraceModel.drawingDirectives(trace,invalid,'styles'),/2048/);
  const excessive=window.ASMTraceModel.drawingDirectives(trace,trace.frames[2],'arrows');
  assert.throws(()=>arrowModel.expandBatch(excessive[0],Number),/組合展開數量超過 2048/);
});
