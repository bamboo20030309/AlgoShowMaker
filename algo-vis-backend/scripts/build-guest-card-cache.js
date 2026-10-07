// Generate public card metadata once at build time, never in a visitor's browser.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('../tests/helpers/isolated-server');
global.ASMTraceProvenance=require('../public/trace-provenance');
global.ASMTraceViewSource=require('../public/trace-view-source');
const archive=require('../public/asmdeck');
(async()=>{
 const cleanups=[];let browser;
 try {
  const {base}=await startIsolatedServer({after:fn=>cleanups.push(fn)});
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage();await page.goto(base+'/slides.html');
  await page.waitForFunction(()=>Boolean(window.AlgoDeckThumbnail&&window.AlgoStructureRenderer));
  const root=path.resolve(__dirname,'../public');const file=path.join(root,'guest-decks.json');
  const catalog=JSON.parse(fs.readFileSync(file));
  for(const entry of catalog.decks){
   const source=path.resolve(root,entry.archive.replace(/^\//,'').split('?')[0]);
   if(!source.startsWith(root+path.sep))throw Error('archive path escapes public root');
   const decoded=await archive.decode(new Blob([fs.readFileSync(source)]));
   const first=decoded.deck.groups.find(group=>group.slides?.length)?.slides[0];
   entry.cover_thumbnail=await page.evaluate(deck=>AlgoDeckThumbnail.create(deck),{groups:[{slides:[first]}]});
   entry.slide_count=decoded.deck.groups.reduce((sum,group)=>sum+group.slides.length,0);
   entry.updated_at=decoded.cover?.updatedAt||entry.updated_at||null;
   entry.cover_revision=await archive.sha256(JSON.stringify(first));
  }
  fs.writeFileSync(file,JSON.stringify(catalog,null,2)+'\n');
  console.log(JSON.stringify({cards:catalog.decks.length,bytes:fs.statSync(file).size}));
 } finally {await browser?.close();for(const cleanup of cleanups.reverse())await cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1});
