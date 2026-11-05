'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');

test('merge marks remain painted above lifted comparison cells', {timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t),body=readPackage(fs.readFileSync('public/guest-decks/merge-sort.asmdeck')).body;
 const slide=body.deck.groups.flatMap(g=>g.slides||[]).find(s=>s.animation),trace=savedTrace(body,slide.animation);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 await page.evaluate(async trace=>{
  ASMTracePlayer.apply(trace);window.ASMStructureLOD=undefined;window.asmGetAnimationPlaybackRate=()=>1;window.ASMTraceCamera={...ASMTraceCamera,apply(){},transitionDuration:()=>0};
  await ASMTracePlayer.render(9,{stable:true});document.querySelector('#arraySvg').setAttribute('viewBox','0 200 700 350');
  let time=performance.now(),elapsed=0,serial=0,compareStart=null;const callbacks=new Map();
  window.requestAnimationFrame=f=>{callbacks.set(++serial,f);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>time});
  window.addEventListener('asm:trace-active-event',event=>{if(compareStart===null&&event.detail?.event?.type==='compare'&&event.detail.event.targets?.some(t=>/^num\[/.test(t.expression||'')))compareStart=elapsed;});
  const advance=async to=>{while(elapsed<to){time+=10;elapsed+=10;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(f=>f(time));for(let i=0;i<10;i++)await Promise.resolve();}};
  window.markPaintAdvance=async offset=>{if(compareStart===null)throw Error('Comparison not started');await advance(compareStart+offset);};
  window.markPaintPlay=ASMTracePlayer.render(10,{fromIndex:9,forceTransition:true});
  while(compareStart===null&&elapsed<10000)await advance(elapsed+10);
  if(compareStart===null)throw Error('Missing real array comparison');
 },trace);
 for(const at of [200,1000]){
  await page.evaluate(async at=>window.markPaintAdvance(at),at);
  await page.evaluate(()=>{
   const svg=document.querySelector('#arraySvg'),root=document.querySelector('#asm-trace-root');
   const rects=[...root.querySelectorAll('.asm-trace-animation-effect-layer [data-trace-index] > rect')];
   const inverse=svg.getScreenCTM().inverse(),points=rects.flatMap(rect=>{
    const b=rect.getBBox(),m=inverse.multiply(rect.getScreenCTM());
    return [new DOMPoint(b.x,b.y).matrixTransform(m),new DOMPoint(b.x+b.width,b.y+b.height).matrixTransform(m)];
   });
   if(!points.length)throw Error('No lifted cells');
   const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),right=Math.max(...points.map(p=>p.x)),bottom=Math.max(...points.map(p=>p.y));
   svg.style.setProperty('height','600px','important');svg.style.setProperty('width','1200px','important');svg.parentElement.style.setProperty('height','600px','important');
   svg.setAttribute('viewBox',`${x-40} ${y-40} ${right-x+80} ${bottom-y+80}`);svg.scrollIntoView({block:'start'});
  });
  const marks=await page.evaluate(()=>[...document.querySelectorAll('[data-trace-attachment-kind="mark"]')].filter(mark=>mark.closest('.asm-trace-style-decoration')?._asmStyleCell?.closest('.asm-trace-animation-effect-layer')).map(mark=>{
   const point=mark.getPointAtLength(mark.getTotalLength()/2).matrixTransform(mark.getScreenCTM());
   const color=getComputedStyle(mark).stroke.match(/[\d.]+/g).slice(0,3).map(Number);
   return {x:point.x,y:point.y,color,foreground:mark.closest('.asm-trace-style-layer')?.parentElement?.id==='asm-trace-root'};
  }));
  assert.equal(marks.length,2,'both lifted cells have marks');
  const output=path.resolve(__dirname,'../test-results/mark-merge-2026-11-05');fs.mkdirSync(output,{recursive:true});
  const png=await page.screenshot({path:path.join(output,'paint-'+at+'ms.png')});
  const pixels=await page.evaluate(async({png,marks})=>{const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return marks.map(mark=>{let count=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=Math.round(mark.x)+dx,y=Math.round(mark.y)+dy;if(x<0||x>=canvas.width||y<0||y>=canvas.height)continue;const pixel=ctx.getImageData(x,y,1,1).data;if(mark.color.every((v,i)=>Math.abs(v-pixel[i])<55))count++;}return count;});},{png:png.toString('base64'),marks});
  for(let i=0;i<marks.length;i++)assert.ok(pixels[i]>=3,at+' ms: actual green mark pixels must remain visible above the cell '+JSON.stringify({mark:marks[i],pixels:pixels[i]}));
  assert.ok(marks.every(m=>m.foreground),at+' ms: nested marks share the foreground style layer');
 }
 await page.evaluate(()=>ASMTraceFrameTween.cancel());
});
