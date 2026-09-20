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

test('Segment_Tree_easy query animation starts from a completed tree and preserves output', async()=>{
  const {code,result,trace}=await runSample('Segment_Tree_easy');
  assert.doesNotMatch(code,/AV\.hpp|\bAV\s+av\b|frame_draw|key_frame_draw|colored_text|_draw_/);
  assert.match(code,/@preset query_view[\s\S]*@object tree render heap[\s\S]*@object sum render cell/);
  assert.match(code,/@segment tree\[1\]\[L-Tmask:R-Tmask\].*with split\(now\)/);
  assert.match(code,/with split\(now,after\)/);
  assert.match(code,/sum \+= tree\[now\]/);
  assert.match(code,/build_tree\(\)[\s\S]*@frame use query_view[\s\S]*@events animate off/);
  assert.doesNotMatch(code,/@preset build_view|讀入第|left_child_sum|right_child_sum/);
  assert.doesNotMatch(code,/左右結果合併|tree\[now\] = rule/);
  assert.doesNotMatch(code,/@style tree\[now\] (?:highlight,point|highlight)\s+AV_/);
  assert.equal(result.output.trim().replace(/\r\n?/g,'\n'),'27\n3\n119\n120\n8\n5\n17');
  assert.ok(trace.frames.some(frame=>Object.values(frame.renderers||{}).includes('original-heap')));
  assert.ok(trace.frames.some(frame=>(frame.segments||[]).some(segment=>segment.cellRange)));
  assert.equal(trace.frames.filter(frame=>frame.source?.function==='build_tree').length,0,
    'silent initialization does not create construction frames');
  assert.equal(trace.frames.some(frame=>(frame.arrows||[]).length>0),false,
    'the query animation does not contain construction arrows');
});

test('Segment_Tree_easy_build is a complete standalone construction animation', async()=>{
  const {code,result,trace}=await runSample('Segment_Tree_easy_build');
  assert.doesNotMatch(code,/AV\.hpp|\bAV\s+av\b|frame_draw|key_frame_draw|colored_text|_draw_/);
  assert.match(code,/@preset build_view[\s\S]*@object tree render heap with range\(1,Tcapacity\)/);
  assert.match(code,/讀入第 \$\{i-\(Tsize-n\)\+1\} 個值/);
  assert.match(code,/tree\[i\] = tree\[left\] \+ tree\[right\]/);
  assert.match(code,/@arrow from tree\[left\] to tree\[i\][\s\S]*@arrow from tree\[right\] to tree\[i\]/);
  assert.doesNotMatch(code,/void\s+query\s*\(|@segment|@object sum/);
  assert.equal(result.output.trim(),'');
  const buildFrames=trace.frames.filter(frame=>frame.source?.function==='build');
  assert.equal(buildFrames.length,32,
    'initial tree, 15 leaf inputs, 15 parent sums and the completed tree each have a frame');
  assert.equal(buildFrames.filter(frame=>(frame.arrows||[]).length===2).length,15,
    'each parent sum shows arrows from both child nodes');
  const treeId=Object.keys(trace.variables).find(id=>trace.variables[id].name==='tree');
  assert.equal(Number(buildFrames.at(-1).state[treeId].data.items[1].value),120);
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
