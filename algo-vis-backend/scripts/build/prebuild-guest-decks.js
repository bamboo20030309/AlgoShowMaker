#!/usr/bin/env node
// 全部選定教材成功後才切換清單。--rerun 重跑程式但保留相容執行檔快取。
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const publicRoot=path.resolve(option('--public-root')||path.resolve(__dirname,'../../public'));
const base=option('--base-url')||process.env.ASM_PREBUILD_BASE_URL||'http://127.0.0.1:3100';
const only=new Set((option('--only')||'').split(',').filter(Boolean));
global.ASMTraceProvenance=require('../../public/trace-provenance');
global.ASMTraceViewSource=require('../../public/trace-view-source');
global.ASMTraceModel={normalizeTraceDocument:v=>JSON.parse(JSON.stringify(v))};
global.indexedDB=require('fake-indexeddb').indexedDB;
const nativeFetch=global.fetch;
global.fetch=(input,init)=>{
 const url=new URL(String(input),base);
 if(url.pathname==='/compile'&&init?.body)init={...init,body:JSON.stringify({...JSON.parse(init.body),
  ...(args.includes('--force')?{forceRecompile:true}:args.includes('--rerun')?{refreshTrace:true}:{})})};
 return nativeFetch(url,init);
};
const A=require('../../public/asmdeck'),{registerDeckTraces}=require('./sample-trace-assets');
const {buildDefaultAlgorithmAssets}=require('./default-algorithm-assets');
async function write(target,bytes){await fs.mkdir(path.dirname(target),{recursive:true});const tmp=target+'.'+process.pid+'.tmp';await fs.writeFile(tmp,bytes);await fs.rename(tmp,target);}
function resolvePublic(relative){const target=path.resolve(publicRoot,relative.replace(/^\//,'').split('?')[0]);if(!target.startsWith(publicRoot+path.sep))throw Error('資源路徑超出 public');return target;}
async function verify(catalog,root=publicRoot){
 const index=JSON.parse(await fs.readFile(path.join(root,'deck-traces/index.json'),'utf8'));let count=0;
 for(const entry of catalog.decks){
  const target=path.join(root,entry.archive.replace(/^\//,'').split('?')[0]);
  const decoded=await A.decode(new Blob([await fs.readFile(target)]));
  for(const slide of decoded.deck.groups.flatMap(g=>g.slides||[]).filter(s=>s.animation)){
   const a=slide.animation;if(!a.traceRef)throw Error(`${entry.id}/${slide.id} 缺少 Trace ID`);
   const file=require('../../public/sample-trace-assets').filenameFor(index,a.traceRef);
   const trace=JSON.parse(await fs.readFile(path.join(root,'deck-traces',file),'utf8'));
   if(await A.sha256(require('../../public/slides-storage').canonical(trace))!==a.traceRef)throw Error(`${entry.id}/${slide.id} Trace 雜湊不符`);
   if(ASMTraceProvenance.status(trace,a.code,a.input).kind!=='current')throw Error(`${entry.id}/${slide.id} Trace 過期`);
   require('../validation/trace-source-coordinates').verifySourceCoordinates(trace);
   count++;
  }
 }return count;
}
async function main(){
 await ASMTraceProvenance.ready();
 const catalog=JSON.parse(await fs.readFile(path.join(publicRoot,'guest-decks.json'),'utf8'));
 if(args.includes('--verify-only')){console.log(`核對通過：${await verify(catalog)} 份動畫`);return;}
 const entries=catalog.decks.filter(e=>!only.size||only.has(e.id));if(!entries.length)throw Error('沒有符合 --only 的範例');
 const stage=await fs.mkdtemp(path.join(os.tmpdir(),'asm-sample-stage-'));let sieveDeck;
 const publications=[],canonicals=[];
 try{
  await fs.mkdir(path.join(stage,'deck-traces'),{recursive:true});
  await fs.copyFile(path.join(publicRoot,'deck-traces/index.json'),path.join(stage,'deck-traces/index.json'));
  for(const entry of entries){
   const source=entry.source_archive||entry.archive.split('?')[0],stem=path.basename(source,'.asmdeck');
   const decoded=await A.decode(new Blob([await fs.readFile(resolvePublic(source))]));
   for(const slide of decoded.deck.groups.flatMap(g=>g.slides||[]).filter(s=>s.animation)){
    await A.clearCache();slide.animation=await A.rebuildMissingAnimation(slide.animation);
    if(ASMTraceProvenance.status(slide.animation.traceDocument,slide.animation.code,slide.animation.input).kind!=='current')throw Error(`${entry.id}/${slide.id} 重建結果版本不符`);
    console.log(`${entry.id}/${slide.id}: ${slide.animation.traceDocument.frames.length} frames`);
   }
   const projected=await A.project(decoded.deck,null,{includePrebuiltTraces:false});if(decoded.cover)projected.cover=decoded.cover;
   registerDeckTraces(stage,entry,projected.deck,projected.cacheSeeds,{immutable:true,stem});
   const bytes=Buffer.from(await(await A.encode(projected)).arrayBuffer());
   const revision=await A.sha256(bytes),archive=`/guest-decks/${stem}-${revision}.asmdeck`;
   await write(path.join(stage,archive.slice(1)),bytes);
   entry.source_archive=source;entry.archive=archive;entry.trace_generation=ASMTraceProvenance.generationFingerprint;
   publications.push(archive);canonicals.push({source,bytes});
   if(entry.id==='linear-sieve')sieveDeck=decoded.deck;
  }
  console.log(`核對通過：${await verify({decks:entries},stage)} 份動畫`);
  if(sieveDeck)await buildDefaultAlgorithmAssets(sieveDeck,{publicRoot:stage,engineVersion:A.engineVersion(),immutable:true});
  // 不可變資源先到位，索引／清單才切換；原 ID 和舊清單引用仍可使用。
  for(const file of await fs.readdir(path.join(stage,'deck-traces')))if(file!=='index.json')await write(path.join(publicRoot,'deck-traces',file),await fs.readFile(path.join(stage,'deck-traces',file)));
  for(const archive of publications)await write(resolvePublic(archive),await fs.readFile(path.join(stage,archive.slice(1))));
  await write(path.join(publicRoot,'deck-traces/index.json'),await fs.readFile(path.join(stage,'deck-traces/index.json')));
  if(sieveDeck){
   for(const file of await fs.readdir(path.join(stage,'default-animation')))if(file!=='manifest.json')await write(path.join(publicRoot,'default-animation',file),await fs.readFile(path.join(stage,'default-animation',file)));
   await write(path.join(publicRoot,'sample_code.cpp'),await fs.readFile(path.join(stage,'sample_code.cpp')));
   await write(path.join(publicRoot,'default-animation/manifest.json'),await fs.readFile(path.join(stage,'default-animation/manifest.json')));
  }
  await write(path.join(publicRoot,'guest-decks.json'),JSON.stringify(catalog,null,2)+'\n');
  // 可讀原始檔供後續編製，公開清單指向不可變版本。
  for(const {source,bytes} of canonicals)await write(resolvePublic(source),bytes);
  console.log(`已切換 ${entries.length} 份公開教材，生成指紋 ${ASMTraceProvenance.generationFingerprint}`);
 }finally{
  if(!path.resolve(stage).startsWith(path.resolve(os.tmpdir())+path.sep+'asm-sample-stage-'))throw Error('暫存目錄範圍不符');
  await fs.rm(stage,{recursive:true,force:true});
 }
}
if(require.main===module)main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={main,verify};
