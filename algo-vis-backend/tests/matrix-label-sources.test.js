const{test}=require('node:test'),assert=require('node:assert/strict');
const labels=require('../public/trace-label-sources');
test('label sources preserve offsets through blanks and literals without matching repeated values',()=>{
 const state={S:{name:'S',data:{kind:'string',value:'aba'}},rows:{name:'rows',data:{kind:'sequence',items:[{value:3},{value:3}]}}};
 const spec={mode:'custom',parts:[{type:'blank',count:2},{type:'literal',value:'a'},{type:'variable',variableId:'S',name:'S'},{type:'variable',variableId:'rows',name:'rows'}]};
 const result=labels.resolve(spec,state);
 assert.deepEqual(result.values,['','','a','a','b','a',3,3]);
 assert.deepEqual(result.sources,[null,null,null,{variableId:'S',index:0},{variableId:'S',index:1},{variableId:'S',index:2},{variableId:'rows',index:0},{variableId:'rows',index:1}]);
 assert.deepEqual(labels.resolve({mode:'none',parts:spec.parts},state),{mode:'none',values:[]});
});
test('ambiguous names never guess a label source but explicit scoped IDs remain valid',()=>{
 const state={a:{name:'text',data:{value:'X'}},b:{name:'text',data:{value:'Y'}}};
 assert.deepEqual(labels.resolve({mode:'custom',parts:[{type:'variable',name:'text'}]},state).sources,[]);
 assert.deepEqual(labels.resolve({mode:'custom',parts:[{type:'variable',name:'text',variableId:'b'}]},state).sources,[{variableId:'b',index:0}]);
});

test('old label provenance restores from authored directives but explicit custom or hidden settings are retained',()=>{
 const vm=require('node:vm'),fs=require('node:fs');const c={queueMicrotask(){}};c.window=c;vm.createContext(c);
 for(const file of ['trace-label-sources.js','trace-model.js'])vm.runInContext(fs.readFileSync('public/'+file,'utf8'),c);
 const raw={variables:{S:{name:'S',kind:'string'},dp:{name:'dp',kind:'matrix'}},frameDirectives:[{sourceKey:'labels',rendererOptions:{rowLabels:{mode:'custom',parts:[{type:'literal',value:''},{type:'variable',variableId:'S',name:'S'}]}}}],frames:[{id:'f',source:{directiveKey:'labels'},state:{S:{name:'S',data:{kind:'string',value:'a'}}},rendererOptions:{dp:{rowLabels:{mode:'custom',values:['','a']},columnLabels:{mode:'none',values:[]}}}}]};
 let doc=c.ASMTraceModel.normalizeTraceDocument(raw);
 assert.deepEqual(JSON.parse(JSON.stringify(doc.frames[0].rendererOptions.dp.rowLabels.sources)),[null,{variableId:'S',index:0}]);
 raw.frames[0].rendererOptions.dp.rowLabels.sources=[];
 doc=c.ASMTraceModel.normalizeTraceDocument(raw);assert.deepEqual(JSON.parse(JSON.stringify(doc.frames[0].rendererOptions.dp.rowLabels.sources)),[]);
 assert.equal(doc.frames[0].rendererOptions.dp.columnLabels.mode,'none');
 delete raw.frames[0].rendererOptions.dp.rowLabels.sources;raw.frames[0].rendererOptions.dp.rowLabels.values=['custom','a'];
 doc=c.ASMTraceModel.normalizeTraceDocument(raw);assert.equal(doc.frames[0].rendererOptions.dp.rowLabels.sources,undefined,'custom label values are not rebound by coincidentally equal characters');
});
