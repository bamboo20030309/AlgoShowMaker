// Isolated browser benchmark: no access to user decks, accounts or live tabs.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('../tests/helpers/isolated-server');
global.ASMTraceProvenance = require('../public/trace-provenance');
global.ASMTraceViewSource = require('../public/trace-view-source');
const archive = require('../public/asmdeck');
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];

(async () => {
  const cleanups = [];
  let browser;
  try {
    const { base } = await startIsolatedServer({ after: fn => cleanups.push(fn) });
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const before = execFileSync('git', ['show', '7347375:algo-vis-backend/public/home.js'], { encoding: 'utf8' });
    const imagePage = await browser.newPage();
    const thumbnail = await imagePage.evaluate(() => {
      const c = document.createElement('canvas'); c.width=640; c.height=360;
      const ctx=c.getContext('2d'); ctx.fillStyle='#faf7f0'; ctx.fillRect(0,0,640,360);
      ctx.fillStyle='#182c3b'; ctx.font='32px sans-serif'; ctx.fillText('AlgoShowMaker',40,65);
      for(let i=0;i<10;i++){ctx.strokeRect(30+i*58,170,52,52);ctx.fillText(String(i),42+i*58,207)}
      return c.toDataURL('image/jpeg',0.8);
    });
    await imagePage.close();
    const cards = Array.from({length:50},(_,i)=>({deck_uid:`deck-${i}`,title:`教學 ${i}`,slide_count:20,
      updated_at:'2026-10-07T00:00:00Z',cover_thumbnail:thumbnail,categories:[{id:'sort',title:'排序'}]}));
    const layout={folders:[{id:'sort',title:'排序',deckIds:cards.map(card=>card.deck_uid)}],unfiled:[]};
    const runs=[];
    for(const mode of ['before','after']) for(let attempt=0;attempt<3;attempt++) {
      const context=await browser.newContext({viewport:{width:1440,height:900}});
      await context.addInitScript(()=>localStorage.setItem('algo_jwt_token','benchmark-fixture'));
      const page=await context.newPage();let requests=0,detailRequests=0,responseBytes=0;
      await page.route('**/guest-decks.json',route=>route.fulfill({json:{decks:[]}}));
      if(mode==='before')await page.route('**/home.js?*',route=>route.fulfill({contentType:'application/javascript',body:before}));
      await page.route('**/api/**',async route=>{
        requests++;const url=new URL(route.request().url());let payload;
        if(url.pathname==='/api/auth/me')payload={user:{id:'benchmark',username:'benchmark'}};
        else if(url.pathname==='/api/slides')payload=mode==='after'?{slides:cards,layout}:{slides:cards.map(({cover_thumbnail,...card})=>({...card,has_thumbnail:true}))};
        else if(url.pathname==='/api/slide-library')payload={layout};
        else if(url.pathname.endsWith('/thumbnail')){detailRequests++;payload={thumbnail,updated_at:cards[0].updated_at};}
        else {detailRequests++;payload={error:'Unexpected request'};}
        const body=JSON.stringify(payload);responseBytes+=Buffer.byteLength(body);
        await new Promise(resolve=>setTimeout(resolve,20));
        await route.fulfill({contentType:'application/json',body});
      });
      for(const load of ['cold','warm']) {
        requests=0;detailRequests=0;responseBytes=0;
        const start=performance.now();if(load==='cold')await page.goto(base+'/');else await page.reload();
        await page.waitForFunction(()=>{
          const images=[...document.querySelectorAll('#deckGrid .deck-cover-image')];
          return document.querySelectorAll('#deckGrid .deck-card').length===50&&images.length===50
            &&images.every(image=>image.complete&&image.naturalWidth>0);
        });
        runs.push({mode,attempt,load,ms:Math.round(performance.now()-start),requests,detailRequests,responseBytes});
      }
      await context.close();
    }
    const galleryRuns=[];
    const oldGallery=execFileSync('git',['show','7347375:algo-vis-backend/public/guest-gallery.js'],{encoding:'utf8'});
    const oldCatalog=execFileSync('git',['show','7347375:algo-vis-backend/public/guest-decks.json'],{encoding:'utf8'});
    for(const mode of ['before','after'])for(let attempt=0;attempt<3;attempt++){
      const context=await browser.newContext();const page=await context.newPage();let archives=0,bytes=0;
      if(mode==='before'){
        await page.route('**/guest-gallery.js?*',route=>route.fulfill({contentType:'application/javascript',body:oldGallery}));
        await page.route('**/guest-decks.json',route=>route.fulfill({contentType:'application/json',body:oldCatalog}));
      }
      const responses=[];page.on('response',response=>{if(response.url().includes('/guest-decks/')||response.url().endsWith('/guest-decks.json')){
        if(response.url().includes('/guest-decks/')){
          archives++;bytes+=fs.statSync(path.join(__dirname,'../public',new URL(response.url()).pathname)).size;
        } else responses.push(response.body().then(body=>{bytes+=body.length}));
      }});
      const start=performance.now();await page.goto(base+'/?examples=1');
      await page.waitForFunction(()=>{const images=[...document.querySelectorAll('#galleryGrid .deck-cover-image')];return images.length===15&&images.every(image=>image.complete&&image.naturalWidth>0)},null,{timeout:60000});
      await Promise.all(responses);galleryRuns.push({mode,attempt,ms:Math.round(performance.now()-start),archives,bytes});await context.close();
    }
    const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/guest-decks.json')));
    const files=catalog.decks.map(entry=>path.join(__dirname,'../public',entry.archive.split('?')[0]));
    const sourceFile=files.sort((a,b)=>fs.statSync(b).size-fs.statSync(a).size)[0];
    const source=new Blob([fs.readFileSync(sourceFile)]);
    const decoded=await archive.decode(source);
    const projected=await archive.project(decoded.deck);
    projected.cover={title:'封面效能測試',thumbnail,categories:['排序'],updatedAt:'2026-10-07T00:00:00Z'};
    const modern=await archive.encode(projected);const cover=await archive.readCover(modern);
    const timings={legacyFull:[],newFull:[],coverOnly:[]};
    for(let i=0;i<7;i++)for(const [name,run] of Object.entries({legacyFull:()=>archive.decode(source),newFull:()=>archive.decode(modern),coverOnly:()=>archive.readCover(modern)})){
      const start=performance.now();await run();timings[name].push(performance.now()-start);
    }
    const result={environment:'Local headless Edge; 50 fixed cards; each mocked API response delayed 20ms; 3 trials. Not WAN or concurrent-user load testing.',
      summaries:['before','after'].flatMap(mode=>['cold','warm'].map(load=>{
        const rows=runs.filter(row=>row.mode===mode&&row.load===load);
        return {mode,load,medianMs:median(rows.map(row=>row.ms)),apiRequests:rows[0].requests,detailRequests:rows[0].detailRequests,responseBytes:rows[0].responseBytes};
      })),gallery:['before','after'].map(mode=>{const rows=galleryRuns.filter(row=>row.mode===mode);return{mode,medianMs:median(rows.map(row=>row.ms)),archiveRequests:rows[0].archives,responseBytes:rows[0].bytes}}),archive:{source:path.basename(sourceFile),legacyBytes:source.size,newBytes:modern.size,coverBytes:cover.bodyOffset,
        medianMs:Object.fromEntries(Object.entries(timings).map(([key,values])=>[key,Number(median(values).toFixed(2))]))},runs};
    fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
    fs.writeFileSync(path.join(__dirname,'../test-results/card-loading-benchmark.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
  } finally {await browser?.close();for(const cleanup of cleanups.reverse())await cleanup();}
})().catch(error=>{console.error(error);process.exitCode=1});
