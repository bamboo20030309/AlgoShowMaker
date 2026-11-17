'use strict';
// Legacy packages are generated in memory: official assets deliberately contain
// executable recipes only, while the import decoder still validates old files.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{gzipSync}=require('node:zlib'),{createHash}=require('node:crypto');
function fixture(){
 const c={Blob,Response,DecompressionStream,TextDecoder,Uint8Array,crypto:require('node:crypto').webcrypto,ASMDeck:require('../public/asmdeck')};
 for(const file of ['trace-provenance.js','trace-bundle.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public',file),'utf8'),c);
 const api=c.ASMTraceProvenance,bundle=c.ASMTraceBundle;api.configure({generationFingerprint:'b'.repeat(64)});
 const code='int main(){}',input='';const engine=api.ENGINE_VERSION-1;
 const trace={schemaVersion:'1.0',sourceCode:code,frames:[{id:'f0'},{id:'f1'}],provenance:{...api.create(code,input),engineVersion:engine,generationFingerprint:'a'.repeat(64)},studio:{eventSettings:{autoFixedEnabled:false}}};
 const payload={format:bundle.FORMAT,packageVersion:1,engineVersion:engine+'/1',kind:'full',totalFrames:2,animation:{code,input,traceDocument:trace}};
 function pack(value){const json=JSON.stringify(value),bytes=Buffer.concat([Buffer.from(bundle.MAGIC),gzipSync(json)]);return{blob:new Blob([bytes]),descriptor:{url:'memory.asmtrace',bytes:bytes.length,contentHash:createHash('sha256').update(json).digest('hex')}};}
 const packed=pack(payload),manifest={format:bundle.FORMAT,packageVersion:1,engineVersion:engine+'/1',generationFingerprint:'a'.repeat(64),totalFrames:2,full:packed.descriptor,preview:{url:'memory-preview.asmtrace'}};
 return{api,bundle,payload,packed,manifest,pack};
}
test('a current generation label cannot make legacy payload current',async()=>{const{bundle,packed,manifest}=fixture();await assert.rejects(()=>bundle.decode(packed.blob,packed.descriptor,{...manifest,generationFingerprint:'b'.repeat(64)},'full'),/版本不一致/);});
test('legacy packages remain importable but never enter persistent Trace cache',async()=>{const{bundle,packed,manifest}=fixture();bundle.validateManifest(manifest);const decoded=await bundle.decode(packed.blob,packed.descriptor,manifest,'full');assert.equal(decoded.animation.traceDocument.frames.length,2);assert.equal(decoded.animation.traceDocument.studio.eventSettings.autoFixedEnabled,false);assert.equal(await bundle.cachePut(manifest,decoded),false);assert.equal(await bundle.cacheGet(manifest),null);});
test('future versions, corrupt bytes and changed source are refused',async()=>{const{api,bundle,packed,manifest,payload,pack}=fixture();for(const version of [`${api.ENGINE_VERSION+1}/1`,`${api.ENGINE_VERSION}/2`,'0/1',undefined])assert.throws(()=>bundle.validateManifest({...manifest,engineVersion:version}),/不相容/);const modified=structuredClone(payload);modified.animation.code+='\n// changed source';const corrupt=pack(modified);await assert.rejects(()=>bundle.decode(corrupt.blob,corrupt.descriptor,manifest,'full'),/程式碼版本不一致/);await assert.rejects(()=>bundle.decode(packed.blob,{...packed.descriptor,contentHash:'0'.repeat(64)},manifest,'full'),/雜湊不符/);});
