'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startIsolatedServer}=require('./helpers/isolated-server');
test('official source reuses permanent executable across inputs; edited user source remains temporary', {timeout:120000}, async t=>{
 const {base,directory}=await startIsolatedServer(t);
 const code=fs.readFileSync(path.join(__dirname,'../algorithm_sample/Sorting/bubble_sort.cpp'),'utf8');
 async function post(endpoint,body){const response=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.ok,true,JSON.stringify(result));assert.ok(!result.error,JSON.stringify(result));return result;}
 await post('/trace/analyze',{code});
 const first=await post('/compile',{code,input:'3\n3 1 2',trace:{enabled:true,watches:[]}});
 assert.equal(first.cache.retention,'official-permanent');assert.equal(first.cache.trace,'DISABLED');
 const second=await post('/compile',{code,input:'3\n2 3 1',trace:{enabled:true,watches:[]}});
 assert.equal(second.cache.executable,'HIT');assert.equal(second.cache.executableId,first.cache.executableId);assert.ok(second.traceDocument);
 const user=await post('/compile',{code:code+'\n// personal edit',input:'3\n2 1 3',official:true,pinned:true,trace:{enabled:true,watches:[]}});
 assert.equal(user.cache.retention,'temporary');
 function metadata(id){return JSON.parse(fs.readFileSync(path.join(directory,'artifacts/executable',id.slice(0,2),id+'.json'),'utf8'));}
 assert.equal(metadata(first.cache.executableId).pinned,true);assert.equal(metadata(first.cache.executableId).expiresAt,null);
 const temporary=metadata(user.cache.executableId);assert.equal(temporary.pinned,false);assert.equal(temporary.expiresAt-temporary.createdAt,168*3600000);
});
