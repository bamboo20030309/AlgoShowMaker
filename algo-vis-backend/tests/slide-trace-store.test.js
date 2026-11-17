'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{IDBFactory}=require('fake-indexeddb');
const Storage=require('../public/slides-storage'),TraceStore=require('../public/slide-trace-store'),Recipe=require('../public/animation-recipe');
const original=()=>({groups:[{slides:[{animation:{mode:'trace',code:'int main(){}',input:'2',traceDocument:{frames:[{state:{arr:[1,2]}}],studio:{eventSettings:{autoFixedEnabled:false}},skins:{arr:{color:'#123456'}},rules:[]}}}]}]});
test('inline results detach into session memory; reopening keeps only source and explicit settings',async()=>{
 const idb=new IDBFactory(),client=Storage.create(idb,null),traces=TraceStore.create(Storage,client),source=original(),detached=await traces.detachDeck(source);
 assert.equal(detached.groups[0].slides[0].animation.traceDocument,undefined);assert.deepEqual(await traces.materializeDeck(detached),source);
 await client.saveDeck('local',JSON.stringify(detached));const next=Storage.create(idb,null),saved=await next.loadDeck('local');assert.equal(await next.loadTrace(detached.groups[0].slides[0].animation.traceRef),null);assert.equal(saved.groups[0].slides[0].animation.traceView.studio.eventSettings.autoFixedEnabled,false);assert.equal(saved.groups[0].slides[0].animation.traceRef,undefined);
});
test('metadata saves and undo preserve source independently of runtime results',async()=>{
 const client=Storage.create(new IDBFactory(),null),traces=TraceStore.create(Storage,client),detached=await traces.detachDeck(original());
 await client.saveDeck('d',JSON.stringify({groups:[]}));await client.saveDeck('d',JSON.stringify(detached));const saved=await client.loadDeck('d');assert.deepEqual(saved,Recipe.deck(detached));assert.deepEqual((await Storage.project(detached)).references,[]);assert.deepEqual(await traces.uploadTraces([]),{});
});
test('runtime reads are coalesced and never consult old cloud result endpoints',async()=>{
 const client=Storage.create(new IDBFactory(),null);let fetches=0,reads=0;const traces=TraceStore.create(Storage,client,async()=>{fetches++;throw Error('obsolete endpoint');}),detached=await traces.detachDeck(original()),load=client.loadTrace;client.loadTrace=async key=>{reads++;return load(key);};
 const [a,b]=await Promise.all([traces.materializeDeck(detached),traces.materializeDeck(detached)]);assert.deepEqual(a,b);assert.equal(reads,1);assert.equal(fetches,0);
});
test('a new page cannot access another page runtime results; unrelated saves cannot delete live results',async()=>{
 const db=new IDBFactory(),first=Storage.create(db,null),other=Storage.create(db,null),staged=await TraceStore.create(Storage,other).detachDeck(original()),key=staged.groups[0].slides[0].animation.traceRef;
 await first.saveDeck('unrelated',JSON.stringify({groups:[]}));assert.ok(await other.loadTrace(key));assert.equal(await first.loadTrace(key),null);
});
test('missing results execute once per session revision and execute again after reopening',async()=>{
 const db=new IDBFactory(),client=Storage.create(db,null),animation=Recipe.strip(original().groups[0].slides[0].animation);let runs=0;
 const recover=async a=>{runs++;return{...a,traceDocument:{frames:[{id:'fresh'}],...a.traceView}};};
 const store=TraceStore.create(Storage,client,null,recover),[a,b]=await Promise.all([store.materializeAnimation(animation),store.materializeAnimation(animation)]);assert.deepEqual(a,b);assert.equal(runs,1);await client.saveDeck('d',JSON.stringify({groups:[{slides:[{animation}]}]}));
 const reopened=Storage.create(db,null),loaded=await TraceStore.create(Storage,reopened,null,recover).materializeDeck(await reopened.loadDeck('d'));assert.equal(runs,2);assert.equal(loaded.groups[0].slides[0].animation.traceDocument.studio.eventSettings.autoFixedEnabled,false);
});
test('failed execution does not loop on navigation; explicit retry starts a new attempt',async()=>{
 let runs=0;const animation={code:'bad source',traceRef:'b'.repeat(64)},store=TraceStore.create(Storage,Storage.create(new IDBFactory(),null),null,async()=>{runs++;throw Error('compile failed');});
 await assert.rejects(store.materializeAnimation(animation),/compile failed/);await assert.rejects(store.materializeAnimation(animation),/compile failed/);assert.equal(runs,1);store.retry(animation);await assert.rejects(store.materializeAnimation(animation),/compile failed/);assert.equal(runs,2);
});


test('manual RUN executable ID survives detach, save and reopen without a result payload',async()=>{
 const client=Storage.create(new IDBFactory(),null),store=TraceStore.create(Storage,client),source=original();source.groups[0].slides[0].animation.traceDocument.executableRef={id:'e'.repeat(64)};const detached=await store.detachDeck(source);assert.equal(detached.groups[0].slides[0].animation.executableRef.id,'e'.repeat(64));await client.saveDeck('d',JSON.stringify(detached));const saved=await client.loadDeck('d');assert.equal(saved.groups[0].slides[0].animation.executableRef.id,'e'.repeat(64));assert.equal(saved.groups[0].slides[0].animation.traceDocument,undefined);
});
