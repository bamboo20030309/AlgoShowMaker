'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{gzipSync}=require('node:zlib');
const {OfficialExecutables}=require('../official-executables');
const {ArtifactCache,sha256Canonical}=require('../artifact-cache');
const source='int main(){return 0;}';
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'asm-official-cache-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const publicRoot=path.join(root,'public'),sampleRoot=path.join(root,'samples');await fs.mkdir(publicRoot);await fs.mkdir(sampleRoot);await fs.writeFile(path.join(publicRoot,'guest-decks.json'),JSON.stringify({decks:[]}));await fs.writeFile(path.join(sampleRoot,'sample.cpp'),source);
 const registry=new OfficialExecutables({publicRoot,sampleRoot,compiler:'compiler-a',engine:'15/1',checkIntervalMs:0});await registry.refresh();return{root,publicRoot,sampleRoot,registry};
}
test('only exact server-controlled source and bounded watch profiles receive permanent status',async t=>{
 const{registry}=await fixture(t),allVariables=[{id:'a'},{id:'b'}];
 assert.equal(registry.classify(source,{traceEnabled:true,watches:[],allVariables}).official,true);
 assert.equal(registry.classify(source,{traceEnabled:true,watches:['b','a'],allVariables}).official,true);
 assert.equal(registry.classify(source,{traceEnabled:true,watches:['a'],allVariables}).official,false);
 assert.equal(registry.classify(source+' // user edit',{official:true,pinned:true}).official,false);
 assert.equal(registry.classify(source.replace(/\n/g,'\r\n')).official,true);
});
test('existing published executable is rescued from TTL and remains pinned across restart and LRU pressure',async t=>{
 const f=await fixture(t);let now=100;const key=sha256Canonical('published executable');
 const body={body:{deck:{groups:[{slides:[{animation:{code:source,executableRef:{id:key},watches:[]}}]}]}}};
 await fs.writeFile(path.join(f.publicRoot,'sample.asmdeck'),Buffer.concat([Buffer.from('ASMDECK1\n'),gzipSync(JSON.stringify(body))]));await fs.writeFile(path.join(f.publicRoot,'guest-decks.json'),JSON.stringify({decks:[{archive:'/sample.asmdeck'}]}));await f.registry.refresh({force:true});
 const options={rootDir:path.join(f.root,'cache'),now:()=>now,defaultTtlMs:10,maxBytes:100},cache=new ArtifactCache(options);await cache.put('executable',key,'official-binary',{metadata:{compilerFingerprint:'compiler-a',engineFingerprint:'15/1'}});now=500;
 const result=await f.registry.reconcile(cache);assert.equal(result.pinned,1);assert.equal((await cache.lookup('executable',key)).expiresAt,null);
 const restarted=new ArtifactCache({...options,maxBytes:1});await restarted.init();await restarted.prune();assert.equal((await restarted.lookup('executable',key)).pinned,true);
});
test('removed official sources become temporary; manually pinned entries stay untouched',async t=>{
 const f=await fixture(t);let now=100;const cache=new ArtifactCache({rootDir:path.join(f.root,'cache'),now:()=>now,defaultTtlMs:1000,maxBytes:1000});
 const key=sha256Canonical('official'),manual=sha256Canonical('manual');await cache.put('executable',key,'binary',{pinned:true,metadata:{compilerFingerprint:'compiler-a',engineFingerprint:'15/1',...f.registry.classify(source)}});await cache.put('executable',manual,'manual',{pinned:true});
 await fs.unlink(path.join(f.sampleRoot,'sample.cpp'));await f.registry.refresh({force:true});now=500;const result=await f.registry.reconcile(cache);assert.equal(result.unpinned,1);const entry=await cache.lookup('executable',key);assert.equal(entry.pinned,false);assert.equal(entry.expiresAt,1500);assert.equal((await cache.lookup('executable',manual)).pinned,true);now=1501;await cache.prune();assert.equal(await cache.lookup('executable',key),null);
});
test('compiler changes do not pin incompatible binaries',async t=>{
 const f=await fixture(t),cache=new ArtifactCache({rootDir:path.join(f.root,'cache')});const key=sha256Canonical('old compiler');await cache.put('executable',key,'binary',{pinned:true,metadata:{compilerFingerprint:'compiler-old',engineFingerprint:'15/1',...f.registry.classify(source)}});await f.registry.reconcile(cache);assert.equal((await cache.lookup('executable',key)).pinned,false);
});
