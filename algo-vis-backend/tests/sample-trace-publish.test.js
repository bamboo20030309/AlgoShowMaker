'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
const {startIsolatedServer}=require('./helpers/isolated-server');
global.ASMTraceProvenance=require('../public/trace-provenance');
const A=require('../public/asmdeck');
const code='#include <vector>\nint main(){std::vector<int> a={2,1};\n// @frame a\na[0]=a[1];\n// @frame a\n}';
test('prebuild does not switch a partial release; verified immutable assets publish together', {timeout:60000},async t=>{
 const {base,directory}=await startIsolatedServer(t);const root=path.join(directory,'public');
 await fs.mkdir(path.join(root,'guest-decks'),{recursive:true});await fs.mkdir(path.join(root,'deck-traces'),{recursive:true});
 const catalog={decks:['first','second'].map(id=>({id,archive:`/guest-decks/${id}.asmdeck`}))};
 const original=JSON.stringify(catalog);await fs.writeFile(path.join(root,'guest-decks.json'),original);await fs.writeFile(path.join(root,'deck-traces/index.json'),JSON.stringify({schema:1,traces:{}}));
 const write=async(id,source)=>fs.writeFile(path.join(root,`guest-decks/${id}.asmdeck`),Buffer.from(await(await A.encode({assets:{},deck:{groups:[{slides:[{id,kind:'algorithm-animation',animation:{mode:'trace',code:source,input:'',traceRef:'a'.repeat(64),rebuild:{view:{},globals:{}}}}]}]}})).arrayBuffer()));
 await write('first',code);await write('second','this is not C++');
 const run=async(extra=[])=>{const child=spawn(process.execPath,['scripts/build/prebuild-guest-decks.js','--base-url',base,'--public-root',root,...extra],{cwd:path.resolve(__dirname,'..'),windowsHide:true});let output='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>output+=v);return{status:await new Promise(r=>child.on('exit',r)),output};};
 const failed=await run();assert.notEqual(failed.status,0,failed.output);
 assert.equal(await fs.readFile(path.join(root,'guest-decks.json'),'utf8'),original);
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,'deck-traces/index.json'),'utf8')).traces,{});
 assert.equal((await fs.readdir(path.join(root,'guest-decks'))).length,2,'failed staging creates no public archives');
 await write('second',code);const published=await run(['--rerun']);assert.equal(published.status,0,published.output);
 const updated=JSON.parse(await fs.readFile(path.join(root,'guest-decks.json'),'utf8'));
 for(const entry of updated.decks){assert.match(entry.archive,/-[a-f0-9]{64}\.asmdeck$/);assert.match(entry.trace_generation,/^[a-f0-9]{64}$/);assert.equal(entry.source_archive,`/guest-decks/${entry.id}.asmdeck`);}
 const verified=await run(['--verify-only']);assert.equal(verified.status,0,verified.output);
 const oldArchive=updated.decks[0].archive,oldBytes=await fs.readFile(path.join(root,oldArchive.slice(1)));
 const second=await run(['--only','first','--rerun']);assert.equal(second.status,0,second.output);
 assert.deepEqual(await fs.readFile(path.join(root,oldArchive.slice(1))),oldBytes,'old immutable archive remains available');
});
test('refreshTrace reruns using a compatible executable cache', {timeout:30000},async t=>{
 const {base}=await startIsolatedServer(t);
 const run=async refreshTrace=>{const response=await fetch(base+'/compile',{method:'POST',headers:{'Content-Type':'application/json','X-Compile-Cache':'shared'},body:JSON.stringify({code,input:'',refreshTrace,trace:{enabled:true,sliceMode:'manual',watches:[]}})});const body=await response.json();assert.equal(response.ok,true,JSON.stringify(body));assert.ok(body.traceDocument?.frames?.length);return response;};
 await run(false);const response=await run(true);
 assert.equal(response.headers.get('X-Compile-Trace-Cache'),'REFRESH');assert.equal(response.headers.get('X-Compile-Executable-Cache'),'HIT');
});
