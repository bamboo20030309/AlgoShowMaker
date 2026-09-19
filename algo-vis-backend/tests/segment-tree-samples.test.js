const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function runSample(name) {
  const base=process.env.ASM_TEST_BASE_URL;
  assert.ok(base,'set ASM_TEST_BASE_URL to an isolated server');
  const code=fs.readFileSync(path.join(__dirname,'../algorithm_sample/Tree',`${name}.cpp`),'utf8');
  const input=fs.readFileSync(path.join(__dirname,'../algorithm_sample/Tree',`${name}-sample_input.txt`),'utf8');
  const analyze=await fetch(base+'/trace/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});
  const analysis=await analyze.json();
  assert.equal(analyze.ok,true,JSON.stringify(analysis));
  const watches=[...new Set(analysis.frameDirectives.flatMap(frame=>frame.variableIds))];
  const response=await fetch(base+'/compile',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    code,input,trace:{enabled:true,watches,sliceMode:'manual'}
  })});
  const result=await response.json();
  assert.equal(response.ok,true,JSON.stringify(result));
  assert.equal(result.error,'',result.error);
  return {code,result,trace:result.traceDocument};
}

test('Segment_Tree_easy uses heap directives and preserves query output', async()=>{
  const {code,result,trace}=await runSample('Segment_Tree_easy');
  assert.doesNotMatch(code,/AV\.hpp|\bAV\s+av\b|frame_draw|key_frame_draw|colored_text|_draw_/);
  assert.match(code,/@preset query_view[\s\S]*@object tree render heap[\s\S]*@object sum render cell/);
  assert.match(code,/@segment tree\[1\]\[L-Tmask:R-Tmask\].*with split\(now\)/);
  assert.match(code,/with split\(now,after\)/);
  assert.match(code,/sum \+= tree\[now\]/);
  assert.doesNotMatch(code,/左右結果合併|tree\[now\] = rule/);
  assert.doesNotMatch(code,/@style tree\[now\] (?:highlight,point|highlight)\s+AV_/);
  assert.equal(result.output.trim().replace(/\r\n?/g,'\n'),'27\n3\n119\n120\n8\n5\n17');
  assert.ok(trace.frames.some(frame=>Object.values(frame.renderers||{}).includes('original-heap')));
  assert.ok(trace.frames.some(frame=>(frame.segments||[]).some(segment=>segment.cellRange)));
});

test('Segment_Tree uses original arrays as fields and preserves lazy/set algorithm output', async()=>{
  const {code,result,trace}=await runSample('Segment_Tree');
  assert.doesNotMatch(code,/AV\.hpp|\bAV\s+av\b|frame_draw|key_frame_draw|colored_text|_draw_modify|_draw_segment/);
  assert.match(code,/fields\(tree,lazy,sets\), hide\(lazy=0,sets=LM\)/);
  assert.equal(result.output.trim(),'12');
  const treeId=Object.keys(trace.variables).find(id=>trace.variables[id].name==='tree');
  const options=trace.frames.map(frame=>frame.rendererOptions?.[treeId]).find(value=>value?.fields);
  assert.deepEqual(JSON.parse(JSON.stringify(options.fields.names)),['tree','lazy','sets']);
  assert.deepEqual(JSON.parse(JSON.stringify(options.hide.entries)),[
    {field:'lazy',value:'0'},{field:'sets',value:'LM'}
  ]);
});
