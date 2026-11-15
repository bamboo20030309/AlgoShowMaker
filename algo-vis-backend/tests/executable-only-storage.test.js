'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb');
const Storage=require('../public/slides-storage'),Recipe=require('../public/animation-recipe');
const animation={mode:'trace',code:'int main(){}',input:'4',traceRef:'a'.repeat(64),traceView:{studio:{eventSettings:{autoFixedEnabled:false,readHighlightEnabled:false},codePanelFontSize:0},rules:[],skins:{custom:'red'}},executableRef:{id:'b'.repeat(64)}};
const deck=a=>({groups:[{slides:[{id:'old',kind:'algorithm-animation',animation:a}]}]});
test('recipe migration drops result IDs but preserves source, input, custom values and explicit false',async()=>{
 const a=Recipe.deck(deck(animation)).groups[0].slides[0].animation;
 assert.equal(a.traceRef,undefined);assert.equal(a.code,animation.code);assert.equal(a.input,'4');assert.equal(a.rebuild.view.studio.eventSettings.autoFixedEnabled,false);assert.equal(a.traceView.studio.codePanelFontSize,0);assert.equal(a.executableRef.id,'b'.repeat(64));assert.equal(animation.traceRef,'a'.repeat(64));
 const projected=await Storage.project(deck({...animation,traceDocument:{frames:[{}],studio:animation.traceView.studio}}));assert.deepEqual(projected.references,[]);assert.deepEqual(projected.traces,{});assert.equal(projected.deck.groups[0].slides[0].animation.traceDocument,undefined);
});
test('runtime results disappear on reopening storage; drafts survive save and reopen',async()=>{
 const idb=new IDBFactory(),client=Storage.create(idb,null,'recipe-new'),trace={frames:[{value:2}]},key=await Storage.digest(Storage.canonical(trace));
 await client.putTrace(key,trace);await client.saveDeck('d',JSON.stringify(deck({...animation,traceDocument:trace})));assert.deepEqual(await client.loadTrace(key),trace);
 const reopened=Storage.create(idb,null,'recipe-new');assert.equal(await reopened.loadTrace(key),null);const restored=await reopened.loadDeck('d');assert.equal(restored.groups[0].slides[0].animation.traceRef,undefined);assert.equal(restored.groups[0].slides[0].animation.traceView.studio.eventSettings.readHighlightEnabled,false);
});
test('version 1 IndexedDB drafts are migrated and old result store is emptied',async()=>{
 const idb=new IDBFactory();const db=await new Promise((resolve,reject)=>{const r=idb.open('recipe-old',1);r.onupgradeneeded=()=>{r.result.createObjectStore('decks');r.result.createObjectStore('traces');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise((resolve,reject)=>{const tx=db.transaction(['decks','traces'],'readwrite');tx.objectStore('decks').put({deck:deck({...animation,traceView:undefined}),references:[{groupIndex:0,slideIndex:0,key:animation.traceRef,view:animation.traceView}]},'d');tx.objectStore('traces').put({frames:[{}]},animation.traceRef);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
 const loaded=await Storage.create(idb,null,'recipe-old').loadDeck('d'),a=loaded.groups[0].slides[0].animation;assert.equal(a.traceRef,undefined);assert.equal(a.traceView.studio.eventSettings.autoFixedEnabled,false);
 const again=await new Promise(resolve=>{const r=idb.open('recipe-old',2);r.onsuccess=()=>resolve(r.result);});const count=await new Promise(resolve=>{const r=again.transaction('traces').objectStore('traces').count();r.onsuccess=()=>resolve(r.result);});assert.equal(count,0);again.close();
});
test('cloud projection never uploads runtime or supplemental Trace results',async()=>{
 const Cloud=require('../public/slides-cloud'),result=await Cloud.project(deck(animation),Storage,null,{old:{frames:[{}]}}),snapshot=JSON.parse(result.resources[result.snapshot]);assert.deepEqual(snapshot.references,[]);assert.equal(Object.keys(result.resources).length,1);assert.ok(!JSON.stringify(result).includes('"frames"'));
});
test('all published decks and default source are executable-only, including historical archives',()=>{
 const fs=require('node:fs'),path=require('node:path'),{readPackage}=require('./helpers/deck-package');
 for(const name of fs.readdirSync('public/guest-decks').filter(name=>name.endsWith('.asmdeck'))){const data=readPackage(fs.readFileSync(path.join('public/guest-decks',name)));assert.deepEqual(data.body.prebuiltTraces||{},{});for(const slide of data.body.deck.groups.flatMap(g=>g.slides||[]))if(slide.animation){assert.equal(slide.animation.traceDocument,undefined,name);assert.equal(slide.animation.traceRef,undefined,name);assert.ok(slide.animation.code?.trim(),name);}}
 const manifest=require('../public/default-animation/manifest.json');assert.ok(manifest.animation.code.trim());assert.equal(manifest.full,undefined);assert.equal(manifest.preview,undefined);
});

test('source-less legacy results are refused without mutating the original payload',()=>{
 const source=deck({traceDocument:{frames:[{}]}}),before=JSON.stringify(source);
 assert.throws(()=>Recipe.deck(source),error=>error.code==='ANIMATION_SOURCE_UNAVAILABLE');assert.equal(JSON.stringify(source),before);
 const recovered=Recipe.deck(deck({traceDocument:{sourceCode:'int main(){}',frames:[{}]}}));assert.equal(recovered.groups[0].slides[0].animation.code,'int main(){}');
});
