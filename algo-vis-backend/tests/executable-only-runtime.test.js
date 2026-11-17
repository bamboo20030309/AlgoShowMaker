'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startIsolatedServer}=require('./helpers/isolated-server');
const code='#include <iostream>\nusing namespace std;\nint main(){int a;cin>>a;\n// @frame a\ncout<<a;return 0;\n}';
test('native cache hit executes new input and never stores reusable Trace results',{timeout:90000},async t=>{
 const {base,directory}=await startIsolatedServer(t);
 const analysis=await(await fetch(base+'/trace/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})})).json();assert.ok(analysis.variables?.length,JSON.stringify(analysis));
 async function run(input){const response=await fetch(base+'/compile',{method:'POST',headers:{'content-type':'application/json','X-Compile-Cache':'shared'},body:JSON.stringify({code,input,trace:{enabled:true,watches:analysis.variables,rules:[],skins:{}}})});assert.equal(response.status,200);return response.json();}
 const first=await run('7'),second=await run('9');assert.equal(first.error,"",first.error);assert.equal(second.error,"",second.error);assert.equal(first.output,'7');assert.equal(second.output,'9');assert.equal(first.cache.executable,'MISS');assert.equal(second.cache.executable,'HIT');assert.equal(second.cache.trace,'DISABLED');assert.ok(second.traceDocument.frames.length);assert.equal(second.traceDocument.executableRef.id,second.cache.executableId);
 assert.equal(fs.readdirSync(path.join(directory,'artifacts','trace')).length,0);assert.ok(fs.readdirSync(path.join(directory,'artifacts','executable')).length>0);
});



test('coalesced viewers each receive a transient result before transport is deleted',{timeout:90000},async t=>{
 const{base,directory}=await startIsolatedServer(t);
 const client=()=>{let cookie='';return async(url,init={})=>{const r=await fetch(base+url,{...init,headers:{'content-type':'application/json',cookie,...init.headers}});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;};};
 const one=client(),two=client(),body=JSON.stringify({code:code+'\n// concurrent '+require('node:crypto').randomUUID(),input:'21',trace:{enabled:true,watches:[]}});
 const [a,b]=await Promise.all([one('/api/compile/jobs',{method:'POST',body}).then(r=>r.json()),two('/api/compile/jobs',{method:'POST',body}).then(r=>r.json())]);
 assert.ok(a.jobId&&b.jobId);assert.notEqual(a.jobId,b.jobId);assert.ok(a.deduplicated||b.deduplicated,'requests share only in-flight execution');
 async function wait(c,j){for(let i=0;i<200;i++){const s=await(await c(j.statusUrl)).json();if(s.state==='completed')return;if(s.state==='failed')assert.fail(JSON.stringify(s));await new Promise(r=>setTimeout(r,30));}assert.fail('job timeout');}
 await Promise.all([wait(one,a),wait(two,b)]);
 const first=await one(a.resultUrl);assert.equal(first.status,200);assert.equal((await first.json()).output,'21');
 const second=await two(b.resultUrl);assert.equal(second.status,200);assert.equal((await second.json()).output,'21');
 const transport=path.join(directory,'artifacts','transport');for(let i=0;i<100&&fs.readdirSync(transport,{recursive:true}).some(n=>/\.(json|bin)$/.test(n));i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(fs.readdirSync(transport,{recursive:true}).filter(n=>/\.(json|bin)$/.test(n)).length,0);
});
