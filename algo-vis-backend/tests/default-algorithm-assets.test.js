'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const{readPackage}=require('./helpers/deck-package'),{buildDefaultAlgorithmAssets}=require('../scripts/build/default-algorithm-assets');
test('standalone default contains only linear-sieve source/settings and native executable ID',()=>{
 const manifest=require('../public/default-animation/manifest.json'),a=manifest.animation;
 assert.equal(manifest.packageVersion,2);assert.equal(a.input,'100');assert.equal(a.traceDocument,undefined);assert.equal(a.traceRef,undefined);assert.equal(manifest.preview,undefined);assert.equal(manifest.full,undefined);assert.match(a.executableRef.id,/^[a-f0-9]{64}$/);
 const deck=readPackage(fs.readFileSync('public/guest-decks/linear-sieve.asmdeck')).body.deck,source=deck.groups.flatMap(g=>g.slides).find(s=>s.animation).animation;
 assert.equal(a.code,source.code);assert.ok(!fs.readdirSync('public/default-animation').some(n=>n.endsWith('.asmtrace')));
});
test('default builder writes a recipe manifest without preview or full result assets',async t=>{
 const target=fs.mkdtempSync(path.join(os.tmpdir(),'asm-default-recipe-'));t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
 const deck=readPackage(fs.readFileSync('public/guest-decks/linear-sieve.asmdeck')).body.deck,manifest=await buildDefaultAlgorithmAssets(deck,{publicRoot:target});
 assert.deepEqual(fs.readdirSync(path.join(target,'default-animation')),['manifest.json']);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target,'default-animation/manifest.json'))),manifest);
});
