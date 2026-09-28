const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const store = require('../trace-chunk-store');
function workspace(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'asm-chunks-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;
}
function write(dir, records) {
 const file=path.join(dir,'trace.jsonl');fs.writeFileSync(file,records.map(JSON.stringify).join('\n')+'\n');return file;
}
const meta={record:'meta',schemaVersion:'2.0'};
const chunk={record:'events',templates:[{type:'assign',line:3,signature:'assign:3',recursionAncestorActivationIds:[]}],events:[
 [0,0,{enabled:false,payload:{before:0,after:1,source:1},text:'中文②\n"'}],
 [1,0,{enabled:true,payload:{before:1,after:2,source:2}}]
]};
const frame={record:'frame',id:'frame-0',source:{line:4},state:{},events:[],eventCount:2};

test('v2 preserves event fields/order and independent gzip chunks support direct access',async t=>{
 const file=write(workspace(t),[meta,chunk,{record:'loop',position:1},frame]);
 const result=await store.read(file);
 assert.equal(result.stats.events,2);assert.equal(result.stats.deduplicatedBytes,fs.statSync(file).size);
 assert.equal(result.stats.compressedBytes,fs.statSync(file+'.chunks.gz').size);
 const decoded=result.records.find(r=>r.record==='frame');
 assert.deepEqual(decoded.events,chunk.events.map(([order,index,fields])=>({id:`event-${order}`,order,...chunk.templates[index],...fields})));
 assert.equal(decoded.eventCount,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(decoded)),decoded);
 const index=JSON.parse(fs.readFileSync(file+'.chunks.gz.index.json','utf8'));
 const random=[];for await(const record of store.readChunks(file+'.chunks.gz',[index.entries[3]]))random.push(record);
 assert.deepEqual(random,[frame]);
});
test('v1 old files and explicit false/zero/custom data survive loading and saving',async t=>{
 const dir=workspace(t);const old=[{record:'meta',schemaVersion:'1.0'},{record:'frame',id:'old',source:{},state:{x:{data:{kind:'scalar',value:0}}},events:[{id:'event-0',order:0,enabled:false,color:'#ff00ff',text:''}]}];
 const result=await store.read(write(dir,old));assert.deepEqual(result.records,old);
 assert.deepEqual((await store.read(write(dir,JSON.parse(JSON.stringify(result.records))))).records,old);
});
test('bad references, incomplete frames, corrupt gzip and resource limits fail explicitly',async t=>{
 const dir=workspace(t);
 await assert.rejects(store.read(write(dir,[meta,{...chunk,events:[[0,99,{}]]},frame])),/參照/);
 await assert.rejects(store.read(write(dir,[meta,chunk,{...frame,eventCount:3}])),/數量不符/);
 await assert.rejects(store.read(write(dir,[meta,chunk,frame]),{...store.LIMITS,events:1}),/事件數量/);
 await assert.rejects(store.read(write(dir,[meta,chunk,frame]),{...store.LIMITS,expanded:10}),/展開大小/);
 await assert.rejects(store.read(write(dir,[meta,chunk,frame]),{...store.LIMITS,file:10}),/檔案大小/);
 await assert.rejects(store.read(write(dir,[meta,chunk,frame]),{...store.LIMITS,record:10}),/單筆/);
 await assert.rejects(store.read(write(dir,[meta,chunk,frame]),{...store.LIMITS,compressed:10}),/壓縮/);
 await assert.rejects(store.read(write(dir,[meta,{record:'error',message:'limit'}])),/追蹤產生失敗/);
 const file=write(dir,[meta,chunk,frame]);const packed=await store.pack(file);
 fs.truncateSync(packed.archive,3);
 await assert.rejects(async()=>{for await(const record of store.readChunks(packed.archive,packed.entries))void record;},/不完整/);
 fs.writeFileSync(file,'{"record":');await assert.rejects(store.read(file),SyntaxError);
});
test('C++ recorder crosses count/byte chunk boundaries and associates events with the next frame',t=>{
 const dir=workspace(t),cpp=path.join(dir,'test.cpp'),exe=path.join(dir,process.platform==='win32'?'test.exe':'test');
 fs.writeFileSync(cpp,`#include "ASMTrace.hpp"
int main(){
 auto& r=asm_trace::recorder();
 for(int i=0;i<2050;i++)r.add_event("assign",3,"same","\\\"enabled\\\":false,\\\"value\\\":"+std::to_string(i));
 r.capture(4,"main","frame-a","manual");
 r.add_event("assign",5,"large","\\\"text\\\":"+asm_trace::quoted(std::string(300000,'x')));
 r.loop_record("\\\"kind\\\":\\\"loop-exit\\\"");
 r.add_event("assign",6,"last","\\\"value\\\":0");
 r.capture(7,"main","frame-b","manual");
}`);
 execFileSync('g++',['-std=c++17',cpp,'-I',path.join(__dirname,'../lib'),'-o',exe],{windowsHide:true,timeout:30000});
 const file=path.join(dir,'trace.jsonl');execFileSync(exe,[],{env:{...process.env,ASM_TRACE_FILE:file},windowsHide:true,timeout:10000});
 return store.read(file).then(result=>{
  const frames=result.records.filter(r=>r.record==='frame');assert.equal(frames.length,2);
  assert.equal(frames[0].events.length,2050);assert.equal(frames[1].events.length,2);
  frames[0].events.forEach((event,i)=>{assert.equal(event.order,i);assert.equal(event.value,i);assert.equal(event.enabled,false);});
  assert.equal(frames[1].events[0].text.length,300000);assert.equal(frames[1].events[1].order,2051);
  const raw=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(raw.filter(r=>r.record==='events').length>=5);
  assert.ok(raw.filter(r=>r.record==='events').every(r=>r.events.length<=1024));
 });
});
test('streamed JSON is identical to JSON.stringify for response contract',()=>{
 const body={error:'',output:'完成',traceDocument:{schemaVersion:'1.0',frames:[{id:'a',events:[{enabled:false,value:0,missing:undefined}],state:{}}],studio:{eventSettings:{autoFixedEnabled:false}}}};
 assert.deepEqual(JSON.parse([...store.jsonParts(body)].join('')),JSON.parse(JSON.stringify(body)));
});
