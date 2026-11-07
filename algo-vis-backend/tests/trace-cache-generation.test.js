'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb');
const Storage=require('../public/slides-storage'),Store=require('../public/slide-trace-store');
function provenance(){const c={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/trace-provenance.js'),'utf8'),c);return c.ASMTraceProvenance;}
test('portable generation changes for runtime dependencies, not UI or line endings',t=>{
 const {dependencies,generationFingerprint}=require('../trace-generation');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'asm-fingerprint-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const f of dependencies){fs.mkdirSync(path.dirname(path.join(root,f)),{recursive:true});fs.writeFileSync(path.join(root,f),'line1\nline2\n');}
 const before=generationFingerprint(root);fs.writeFileSync(path.join(root,'public/slides.js'),'UI changed');assert.equal(generationFingerprint(root),before);
 fs.writeFileSync(path.join(root,dependencies[0]),'line1\r\nline2\r\n');assert.equal(generationFingerprint(root),before);
 fs.appendFileSync(path.join(root,'lib/ASMTrace.hpp'),'runtime changed');assert.notEqual(generationFingerprint(root),before);
});
test('source, input, old generation and missing provenance are distinguished without relabeling',()=>{
 const api=provenance();api.configure({generationFingerprint:'a'.repeat(64)});
 const trace={schemaVersion:'1.0',frames:[{}],provenance:api.create('code','input')};
 assert.equal(api.status(trace,'code','input').kind,'current');
 assert.equal(api.status(trace,'changed','input').kind,'dirty');
 api.configure({generationFingerprint:'b'.repeat(64)});
 assert.equal(api.status(trace,'code','input').kind,'outdated');
 assert.equal(trace.provenance.generationFingerprint,'a'.repeat(64));
 delete trace.provenance.generationFingerprint;assert.equal(api.status(trace,'code','input').kind,'outdated');
});
test('stale cached ID is never returned; shared recovery updates ID and survives save/reopen',async()=>{
 const api=provenance();api.configure({generationFingerprint:'b'.repeat(64)});
 const client=Storage.create(new IDBFactory(),null);
 const old={schemaVersion:'1.0',frames:[{old:true}],provenance:{...api.create('code','input'),generationFingerprint:'a'.repeat(64)},studio:{eventSettings:{readHighlightEnabled:false},codePanelFontSize:19}};
 const trace={schemaVersion:'1.0',frames:[{new:true}],provenance:api.create('code','input')};
 const animation={code:'code',input:'input',traceDocument:old,traceView:{studio:{eventSettings:{readHighlightEnabled:false},codePanelFontSize:19}}};
 let runs=0;const states=[];let store;
 const options={status:(t,a)=>api.status(t,a.code,a.input),onState:(a,s)=>states.push(s.kind)};
 store=Store.create(Storage,client,null,async a=>{
  runs++;await new Promise(r=>setTimeout(r,10));return{...a,traceDocument:{...trace,...a.traceView}};
 },options);
 const detached=await store.detachDeck({groups:[{slides:[{animation}]}]});
 const saved=detached.groups[0].slides[0].animation,oldID=saved.traceRef;
 const [a,b]=await Promise.all([store.materializeAnimation(saved),store.materializeAnimation(saved)]);
 assert.equal(runs,1);assert.equal(a.traceDocument.frames[0].new,true);assert.deepEqual(a,b);
 const result=await store.detachDeck({groups:[{slides:[{animation:a}]}]});
 assert.notEqual(result.groups[0].slides[0].animation.traceRef,oldID);
 await client.saveDeck('updated',JSON.stringify(result),store.retainedKeys());
 const reopened=await client.loadDeck('updated');
 const materialized=await Store.create(Storage,client,null,()=>{throw Error('must use new cache');},options).materializeDeck(reopened);
 assert.equal(materialized.groups[0].slides[0].animation.traceDocument.frames[0].new,true);
 assert.equal(materialized.groups[0].slides[0].animation.traceDocument.studio.eventSettings.readHighlightEnabled,false);
 assert.ok(states.includes('outdated')&&states.includes('updating'));assert.equal(states.at(-1),'current');
});
